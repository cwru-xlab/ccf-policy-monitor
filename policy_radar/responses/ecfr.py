"""eCFR versioner ``versions/title-N.json`` (https://www.ecfr.gov/developers/documentation/api/v1). Keyless.

Paginated: ``meta.per_page`` is 1000 and ``meta.total_pages`` says how many pages exist.
Section text (``full/{date}/title-N.xml``) is XML stored as served and not modelled.
"""

from datetime import date

from policy_radar.responses.base import ProviderModel


class Meta(ProviderModel):
    title: str
    result_count: int
    page: int = 1  # page, per_page and total_pages are absent when everything fits on one page
    per_page: int | None = None
    total_pages: int = 1
    latest_amendment_date: date | None = None
    latest_issue_date: date | None = None


class Version(ProviderModel):
    """One dated version of one section. ``date`` is the version date used to fetch its text."""

    identifier: str  # the section number, e.g. "405.1801"
    part: str
    date: date
    amendment_date: date
    issue_date: date
    substantive: bool
    removed: bool
    name: str | None = None
    subpart: str | None = None
    type: str | None = None


class VersionList(ProviderModel):
    meta: Meta | None = None
    content_versions: tuple[Version, ...]
