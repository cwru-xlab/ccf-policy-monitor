"""CMS Medicare Coverage Database API (https://api.coverage.cms.gov/swagger-ui/index.html). Keyless for NCDs.

``reports/national-coverage-ncd/`` lists every NCD (ids are ints, ``last_updated_sort`` is
``YYYYMMDDhhmmss``); ``data/ncd/`` returns one NCD (ids are strings, dates ``MM/DD/YYYY``,
"N/A" or "" when absent, body text HTML-escaped). LCD detail needs a license-bound token and
is not used.
"""

from policy_radar.responses.base import CompactDate, MdyDate, ProviderModel


class NcdRow(ProviderModel):
    document_id: int
    document_version: int
    document_display_id: str  # e.g. "100.3"
    title: str
    last_updated_sort: CompactDate
    document_type: str | None = None
    chapter: str | None = None


class NcdReport(ProviderModel):
    data: tuple[NcdRow, ...]


class Ncd(ProviderModel):
    document_id: str
    document_version: int
    document_display_id: str
    title: str
    effective_date: MdyDate = None
    effective_end_date: MdyDate = None
    implementation_date: MdyDate = None
    benefit_category: str | None = None
    item_service_description: str | None = None
    indications_limitations: str | None = None


class NcdDetail(ProviderModel):
    data: tuple[Ncd, ...]
