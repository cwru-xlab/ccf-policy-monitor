"""USPSTF Prevention TaskForce API (https://data.uspreventiveservicestaskforce.org/api/json). Free key, by request.

NOT yet validated against real content: no key was available when this was written. The
envelope and field names come from the API's no-key reply (HTTP 202, every text field
replaced by ``apiKeyWarning``), captured in tests/fixtures/uspstf_nokey_placeholder.json.
Types are deliberately loose (only ``general`` is required). Re-capture with a real key and
tighten them before relying on them.
"""

from pydantic import ConfigDict, Field

from policy_radar.responses.base import ProviderModel


class SpecificRecommendation(ProviderModel):
    """Only ``general`` is required: it is the one field a connector reads. The rest is
    optional until real content has been seen."""

    model_config = ConfigDict(frozen=True, extra="allow", coerce_numbers_to_str=True)

    id: int | str | None = None
    general: str  # key into ``generalRecommendations``; an int or a string on the wire
    title: str | None = None
    grade: str | None = None  # A, B, C, D or I
    text: str | None = None
    rationale: str | None = None


class GeneralRecommendation(ProviderModel):
    uspstf_alias: str | None = Field(default=None, alias="uspstfAlias")  # URL slug of the page
    title: str | None = None
    topic_year: int | None = Field(default=None, alias="topicYear")


class Response(ProviderModel):
    api_key_warning: str | None = Field(default=None, alias="apiKeyWarning")
    specific_recommendations: tuple[SpecificRecommendation, ...] = Field(alias="specificRecommendations")
    general_recommendations: dict[str, GeneralRecommendation] = Field(alias="generalRecommendations")
