"""openFDA ``drug/label`` and ``device/510k`` (https://open.fda.gov/apis/). Keyless; a key raises quota.

A page is ``{"meta": {...}, "results": [record, ...]}``. "No matches" is HTTP 404, not an
empty page. Label records carry hundreds of optional section fields (kept as extras); only
the ones below are typed.
"""

from policy_radar.responses.base import CompactDate, ProviderModel


class ResultsMeta(ProviderModel):
    skip: int
    limit: int
    total: int


class Meta(ProviderModel):
    last_updated: str | None = None
    results: ResultsMeta


class DrugLabel(ProviderModel):
    """One structured-product-labeling version. ``effective_time`` is ``YYYYMMDD``."""

    set_id: str  # stable across versions of one label
    id: str  # this version
    version: str | None = None
    effective_time: CompactDate
    indications_and_usage: tuple[str, ...] | None = None
    dosage_and_administration: tuple[str, ...] | None = None
    warnings: tuple[str, ...] | None = None


class Device510k(ProviderModel):
    """One 510(k) decision. ``decision_date`` is ISO ``YYYY-MM-DD``."""

    k_number: str
    decision_date: CompactDate
    date_received: CompactDate | None = None
    device_name: str | None = None
    applicant: str | None = None
    decision_code: str | None = None
    clearance_type: str | None = None
    statement_or_summary: str | None = None


class DrugLabelPage(ProviderModel):
    meta: Meta
    results: tuple[DrugLabel, ...]


class Device510kPage(ProviderModel):
    meta: Meta
    results: tuple[Device510k, ...]


