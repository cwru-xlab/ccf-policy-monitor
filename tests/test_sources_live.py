"""Real requests to the keyless endpoints. Run with: pytest -m live

Each connector runs end to end (request, validate with its response model, return the
document) with the record cap cut to 3 so a run is a few dozen requests. USPSTF needs a key
and is skipped without one.
"""

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from policy_radar import sources
from policy_radar.config import settings

pytestmark = pytest.mark.live

CAP = 3
SINCE = (datetime.now(UTC) - timedelta(days=14)).date()


@pytest.fixture
async def live(monkeypatch):
    monkeypatch.setattr(sources, "MAX_RECORDS_PER_ENDPOINT", CAP)
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        yield c


def assert_documents(fetched: list[sources.Fetched], media_type: str) -> None:
    assert 0 < len(fetched) <= CAP
    for f in fetched:
        assert f.content and f.media_type == media_type and f.origin_url.startswith("https://")


async def test_openfda_drug_label(live):
    fetched = await sources.openfda_drug_label(live, SINCE)
    assert_documents(fetched, "application/json")
    assert "set_id" in json.loads(fetched[0].content)


async def test_openfda_device_510k(live):
    fetched = await sources.openfda_device_510k(live, SINCE)
    assert_documents(fetched, "application/json")
    assert "k_number" in json.loads(fetched[0].content)


async def test_federal_register(live):
    fetched = await sources.federal_register(live, SINCE)
    assert_documents(fetched, "text/plain")
    assert b"Federal Register" in fetched[0].content


async def test_ecfr(live):
    fetched = await sources.ecfr(live, SINCE)
    assert fetched and len(fetched) <= CAP * len(sources.ECFR_TITLES)
    assert all(f.media_type == "application/xml" and b"<DIV8" in f.content for f in fetched)


async def test_cms_coverage(live):
    # NCDs change rarely, so look back far enough to find some; the cap bounds the detail calls
    fetched = await sources.cms_coverage(live, (datetime.now(UTC) - timedelta(days=730)).date())
    assert_documents(fetched, "application/json")


async def test_pubmed(live):
    fetched = await sources.pubmed(live, SINCE)
    assert_documents(fetched, "application/xml")
    assert b"Practice Guideline" in fetched[0].content


@pytest.mark.skipif(not settings.uspstf_api_key, reason="USPSTF_API_KEY not set")
async def test_uspstf(live):
    fetched = await sources.uspstf(live, SINCE)
    assert fetched and all(f.media_type == "application/json" for f in fetched)
