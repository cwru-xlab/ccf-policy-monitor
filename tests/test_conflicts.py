"""Conflict engine: id validation and response shaping, with the LLM and database mocked."""

import json
from datetime import UTC, date, datetime

import pytest

from policy_radar import conflicts, llm
from policy_radar.enums import ConflictCategory
from policy_radar.models import Guideline, GuidelineCriterion, Policy, PolicyCriterion

NOW = datetime(2026, 11, 3, tzinfo=UTC)

GUIDELINE = Guideline(
    guideline_id="g",
    source_key="uspstf",
    document_id="uspstf-abc",
    title="Colorectal Cancer: Screening",
    published=date(2021, 5, 18),
    criteria=(
        GuidelineCriterion(criterion_id="g:1", parent_id="g", text="Screen adults aged 45 to 49 years for colorectal cancer."),
        GuidelineCriterion(criterion_id="g:2", parent_id="g", text="Screen adults aged 50 to 75 years for colorectal cancer."),
        GuidelineCriterion(criterion_id="g:3", parent_id="g", text="CT colonography every 5 years is an acceptable screening strategy."),
    ),
)

POLICY = Policy(
    policy_number="0516",
    doc_type="medical_clinical_policy_bulletin",
    title="Colorectal Cancer Screening",
    coverage_effect="covered",
    effective_date=date(2026, 1, 1),
    document_id="cpb_upload-def",
    criteria=(
        PolicyCriterion(criterion_id="0516:1", parent_id="0516", text="Screening colonoscopy is medically necessary for members aged 50 to 75."),
        PolicyCriterion(criterion_id="0516:2", parent_id="0516", text="CT colonography is considered experimental and investigational for screening."),
    ),
)


def _match(gid, pid, category, g_quote="", p_quote=None, explanation="Policy is narrower."):
    return llm.ConflictMatch(
        guideline_criterion_id=gid, policy_criterion_id=pid, category=category,
        explanation=explanation, guideline_quote=g_quote, policy_quote=p_quote,
    )


def _shape(*matches):
    return conflicts.shape(llm.ConflictResult(conflicts=list(matches)), GUIDELINE, POLICY, "m", NOW)


def test_drops_ids_not_in_the_input():
    out = _shape(
        _match("g:9", "0516:1", "narrower_population"),  # invented guideline criterion
        _match("g:1", "0999:1", "narrower_population"),  # another policy's criterion
        _match("g:1", "0516:1", "narrower_population"),
    )
    assert [(c.guideline_criterion_id, c.policy_criterion_id) for c in out] == [("g:1", "0516:1")]


def test_missing_policy_side_is_a_coverage_gap():
    out = _shape(_match("g:1", None, "narrower_population", p_quote="ignored"))
    assert out[0].category == ConflictCategory.COVERAGE_GAP
    assert out[0].policy_criterion_id is None and out[0].policy_quote is None


def test_gap_citing_a_policy_criterion_drops_it():
    out = _shape(_match("g:3", "0516:2", "coverage_gap", p_quote="CT colonography"))
    assert (out[0].category, out[0].policy_criterion_id, out[0].policy_quote) == (
        ConflictCategory.COVERAGE_GAP, None, None)


def test_quotes_are_verbatim_or_the_whole_criterion():
    out = _shape(_match(
        "g:3", "0516:2", "opposite_stance",
        g_quote="ct  colonography every 5 years",  # case and spacing differ: still verbatim
        p_quote="CT colonography is not covered",  # paraphrase: replaced by the criterion text
    ))
    assert out[0].guideline_quote == "ct  colonography every 5 years"
    assert out[0].policy_quote == POLICY.criteria[1].text


def test_gap_is_dropped_when_the_criterion_has_a_real_conflict_and_duplicates_collapse():
    out = _shape(
        _match("g:3", None, "coverage_gap"),
        _match("g:3", "0516:2", "opposite_stance"),
        _match("g:3", "0516:2", "opposite_stance"),
        _match("g:1", None, "coverage_gap"),
    )
    assert [(c.guideline_criterion_id, c.category) for c in out] == [
        ("g:1", ConflictCategory.COVERAGE_GAP),
        ("g:3", ConflictCategory.OPPOSITE_STANCE),
    ]


@pytest.fixture
def saved(monkeypatch):
    calls = []

    async def save(guideline_id, policy_number, rows):
        calls.append((guideline_id, policy_number, rows))

    monkeypatch.setattr(conflicts.db, "save_conflicts", save)
    return calls


async def test_check_sends_only_the_linked_criteria_and_stores_the_result(monkeypatch, saved):
    payloads = []

    async def fake_llm(payload):
        payloads.append(json.loads(payload))
        return llm.ConflictResult(conflicts=[
            _match("g:1", None, "coverage_gap", g_quote="aged 45 to 49"),
            _match("g:2", "0516:7", "frequency_limit"),  # hallucinated policy id
        ])

    monkeypatch.setattr(conflicts.llm, "find_conflicts", fake_llm)
    report = await conflicts.check(GUIDELINE, POLICY)

    assert payloads == [{
        "guideline_criteria": [{"criterion_id": c.criterion_id, "text": c.text} for c in GUIDELINE.criteria],
        "policy_criteria": [{"criterion_id": c.criterion_id, "text": c.text} for c in POLICY.criteria],
    }]
    assert [c.guideline_criterion_id for c in report.conflicts] == ["g:1"]
    assert report.conflicts[0].guideline_quote == "aged 45 to 49"
    assert (report.guideline_criteria_checked, report.policy_criteria_checked) == (3, 2)
    assert report.model == conflicts.settings.comparison_model
    assert saved == [("g", "0516", report.conflicts)]


async def test_check_without_guideline_criteria_makes_no_llm_call(monkeypatch, saved):
    async def fail(_):
        raise AssertionError("LLM called")

    monkeypatch.setattr(conflicts.llm, "find_conflicts", fail)
    report = await conflicts.check(GUIDELINE.model_copy(update={"criteria": ()}), POLICY)
    assert report.conflicts == [] and saved == [("g", "0516", [])]
