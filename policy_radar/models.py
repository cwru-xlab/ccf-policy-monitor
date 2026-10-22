"""Domain models. One class per box in docs/BACKEND_SPEC.md's data-model diagram.

Each maps to one table in db/schema.sql. The two derived fields are
``needs_update`` on the two criterion classes (computed by the criterion query in db.py)
and ``Policy.watched_triggers`` (computed from ``doc_type`` below).
"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from policy_radar.enums import (
    STRENGTH_VALUES,
    AuthorityKind,
    CodeSystem,
    CoverageEffect,
    PolicyDocumentType,
    StrengthSystem,
    TriggerType,
    UpdateKind,
    UpdateOrigin,
    UpdateStatus,
)

_D = PolicyDocumentType
_T = TriggerType

# Which kinds of external change can send each policy type back into review.
# A routing hint only; it must never exclude a policy from matching.
WATCHED_TRIGGERS: dict[PolicyDocumentType, frozenset[TriggerType]] = {
    _D.MEDICAL_CLINICAL_POLICY_BULLETIN: frozenset(_T),
    _D.PHARMACY_CLINICAL_POLICY_BULLETIN: frozenset(
        {_T.DRUG_APPROVAL_OR_LABEL_CHANGE, _T.FEDERAL_RULEMAKING}
    ),
    _D.FORMULARY_AND_STEP_THERAPY: frozenset({_T.DRUG_APPROVAL_OR_LABEL_CHANGE}),
    _D.PREVENTIVE_CARE_SCHEDULE: frozenset(
        {_T.PREVENTIVE_RECOMMENDATION_CHANGE, _T.FEDERAL_RULEMAKING}
    ),
    _D.MEDICARE_ADVANTAGE_COVERAGE_OVERLAY: frozenset(
        {_T.MEDICARE_COVERAGE_DETERMINATION, _T.FEDERAL_RULEMAKING}
    ),
    _D.EXPERIMENTAL_INVESTIGATIONAL_EXCLUSION_LIST: frozenset(
        {_T.DRUG_APPROVAL_OR_LABEL_CHANGE, _T.DEVICE_APPROVAL_OR_SAFETY_ACTION}
    ),
}
"""Unlisted document types watch only federal rulemaking."""


class _Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class Source(_Frozen):
    """One endpoint or page we fetch from, and who stands behind it.

    ``authority_kind`` says how urgently its changes matter; ``trigger_type`` says which
    policies it can send back into review (see ``WATCHED_TRIGGERS``). Rows are seeded in
    db/schema.sql and every key in ``sources.SOURCES`` has one.
    """

    source_key: str = Field(min_length=1)
    name: str = Field(min_length=1)
    authority: str = Field(min_length=1)
    authority_kind: AuthorityKind
    trigger_type: TriggerType | None = None
    endpoint_url: str | None = None


class SourceDocument(_Frozen):
    """An immutable fetched or uploaded artifact; the bytes live at ``storage_uri``."""

    document_id: str = Field(min_length=1)
    source_key: str = Field(min_length=1)
    retrieved_at: datetime
    storage_uri: str = Field(min_length=1)
    content_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    media_type: str = Field(min_length=1)
    origin_url: str | None = None


class Code(_Frozen):
    """A billing or clinical code as the policy states it."""

    system: CodeSystem
    value: str = Field(min_length=1)


class _Criterion(_Frozen):
    """One testable condition. ``parent_id`` is the owning guideline or policy."""

    criterion_id: str = Field(min_length=1)
    parent_id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    concept_words: tuple[str, ...] = ()
    needs_update: bool = False


class GuidelineCriterion(_Criterion):
    """A condition atomized from a guideline; ``parent_id`` is its ``guideline_id``."""


class PolicyCriterion(_Criterion):
    """A condition parsed from a policy; ``parent_id`` is its ``policy_number``."""


class Guideline(_Frozen):
    """An external recommendation atomized into criteria.

    ``strength`` is a grade from the scheme named by ``strength_system``; USPSTF grades and
    ACC/AHA classes are not commensurable, so they are never normalised. Both are set or
    neither is, and the grade must belong to the system (``STRENGTH_VALUES``).
    """

    guideline_id: str = Field(min_length=1)
    source_key: str = Field(min_length=1)
    document_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    criteria: tuple[GuidelineCriterion, ...] = ()
    published: date
    version: str | None = None
    strength: str | None = None
    strength_system: StrengthSystem | None = None

    @model_validator(mode="after")
    def _strength_belongs_to_system(self) -> "Guideline":
        if (self.strength is None) != (self.strength_system is None):
            raise ValueError("strength and strength_system must be set together")
        if self.strength_system is not None:
            allowed = {m.value for m in STRENGTH_VALUES[self.strength_system]}
            if self.strength not in allowed:
                raise ValueError(
                    f"{self.strength!r} is not a {self.strength_system.value} grade: {sorted(allowed)}"
                )
        return self


class Policy(_Frozen):
    """A payer coverage policy (CPB) parsed into criteria and codes."""

    policy_number: str = Field(min_length=1)
    doc_type: PolicyDocumentType
    title: str = Field(min_length=1)
    criteria: tuple[PolicyCriterion, ...] = ()
    codes: tuple[Code, ...] = ()
    coverage_effect: CoverageEffect
    effective_date: date
    last_reviewed: date | None = None
    document_id: str = Field(min_length=1)

    @computed_field
    @property
    def watched_triggers(self) -> frozenset[TriggerType]:
        """Kinds of external change that can send this policy back into review."""
        return WATCHED_TRIGGERS.get(self.doc_type, frozenset({_T.FEDERAL_RULEMAKING}))


class _CriterionUpdate(_Frozen):
    """One proposed or applied change to a criterion, kept as its history."""

    update_id: str = Field(min_length=1)
    criterion_id: str = Field(min_length=1)
    kind: UpdateKind
    origin: UpdateOrigin
    document_id: str | None = None
    editor: str | None = None
    rationale: str = Field(min_length=1)
    recorded_at: datetime
    status: UpdateStatus = UpdateStatus.PENDING


class GuidelineCriterionUpdate(_CriterionUpdate):
    """History of a guideline criterion. ``revised`` is the proposed text when kind is revise."""

    revised: GuidelineCriterion | None = None


class PolicyCriterionUpdate(_CriterionUpdate):
    """History of a policy criterion. ``revised`` is the proposed text when kind is revise."""

    revised: PolicyCriterion | None = None


class CriterionMatch(_Frozen):
    """One guideline criterion aligned to one criterion of ``policy_number``, or to none."""

    guideline_criterion_id: str = Field(min_length=1)
    policy_number: str = Field(min_length=1)
    policy_criterion_id: str | None = None
    similarity: float = Field(ge=0.0, le=1.0)
    divergence: str | None = None
