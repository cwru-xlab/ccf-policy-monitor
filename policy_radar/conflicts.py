"""The conflict engine: where a user-linked payer policy falls short of a guideline.

The guideline-policy link comes from the user (the app's mappings); this module never looks
at a policy it was not handed. Each (guideline, policy) pair is one structured LLM call over
the two criteria lists (``llm.find_conflicts``, the notebook's arm B); everything here is the
deterministic part: drop ids the model invented, keep quotes verbatim, shape the result.
"""

import logging
from datetime import UTC, datetime

from pydantic import BaseModel

from policy_radar import db, llm
from policy_radar.config import settings
from policy_radar.enums import ConflictCategory
from policy_radar.models import CriterionConflict, Guideline, Policy

log = logging.getLogger(__name__)


class ConflictReport(BaseModel):
    """The conflicts found for one (guideline, policy) pair. An empty ``conflicts`` list means
    the check ran and found none."""

    guideline_id: str
    guideline_title: str
    guideline_document_id: str
    policy_number: str
    policy_title: str
    policy_document_id: str
    model: str
    checked_at: datetime
    guideline_criteria_checked: int
    policy_criteria_checked: int
    conflicts: list[CriterionConflict]


def _criteria_json(criteria) -> list[dict]:
    return [{"criterion_id": c.criterion_id, "text": c.text} for c in criteria]


def _norm(text: str) -> str:
    return " ".join(text.split()).casefold()


def verbatim(quote: str | None, text: str) -> str:
    """``quote`` if it occurs in ``text`` (ignoring case and spacing), else the whole text,
    so a paraphrase from the model is never shown as a quotation."""
    if quote and quote.strip() and _norm(quote) in _norm(text):
        return quote.strip()
    return text


def shape(
    result: llm.ConflictResult,
    guideline: Guideline,
    policy: Policy,
    model: str,
    checked_at: datetime,
) -> list[CriterionConflict]:
    """Validate the model's matches against the input criteria and turn them into conflicts.

    Drops matches citing an id that was not in the input. A match with no policy criterion is
    a coverage gap whatever category the model gave; a gap that cites a policy criterion loses
    it. A gap is dropped when the same guideline criterion also has a real conflict, since the
    policy then does address it. Duplicates are removed; order follows the documents."""
    g_pos = {c.criterion_id: i for i, c in enumerate(guideline.criteria)}
    p_pos = {c.criterion_id: i for i, c in enumerate(policy.criteria)}
    g_text = {c.criterion_id: c.text for c in guideline.criteria}
    p_text = {c.criterion_id: c.text for c in policy.criteria}

    kept: dict[tuple, CriterionConflict] = {}
    for m in result.conflicts:
        gid, pid = m.guideline_criterion_id, m.policy_criterion_id
        if gid not in g_text or (pid is not None and pid not in p_text):
            log.warning("dropping conflict with unknown criterion id: %s / %s", gid, pid)
            continue
        if pid is None or m.category == ConflictCategory.COVERAGE_GAP:
            pid, category = None, ConflictCategory.COVERAGE_GAP
        else:
            category = m.category
        key = (gid, pid, category)
        if key in kept:
            continue
        kept[key] = CriterionConflict(
            guideline_criterion_id=gid,
            policy_number=policy.policy_number,
            policy_criterion_id=pid,
            category=category,
            explanation=m.explanation.strip() or "No explanation given.",
            guideline_quote=verbatim(m.guideline_quote, g_text[gid]),
            policy_quote=None if pid is None else verbatim(m.policy_quote, p_text[pid]),
            model=model,
            checked_at=checked_at,
        )

    addressed = {gid for gid, pid, _ in kept if pid is not None}
    conflicts = [c for (gid, pid, _), c in kept.items() if pid is not None or gid not in addressed]
    return sorted(
        conflicts,
        key=lambda c: (
            g_pos[c.guideline_criterion_id],
            -1 if c.policy_criterion_id is None else p_pos[c.policy_criterion_id],
        ),
    )


async def check(guideline: Guideline, policy: Policy) -> ConflictReport:
    """Run the conflict check for one user-linked pair and store its result."""
    checked_at = datetime.now(UTC)
    model = settings.comparison_model
    conflicts: list[CriterionConflict] = []
    if guideline.criteria:  # nothing to compare, so no LLM call
        payload = llm.conflict_payload(
            _criteria_json(guideline.criteria), _criteria_json(policy.criteria)
        )
        result = await llm.find_conflicts(payload)
        conflicts = shape(result, guideline, policy, model, checked_at)
    await db.save_conflicts(guideline.guideline_id, policy.policy_number, conflicts)
    return ConflictReport(
        guideline_id=guideline.guideline_id,
        guideline_title=guideline.title,
        guideline_document_id=guideline.document_id,
        policy_number=policy.policy_number,
        policy_title=policy.title,
        policy_document_id=policy.document_id,
        model=model,
        checked_at=checked_at,
        guideline_criteria_checked=len(guideline.criteria),
        policy_criteria_checked=len(policy.criteria),
        conflicts=conflicts,
    )
