"""db/schema.sql and the Python models must describe the same tables."""

import re
from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

from policy_radar import models
from policy_radar.db import CPB_SOURCE_KEY
from policy_radar.enums import (
    STRENGTH_VALUES,
    AuthorityKind,
    CodeSystem,
    CoverageEffect,
    JobKind,
    JobStatus,
    PolicyDocumentType,
    StrengthSystem,
    TriggerType,
    UpdateKind,
    UpdateOrigin,
    UpdateStatus,
)
from policy_radar.sources import SOURCES

SCHEMA = (Path(__file__).parent.parent / "db" / "schema.sql").read_text()


def _body(table: str) -> str:
    return re.search(rf"create table if not exists {table} \((.*?)\n\);", SCHEMA, re.DOTALL).group(1)


def _columns(table: str) -> set[str]:
    names = re.findall(r"^\s{4}(\w+)\s", _body(table), re.MULTILINE)
    return set(names) - {"check", "unique", "primary"}


def _check_values(table: str, column: str) -> set[str]:
    clause = re.search(
        rf"\b{column}\b[^\n]*check \({column} in \((.*?)\)\)", _body(table), re.DOTALL
    ).group(1)
    return set(re.findall(r"'(\w+)'", clause))


_UPDATE_TABLES = ("guideline_criterion_update", "policy_criterion_update")


@pytest.mark.parametrize(
    "table, column, enum",
    [
        ("policy", "doc_type", PolicyDocumentType),
        ("policy", "coverage_effect", CoverageEffect),
        ("code", "system", CodeSystem),
        ("source", "authority_kind", AuthorityKind),
        ("source", "trigger_type", TriggerType),
        ("guideline", "strength_system", StrengthSystem),
        *[(t, "kind", UpdateKind) for t in _UPDATE_TABLES],
        *[(t, "origin", UpdateOrigin) for t in _UPDATE_TABLES],
        *[(t, "status", UpdateStatus) for t in _UPDATE_TABLES],
        ("job", "kind", JobKind),
        ("job", "status", JobStatus),
    ],
)
def test_check_constraints_match_enums(table, column, enum):
    assert _check_values(table, column) == {m.value for m in enum}


_CRITERION_DB_ONLY = {"position", "embedding"}


@pytest.mark.parametrize(
    "table, model, not_stored, db_only",
    [
        ("source", models.Source, set(), set()),
        ("source_document", models.SourceDocument, set(), set()),
        ("guideline", models.Guideline, {"criteria"}, set()),
        ("policy", models.Policy, {"criteria", "codes"}, set()),
        ("guideline_criterion", models.GuidelineCriterion, {"needs_update"}, _CRITERION_DB_ONLY),
        ("policy_criterion", models.PolicyCriterion, {"needs_update"}, _CRITERION_DB_ONLY),
        ("code", models.Code, set(), {"policy_number"}),
        ("guideline_criterion_update", models.GuidelineCriterionUpdate, set(), set()),
        ("policy_criterion_update", models.PolicyCriterionUpdate, set(), set()),
        ("criterion_match", models.CriterionMatch, set(), {"match_id"}),
    ],
)
def test_tables_match_models(table, model, not_stored, db_only):
    assert _columns(table) - db_only == set(model.model_fields) - not_stored


@pytest.mark.parametrize("system", list(StrengthSystem))
def test_strength_pair_check_matches_enums(system):
    clause = re.search(
        rf"strength_system = '{system.value}' and strength in \((.*?)\)", _body("guideline"), re.DOTALL
    ).group(1)
    assert set(re.findall(r"'(\w+)'", clause)) == {m.value for m in STRENGTH_VALUES[system]}


def _source_seed() -> dict[str, tuple[str, str | None]]:
    """source_key -> (authority_kind, trigger_type) for each seeded `source` row."""
    rows = re.findall(
        r"^\s+\('(\w+)', '[^']*', '[^']*', '(\w+)', (?:'(\w+)'|null), (?:'[^']*'|null)\)",
        SCHEMA,
        re.MULTILINE,
    )
    return {key: (kind, trigger or None) for key, kind, trigger in rows}


def test_every_source_is_seeded_and_every_seed_is_a_source():
    assert set(_source_seed()) == set(SOURCES) | {CPB_SOURCE_KEY}


def test_seeded_sources_use_known_vocabulary():
    for kind, trigger in _source_seed().values():
        AuthorityKind(kind)
        if trigger is not None:
            TriggerType(trigger)


def _guideline(**strength) -> models.Guideline:
    return models.Guideline(
        guideline_id="g", source_key="uspstf", document_id="d", title="t",
        published=date(2026, 1, 1), **strength,
    )


@pytest.mark.parametrize(
    "system, value",
    [(s, next(iter(STRENGTH_VALUES[s])).value) for s in StrengthSystem] + [(None, None)],
)
def test_guideline_accepts_a_grade_from_its_own_system(system, value):
    assert _guideline(strength=value, strength_system=system).strength == value


@pytest.mark.parametrize(
    "strength, system",
    [("A", StrengthSystem.ACC_AHA), ("strong", StrengthSystem.USPSTF), ("A", None),
     (None, StrengthSystem.USPSTF)],
)
def test_guideline_rejects_a_grade_outside_its_system(strength, system):
    with pytest.raises(ValidationError):
        _guideline(strength=strength, strength_system=system)
