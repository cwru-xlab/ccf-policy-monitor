"""Firecrawl v2 REST client: web search and single-page scrape for the mapping engine.

Only the two endpoints the mapping engine needs. ``transport`` lets tests swap in an
``httpx.MockTransport``; production uses the network.
"""

from dataclasses import dataclass

import httpx

from policy_radar.config import settings

API_URL = "https://api.firecrawl.dev/v2"
RECENT = "qdr:m"  # Google-style time filter: the past month


class FirecrawlError(RuntimeError):
    """Firecrawl answered with an error or an unexpected body."""


@dataclass(frozen=True)
class SearchResult:
    url: str
    title: str
    description: str


@dataclass(frozen=True)
class Page:
    """One scraped page. ``markdown`` is the main content; ``content_type`` is the origin's."""

    url: str
    title: str
    markdown: str
    content_type: str
    status_code: int = 200


def configured() -> bool:
    return bool(settings.firecrawl_api_key)


async def _post(path: str, body: dict, transport: httpx.AsyncBaseTransport | None) -> dict:
    if not configured():
        raise FirecrawlError("FIRECRAWL_API_KEY is not set")
    headers = {"Authorization": f"Bearer {settings.firecrawl_api_key}"}
    async with httpx.AsyncClient(transport=transport, timeout=120) as client:
        response = await client.post(f"{API_URL}{path}", json=body, headers=headers)
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if response.status_code >= 400 or not payload.get("success"):
        detail = payload.get("error") or response.text[:300]
        raise FirecrawlError(f"Firecrawl {path} returned {response.status_code}: {detail}")
    return payload["data"]


async def search(
    query: str,
    *,
    recent: bool = False,
    domains: list[str] | None = None,
    limit: int = 8,
    transport: httpx.AsyncBaseTransport | None = None,
) -> list[SearchResult]:
    """Web results for ``query``, optionally only from ``domains`` and the past month."""
    body: dict = {"query": query, "limit": limit, "sources": ["web"]}
    if recent:
        body["tbs"] = RECENT
    if domains:
        body["includeDomains"] = domains
    data = await _post("/search", body, transport)
    return [
        SearchResult(url=r["url"], title=r.get("title") or "", description=r.get("description") or "")
        for r in data.get("web", [])
        if r.get("url")
    ]


async def scrape(url: str, *, transport: httpx.AsyncBaseTransport | None = None) -> Page:
    """Fresh main-content Markdown of ``url`` (``maxAge=0`` bypasses Firecrawl's cache)."""
    data = await _post(
        "/scrape",
        {"url": url, "formats": ["markdown"], "onlyMainContent": True, "maxAge": 0},
        transport,
    )
    meta = data.get("metadata") or {}
    title = meta.get("title") or ""
    return Page(
        url=meta.get("sourceURL") or url,
        title=title[0] if isinstance(title, list) and title else str(title),
        markdown=data.get("markdown") or "",
        content_type=(meta.get("contentType") or "").split(";")[0].strip().lower(),
        status_code=int(meta.get("statusCode") or 200),
    )
