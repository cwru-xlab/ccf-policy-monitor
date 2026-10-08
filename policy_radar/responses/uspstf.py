"""USPSTF Prevention TaskForce API (https://data.uspreventiveservicestaskforce.org/api/json). Free key, by request.

NOT yet validated against real content: no key was available when this was written. The
envelope and field names come from the API's no-key reply (HTTP 202, every text field
replaced by ``apiKeyWarning``), captured in tests/fixtures/uspstf_nokey_placeholder.json.
Re-capture with a real key and tighten the types before relying on them.
"""

from pydantic import Field

from policy_radar.responses.base import ProviderModel


class SpecificRecommendation(ProviderModel):
    id: int
    general: str  # key into ``generalRecommendations``
    title: str
    grade: str  # A, B, C, D or I
    text: str | None = None
    rationale: str | None = None


class GeneralRecommendation(ProviderModel):
    uspstf_alias: str = Field(alias="uspstfAlias")  # URL slug of the recommendation page
    title: str
    topic_year: int | None = Field(default=None, alias="topicYear")


class Response(ProviderModel):
    api_key_warning: str | None = Field(default=None, alias="apiKeyWarning")
    specific_recommendations: tuple[SpecificRecommendation, ...] = Field(alias="specificRecommendations")
    general_recommendations: dict[str, GeneralRecommendation] = Field(alias="generalRecommendations")
