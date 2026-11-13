"""Tracked guideline URLs: snapshots into source_document, approval, and update detection.

A snapshot of a PDF is the PDF itself; of any other page, Firecrawl's main-content Markdown
stored as ``text/plain`` (which parser.py already reads). The content hash is over the stored
bytes, so an unchanged page always hashes the same.
"""

import difflib
import hashlib
import logging
import re
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

from policy_radar import db, firecrawl, llm, parser, pipelines, storage
from policy_radar.enums import MappingOrigin, MappingStatus

log = logging.getLogger(__name__)

PDF = "application/pdf"
TEXT = "text/plain"
_TRACKING_PARAMS = re.compile(r"^(utm_\w+|gclid|fbclid|mc_cid|mc_eid)$", re.IGNORECASE)
_PDF_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; PolicyRadar/0.2; guideline tracking)"}
MAX_DIFF_CHARS = 60_000


def normalize_url(url: str) -> str:
    """One spelling per page: https, lowercase host, no fragment, tracking params or
    trailing slash, remaining query params sorted."""
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower()
    if parts.port and parts.port not in (80, 443):
        host = f"{host}:{parts.port}"
    path = parts.path.rstrip("/") if parts.path not in ("", "/") else ""
    query = urlencode(sorted(
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not _TRACKING_PARAMS.match(k)
    ))
    return urlunsplit(("https", host, path, query, ""))


def domain(url: str) -> str:
    """The registrable-looking host of ``url`` without ``www.``: an authority's id."""
    host = (urlsplit(url).hostname or "").lower()
    return host.removeprefix("www.")


def source_id(url: str) -> str:
    return hashlib.sha256(normalize_url(url).encode()).hexdigest()[:16]


@dataclass(frozen=True)
class Snapshot:
    content: bytes
    media_type: str
    sha256: str
    title: str


def _normalize_markdown(markdown: str) -> str:
    lines = [line.rstrip() for line in markdown.strip().splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)) + "\n"


async def _download_pdf(url: str) -> bytes | None:
    """The raw PDF at ``url``, or None if the site refuses or serves something else."""
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True, headers=_PDF_HEADERS) as c:
            response = await c.get(url)
    except httpx.HTTPError as e:
        log.warning("PDF download failed for %s: %s", url, e)
        return None
    ok = response.status_code == 200 and response.content.startswith(b"%PDF")
    return response.content if ok else None


async def take_snapshot(url: str) -> Snapshot:
    """Fetch ``url`` fresh. PDFs keep their bytes when the site allows a direct download."""
    page = await firecrawl.scrape(url)
    if page.status_code >= 400:
        raise firecrawl.FirecrawlError(f"{url} answered HTTP {page.status_code}")
    if page.content_type == PDF or urlsplit(url).path.lower().endswith(".pdf"):
        raw = await _download_pdf(url)
        if raw:
            return Snapshot(raw, PDF, hashlib.sha256(raw).hexdigest(), page.title)
    if not page.markdown.strip():
        raise firecrawl.FirecrawlError(f"{url} returned no readable content")
    content = _normalize_markdown(page.markdown).encode()
    return Snapshot(content, TEXT, hashlib.sha256(content).hexdigest(), page.title)


async def _store(url: str, snap: Snapshot) -> str:
    """Store a snapshot as a web_discovery source_document; returns its document id."""
    await pipelines.store_document(db.WEB_DISCOVERY_SOURCE_KEY, snap.content, snap.media_type, url)
    return f"{db.WEB_DISCOVERY_SOURCE_KEY}-{snap.sha256[:16]}"


async def approve(src_id: str, policy_document_id: str) -> dict:
    """Approve a mapping; the first approval of a source stores its snapshot."""
    source = await db.get_source(src_id)
    if source is None:
        raise KeyError(src_id)
    if source["document_id"] is None:
        snap = await take_snapshot(source["url"])
        await db.set_snapshot(src_id, snap.sha256, await _store(source["url"], snap), False)
    await db.decide_mapping(src_id, policy_document_id, MappingStatus.APPROVED)
    return await db.get_mapping(src_id, policy_document_id)


async def add_manual(url: str, policy_document_id: str) -> dict:
    """Track a URL a user entered for a policy, approved at once."""
    url = normalize_url(url)
    snap = await take_snapshot(url)
    sid = source_id(url)
    await db.add_source(sid, url, snap.title or url, domain(url))
    if not await db.propose_mapping(
        sid, policy_document_id, "Added by hand.", MappingOrigin.MANUAL, MappingStatus.APPROVED
    ):
        await db.decide_mapping(sid, policy_document_id, MappingStatus.APPROVED)
    if (await db.get_source(sid))["document_id"] is None:
        await db.set_snapshot(sid, snap.sha256, await _store(url, snap), False)
    return await db.get_mapping(sid, policy_document_id)


async def _document_text(document_id: str | None) -> str:
    doc = document_id and await db.get_source_document(document_id)
    if not doc:
        return ""
    return parser.extract_markdown(storage.get(doc.storage_uri), doc.media_type)


def unified_diff(old: str, new: str) -> str:
    diff = "\n".join(difflib.unified_diff(
        old.splitlines(), new.splitlines(), "previous", "current", lineterm="", n=2
    ))
    return diff[:MAX_DIFF_CHARS]


async def check_source(source: dict) -> bool | None:
    """Re-fetch one source. Returns None if unchanged since the last fetch, else whether the
    change from the current snapshot is material. Only a material change stores a new
    snapshot (and a guideline_change); a minor one only records the fetch's hash, so the
    same page noise is not judged again."""
    snap = await take_snapshot(source["url"])
    if snap.sha256 == source["content_sha256"]:
        await db.mark_checked(source["source_id"])
        return None
    old = await _document_text(source["document_id"])
    new = parser.extract_markdown(snap.content, snap.media_type)
    verdict = await llm.judge_change(source["title"], unified_diff(old, new))
    if not verdict.material:
        await db.set_snapshot(source["source_id"], snap.sha256, source["document_id"], False)
        return False
    document_id = await _store(source["url"], snap)
    await db.set_snapshot(source["source_id"], snap.sha256, document_id, True)
    await db.record_change(source["source_id"], source["document_id"], document_id, verdict.summary)
    return True


async def check_updates() -> dict:
    """Check every tracked, unpaused source; one failure does not stop the run."""
    sources = await db.tracked_sources(include_paused=False)
    changed, minor, failed = 0, 0, []
    for source in sources:
        try:
            result = await check_source(source)
        except Exception as e:  # noqa: BLE001 — one bad URL must not stop the run
            failed.append({"source_id": source["source_id"], "error": f"{type(e).__name__}: {e}"})
            continue
        changed += result is True
        minor += result is False
    return {"checked": len(sources), "changed": changed, "minor_changes": minor, "failed": failed}
