"""Map a term as a document words it onto one shared Concept (lookup, never an LLM).

A term is a ``kind`` plus text. Each kind has an ordered chain of resolvers, keyless sources
first; the first resolver to return a concept wins. A resolver that errors is recorded on the
result and the chain continues, so a source outage degrades matching instead of failing it.
``related`` says whether two concepts are equal or one is broader than the other.

Only keyless sources are wired here. Paid and gated alternatives are catalogued in
docs/INTERVENTION_NORMALIZATION.md and plug in as extra resolvers with the same signature.
"""

import json
import re
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from pathlib import Path

import httpx

RXNAV = "https://rxnav.nlm.nih.gov/REST"
TX_FHIR = "https://tx.fhir.org/r4"
EVS = "https://api-evsrest.nci.nih.gov/api/v1"
LOINC_TABLE = "https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search"
CVX_FILE = "https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/cvx.txt"

SNOMED_PROCEDURE = "71388002"
SNOMED_DEVICE = "49062001"
SNOMED_FINDING = "404684003"  # clinical finding: disorders and findings such as "pregnant"


class Kind(StrEnum):
    DRUG = "drug"
    DRUG_CLASS = "drug_class"
    VACCINE = "vaccine"
    PROCEDURE = "procedure"
    THERAPY = "therapy"
    TEST = "test"
    DEVICE = "device"
    CONDITION = "condition"
    OTHER = "other"


@dataclass(frozen=True)
class Concept:
    system: str  # "rxnorm", "rxclass", "snomed", "ncit", "cvx", "loinc", or "text" (unresolved)
    code: str
    name: str

    @property
    def key(self) -> str:
        return f"{self.system}:{self.code}"


@dataclass(frozen=True)
class Normalized:
    verbatim: str
    kind: Kind
    concept: Concept | None
    errors: tuple[str, ...] = field(default=())

    @property
    def key(self) -> str | None:
        return self.concept.key if self.concept else None


Resolver = Callable[[httpx.Client, str], Concept | None]


def _words(s: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", s.lower())


def _rxnorm(http: httpx.Client, term: str) -> Concept | None:
    """Best RxNorm match, collapsed to its ingredient so brand/strength/form variants agree."""
    approx = http.get(f"{RXNAV}/approximateTerm.json", params={"term": term, "maxEntries": 1})
    approx.raise_for_status()
    candidates = approx.json().get("approximateGroup", {}).get("candidate", [])
    if not candidates:
        return None
    rxcui = candidates[0]["rxcui"]
    related = http.get(f"{RXNAV}/rxcui/{rxcui}/related.json", params={"tty": "IN"})
    related.raise_for_status()
    for group in related.json().get("relatedGroup", {}).get("conceptGroup", []):
        for prop in group.get("conceptProperties", []):
            return Concept("rxnorm", prop["rxcui"], prop["name"])
    props = http.get(f"{RXNAV}/rxcui/{rxcui}/properties.json")
    props.raise_for_status()
    p = props.json().get("properties") or {}
    return Concept("rxnorm", rxcui, p.get("name", term)) if p.get("tty") == "IN" else None


def _rxclass(http: httpx.Client, term: str) -> Concept | None:
    """A drug class by its ATC or EPC name (exact name, e.g. "HMG CoA reductase inhibitors")."""
    for variant in dict.fromkeys([term, term.replace("-", " ")]):
        for class_type in ("ATC1-4", "EPC"):
            resp = http.get(
                f"{RXNAV}/rxclass/class/byName.json",
                params={"className": variant, "classTypes": class_type},
            )
            resp.raise_for_status()
            items = resp.json().get("rxclassMinConceptList", {}).get("rxclassMinConcept", [])
            if items:
                return Concept("rxclass", items[0]["classId"], items[0]["className"])
    return None


def _drug_in_class(http: httpx.Client, drug: Concept, cls: Concept) -> bool:
    for source in ("ATC", "DAILYMED"):
        resp = http.get(f"{RXNAV}/rxclass/class/byRxcui.json", params={"rxcui": drug.code, "relaSource": source})
        resp.raise_for_status()
        for info in resp.json().get("rxclassDrugInfoList", {}).get("rxclassDrugInfo", []):
            same_drug = info["minConcept"]["rxcui"] == drug.code  # the API also lists combinations
            if same_drug and info["rxclassMinConceptItem"]["classId"] == cls.code:
                return True
    return False


def _snomed(root: str) -> Resolver:
    def resolve(http: httpx.Client, term: str) -> Concept | None:
        resp = http.get(
            f"{TX_FHIR}/ValueSet/$expand",
            params={"url": f"http://snomed.info/sct?fhir_vs=isa/{root}", "filter": term, "count": 10},
        )
        resp.raise_for_status()
        hits = resp.json().get("expansion", {}).get("contains", [])
        if not hits:
            return None
        # The server's order is arbitrary and the filter also matches synonyms, so rank by how
        # tightly the displayed name covers the query: all query words present, fewest extras.
        want = set(_words(term))

        def cost(h: dict) -> tuple[bool, int]:
            have = _words(h["display"])
            return (not want <= set(have), len(have))

        best = min(hits, key=cost)
        return Concept("snomed", best["code"], best["display"])

    return resolve


def _ncit(http: httpx.Client, term: str) -> Concept | None:
    resp = http.get(f"{EVS}/concept/ncit/search", params={"term": term, "type": "phrase", "pageSize": 1})
    resp.raise_for_status()
    hits = resp.json().get("concepts", [])
    return Concept("ncit", hits[0]["code"], hits[0]["name"]) if hits else None


def _loinc(http: httpx.Client, term: str) -> Concept | None:
    resp = http.get(LOINC_TABLE, params={"terms": term, "maxList": 1})
    resp.raise_for_status()
    _, codes, _, rows = resp.json()
    return Concept("loinc", codes[0], rows[0][0]) if codes else None


_CVX_BY_CLIENT: dict[int, tuple[tuple[str, str, str], ...]] = {}


def _cvx_table(http: httpx.Client) -> tuple[tuple[str, str, str], ...]:
    """(code, short name, full name) per active CVX row; downloaded once per client."""
    if id(http) not in _CVX_BY_CLIENT:
        resp = http.get(CVX_FILE, headers={"Accept": "*/*"})
        resp.raise_for_status()
        rows = []
        for line in resp.text.splitlines():
            cells = [c.strip() for c in line.lstrip("﻿").split("|")]
            if len(cells) >= 5 and cells[4] != "Inactive":
                rows.append((cells[0], cells[1], cells[2]))
        _CVX_BY_CLIENT[id(http)] = tuple(rows)
    return _CVX_BY_CLIENT[id(http)]


def _cvx(http: httpx.Client, term: str) -> Concept | None:
    words = set(_words(term)) - {"vaccine", "vaccination", "immunization"}
    best: tuple[int, tuple[str, str, str]] | None = None
    for row in _cvx_table(http):
        have = _words(f"{row[1]} {row[2]}")
        if "globulin" in have or "vaccine" not in have:
            continue  # CVX also lists immune globulins and other non-vaccines
        # Counting repeats makes combination vaccines (hepatitis A-hepatitis B) cost more.
        if words and words <= set(have) and (best is None or len(have) < best[0]):
            best = (len(have), row)
    return Concept("cvx", best[1][0], best[1][1]) if best else None


_PROCEDURE = _snomed(SNOMED_PROCEDURE)
CHAINS: dict[Kind, tuple[Resolver, ...]] = {
    Kind.DRUG: (_rxnorm, _ncit),
    Kind.DRUG_CLASS: (_rxclass, _ncit),
    Kind.VACCINE: (_cvx, _rxnorm, _ncit),
    Kind.PROCEDURE: (_PROCEDURE, _ncit),
    Kind.THERAPY: (_PROCEDURE, _ncit),
    Kind.TEST: (_PROCEDURE, _loinc, _ncit),
    Kind.DEVICE: (_snomed(SNOMED_DEVICE), _ncit),
    Kind.CONDITION: (_snomed(SNOMED_FINDING), _ncit),
    Kind.OTHER: (_ncit,),
}


class Normalizer:
    """Resolve terms to concepts and relate concepts. Results are memoised, and persisted to
    ``cache_path`` when given; results that hit a source error are never persisted."""

    def __init__(self, http: httpx.Client | None = None, cache_path: Path | None = None):
        self._http = http or httpx.Client(timeout=20, headers={"Accept": "application/json"})
        self._path = cache_path
        self._memo: dict[str, Normalized] = {}
        self._relations: dict[str, str] = {}
        if cache_path and cache_path.exists():
            saved = json.loads(cache_path.read_text())
            for k, c in saved["terms"].items():
                kind, text = k.split("|", 1)
                self._memo[k] = Normalized(text, Kind(kind), Concept(**c) if c else None)
            self._relations = saved["relations"]

    def _save(self) -> None:
        if self._path:
            terms = {k: (asdict(v.concept) if v.concept else None) for k, v in self._memo.items() if not v.errors}
            self._path.write_text(json.dumps({"terms": terms, "relations": self._relations}))

    def normalize(self, kind: Kind, text: str) -> Normalized:
        cleaned = " ".join(text.split())
        key = f"{kind.value}|{cleaned.lower()}"
        if key not in self._memo:
            self._memo[key] = self._resolve(kind, cleaned)
            self._save()
        return self._memo[key]

    def _resolve(self, kind: Kind, text: str) -> Normalized:
        errors: list[str] = []
        for resolver in CHAINS[kind]:
            try:
                concept = resolver(self._http, text)
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                errors.append(f"{getattr(resolver, '__name__', 'snomed')}: {type(exc).__name__}: {exc}")
                continue
            if concept:
                return Normalized(text, kind, concept, tuple(errors))
        return Normalized(text, kind, None, tuple(errors))

    def related(self, a: Concept | None, b: Concept | None) -> str:
        """equal, a_broader, a_narrower or unrelated.

        Exact key equality is too strict ("colonoscopy" vs "fiberoptic colonoscopy"), so
        SNOMED pairs ask the terminology server for subsumption and a drug is checked for
        membership in a drug class. Other pairs compare keys only.
        """
        if a is None or b is None:
            return "unrelated"
        if a.key == b.key:
            return "equal"
        key = f"{a.key}|{b.key}"
        if key not in self._relations:
            try:
                self._relations[key] = self._lookup_relation(a, b)
            except (httpx.HTTPError, KeyError, StopIteration, ValueError):
                return "unrelated"  # an outage is not evidence of relatedness; not cached
            self._save()
        return self._relations[key]

    def _lookup_relation(self, a: Concept, b: Concept) -> str:
        if a.system == b.system == "snomed":
            resp = self._http.get(
                f"{TX_FHIR}/CodeSystem/$subsumes",
                params={"system": "http://snomed.info/sct", "codeA": a.code, "codeB": b.code},
            )
            resp.raise_for_status()
            outcome = next(p["valueCode"] for p in resp.json()["parameter"] if p["name"] == "outcome")
            return {"equivalent": "equal", "subsumes": "a_broader", "subsumed-by": "a_narrower"}.get(outcome, "unrelated")
        if a.system == "rxnorm" and b.system == "rxclass":
            return "a_narrower" if _drug_in_class(self._http, a, b) else "unrelated"
        if a.system == "rxclass" and b.system == "rxnorm":
            return "a_broader" if _drug_in_class(self._http, b, a) else "unrelated"
        return "unrelated"
