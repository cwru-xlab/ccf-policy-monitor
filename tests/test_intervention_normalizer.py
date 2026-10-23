"""Offline tests for notebooks/intervention_normalizer.py using a mocked HTTP transport."""

import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent / "notebooks"))
from intervention_normalizer import Concept, Kind, Normalizer


def _normalizer(handler) -> tuple[Normalizer, list[str]]:
    seen: list[str] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.host)
        return handler(request)

    return Normalizer(httpx.Client(transport=httpx.MockTransport(wrapped))), seen


def test_drug_collapses_to_ingredient():
    def handler(req):
        if req.url.path.endswith("approximateTerm.json"):
            return httpx.Response(200, json={"approximateGroup": {"candidate": [{"rxcui": "617317"}]}})
        return httpx.Response(200, json={"relatedGroup": {"conceptGroup": [
            {"tty": "IN", "conceptProperties": [{"rxcui": "83367", "name": "atorvastatin"}]}]}})

    n, _ = _normalizer(handler)
    assert n.normalize(Kind.DRUG, "Lipitor 20 mg").key == "rxnorm:83367"


def test_chain_falls_through_on_error_and_records_it():
    def handler(req):
        if req.url.host == "tx.fhir.org":
            return httpx.Response(503)
        return httpx.Response(200, json={"concepts": [{"code": "C16450", "name": "Colonoscopy"}]})

    n, _ = _normalizer(handler)
    result = n.normalize(Kind.PROCEDURE, "colonoscopy")
    assert result.key == "ncit:C16450"
    assert len(result.errors) == 1 and "503" in result.errors[0]


def test_snomed_prefers_hit_covering_all_query_words_with_fewest_extras():
    hits = [{"code": "1", "display": "Physical exercises"},
            {"code": "2", "display": "Physical therapy procedure"},
            {"code": "3", "display": "Physical therapy procedure for stroke rehabilitation"}]
    n, _ = _normalizer(lambda req: httpx.Response(200, json={"expansion": {"contains": hits}}))
    assert n.normalize(Kind.THERAPY, "physical therapy").key == "snomed:2"


def test_results_are_memoised_and_unresolved_is_none():
    n, seen = _normalizer(lambda req: httpx.Response(200, json={"expansion": {}, "concepts": []}))
    assert n.normalize(Kind.PROCEDURE, "colon scope").concept is None
    calls = len(seen)
    n.normalize(Kind.PROCEDURE, "  Colon   scope ")
    assert len(seen) == calls


def test_related_is_equal_for_same_key_and_unrelated_for_unresolved():
    n, _ = _normalizer(lambda req: httpx.Response(500))
    a = n.normalize(Kind.PROCEDURE, "x").concept  # every source fails: unresolved
    assert a is None and n.related(a, a) == "unrelated"
    c = Concept("snomed", "1", "a")
    assert n.related(c, c) == "equal"


def test_snomed_subsumption_maps_outcome_and_failures_are_not_cached():
    ok = httpx.Response(200, json={"parameter": [{"name": "outcome", "valueCode": "subsumes"}]})
    n, _ = _normalizer(lambda req: ok)
    a, b = Concept("snomed", "1", "a"), Concept("snomed", "2", "b")
    assert n.related(a, b) == "a_broader"
    down, _ = _normalizer(lambda req: httpx.Response(503))
    assert down.related(a, b) == "unrelated" and not down._relations


def test_drug_is_narrower_than_its_class_and_combinations_do_not_count():
    info = lambda rxcui: {"minConcept": {"rxcui": rxcui}, "rxclassMinConceptItem": {"classId": "C10AA"}}
    body = {"rxclassDrugInfoList": {"rxclassDrugInfo": [info("999"), info("83367")]}}
    n, _ = _normalizer(lambda req: httpx.Response(200, json=body))
    drug, cls = Concept("rxnorm", "83367", "atorvastatin"), Concept("rxclass", "C10AA", "statins")
    assert n.related(drug, cls) == "a_narrower" and n.related(cls, drug) == "a_broader"
    other = Concept("rxnorm", "1", "other")
    only_combo = {"rxclassDrugInfoList": {"rxclassDrugInfo": [info("999")]}}
    n2, _ = _normalizer(lambda req: httpx.Response(200, json=only_combo))
    assert n2.related(other, cls) == "unrelated"


def test_cache_persists_only_clean_results(tmp_path):
    path = tmp_path / "c.json"
    hit = {"concepts": [{"code": "C1", "name": "Thing"}]}
    n1 = Normalizer(httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, json=hit))), path)
    assert n1.normalize(Kind.OTHER, "thing").key == "ncit:C1"
    n2 = Normalizer(httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500))), path)
    assert n2.normalize(Kind.OTHER, "thing").key == "ncit:C1"  # served from disk, no request needed
    n3 = Normalizer(httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500))), tmp_path / "d.json")
    assert n3.normalize(Kind.OTHER, "x").concept is None
    n3._save()
    assert json.loads((tmp_path / "d.json").read_text())["terms"] == {}  # the failed lookup was not stored
