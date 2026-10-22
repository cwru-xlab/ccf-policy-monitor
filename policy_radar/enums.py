"""Controlled vocabularies. db/schema.sql check constraints mirror these values."""

from enum import StrEnum


class PolicyDocumentType(StrEnum):
    """Categories of payer policy document, modelled on Aetna's taxonomy."""

    MEDICAL_CLINICAL_POLICY_BULLETIN = "medical_clinical_policy_bulletin"
    DENTAL_CLINICAL_POLICY_BULLETIN = "dental_clinical_policy_bulletin"
    PHARMACY_CLINICAL_POLICY_BULLETIN = "pharmacy_clinical_policy_bulletin"
    CPB_STATE_DEVIATION = "cpb_state_deviation"
    PRECERTIFICATION_CODE_LIST = "precertification_code_list"
    REIMBURSEMENT_PAYMENT_POLICY = "reimbursement_payment_policy"
    PROVIDER_MANUAL = "provider_manual"
    FORMULARY_AND_STEP_THERAPY = "formulary_and_step_therapy"
    MEDICARE_ADVANTAGE_COVERAGE_OVERLAY = "medicare_advantage_coverage_overlay"
    BEHAVIORAL_HEALTH_LEVEL_OF_CARE_CRITERIA = "behavioral_health_level_of_care_criteria"
    UM_LEVEL_OF_CARE_GUIDELINE = "um_level_of_care_guideline"
    PREVENTIVE_CARE_SCHEDULE = "preventive_care_schedule"
    EXPERIMENTAL_INVESTIGATIONAL_EXCLUSION_LIST = "experimental_investigational_exclusion_list"
    PLAN_DOCUMENT_SPD = "plan_document_spd"


class CoverageEffect(StrEnum):
    """What a policy does to a claim. Distinct from a guideline's recommendation strength."""

    COVERED = "covered"
    COVERED_WITH_PRIOR_AUTH = "covered_with_prior_auth"
    NOT_COVERED = "not_covered"
    EXPERIMENTAL_INVESTIGATIONAL = "experimental_investigational"
    COSMETIC = "cosmetic"


class CodeSystem(StrEnum):
    """Code vocabularies a policy may list."""

    CPT = "cpt"
    HCPCS = "hcpcs"
    ICD10CM = "icd10cm"
    NDC = "ndc"
    RXNORM = "rxnorm"
    CDT = "cdt"
    LOINC = "loinc"


class TriggerType(StrEnum):
    """The class of external change that can send a policy back into review."""

    PREVENTIVE_RECOMMENDATION_CHANGE = "preventive_recommendation_change"
    DRUG_APPROVAL_OR_LABEL_CHANGE = "drug_approval_or_label_change"
    DEVICE_APPROVAL_OR_SAFETY_ACTION = "device_approval_or_safety_action"
    SPECIALTY_GUIDELINE_UPDATE = "specialty_guideline_update"
    MEDICARE_COVERAGE_DETERMINATION = "medicare_coverage_determination"
    FEDERAL_RULEMAKING = "federal_rulemaking"


class AuthorityKind(StrEnum):
    """What kind of body a source is, which sets how urgently its changes matter."""

    MEDICAL_SOCIETY = "medical_society"
    """Proposes practice changes. A change may lead to a policy change but is not urgent."""
    FEDERAL_RECOMMENDATION = "federal_recommendation"
    """A federal body (or one it convenes) that recommends; it does not bind payers directly."""
    FEDERAL_REQUIREMENT = "federal_requirement"
    """Binding federal rules, coverage determinations and approvals. Active changes are tracked."""
    PAYER_POLICY = "payer_policy"
    """The payer's own uploaded policy documents."""


class StrengthSystem(StrEnum):
    """Grading schemes whose grades are modelled. A scheme not listed is stored as no strength."""

    USPSTF = "uspstf"
    ACC_AHA = "acc_aha"
    GRADE = "grade"


class UspstfGrade(StrEnum):
    """USPSTF letter grades (definitions in force since July 2012)."""

    A = "A"
    B = "B"
    C = "C"
    D = "D"
    I = "I"  # the grade is literally "I" (insufficient evidence)


class AccAhaClass(StrEnum):
    """ACC/AHA class of recommendation. Level of evidence (A, B-R, B-NR, C-LD, C-EO) is a
    separate axis and is not stored."""

    ONE = "1"
    TWO_A = "2a"
    TWO_B = "2b"
    THREE_NO_BENEFIT = "3_no_benefit"
    THREE_HARM = "3_harm"


class GradeStrength(StrEnum):
    """GRADE strength of recommendation. Certainty of evidence is a separate axis, not stored."""

    STRONG = "strong"
    CONDITIONAL = "conditional"


STRENGTH_VALUES: dict[StrengthSystem, type[StrEnum]] = {
    StrengthSystem.USPSTF: UspstfGrade,
    StrengthSystem.ACC_AHA: AccAhaClass,
    StrengthSystem.GRADE: GradeStrength,
}
"""The grades each system allows. Grades from different systems are never compared."""


class UpdateKind(StrEnum):
    """What a criterion update proposes to do to its criterion."""

    REVISE = "revise"
    RETIRE = "retire"


class UpdateOrigin(StrEnum):
    """Who raised a criterion update."""

    GUIDELINE_CHANGE = "guideline_change"
    MANUAL = "manual"


class UpdateStatus(StrEnum):
    """Review state of a criterion update."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class JobKind(StrEnum):
    """The three background pipelines."""

    INGEST = "ingest"
    ATOMIZE = "atomize"
    PARSE_CPB = "parse_cpb"


class JobStatus(StrEnum):
    """Lifecycle of a background job."""

    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
