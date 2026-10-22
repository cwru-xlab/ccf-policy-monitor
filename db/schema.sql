-- Policy Radar schema. Single source of truth for both Supabase and the app.
-- Apply with:  uv run python scripts/create_schema.py   (or paste into the Supabase SQL editor)
-- Every statement is idempotent, so re-running is safe.
-- Enum-valued columns are text + check; the allowed values mirror policy_radar/enums.py
-- (tests/test_schema.py fails if the two drift).

create extension if not exists vector;

-- Every endpoint or page we fetch from, and who stands behind it. authority_kind sets
-- how urgently its changes matter; trigger_type says which policies they can send back
-- into review. Seeded below: one row per key in policy_radar/sources.py SOURCES, plus
-- 'cpb_upload' (tests/test_schema.py fails if the two drift).
create table if not exists source (
    source_key      text primary key,
    name            text not null,
    authority       text not null,                  -- the body, e.g. 'U.S. Preventive Services Task Force'
    authority_kind  text not null check (authority_kind in (
        'medical_society',          -- proposes changes; not urgent
        'federal_recommendation',   -- recommends
        'federal_requirement',      -- binding; active changes are tracked
        'payer_policy')),
    trigger_type    text check (trigger_type in (
        'preventive_recommendation_change', 'drug_approval_or_label_change',
        'device_approval_or_safety_action', 'specialty_guideline_update',
        'medicare_coverage_determination', 'federal_rulemaking')),
    endpoint_url    text                            -- null for uploads
);

insert into source (source_key, name, authority, authority_kind, trigger_type, endpoint_url)
values
    ('openfda_drug_label', 'openFDA drug labels', 'U.S. Food and Drug Administration', 'federal_requirement', 'drug_approval_or_label_change', 'https://api.fda.gov/drug/label.json'),
    ('openfda_device_510k', 'openFDA 510(k) clearances', 'U.S. Food and Drug Administration', 'federal_requirement', 'device_approval_or_safety_action', 'https://api.fda.gov/device/510k.json'),
    ('federal_register', 'Federal Register rules', 'HHS, CMS and FDA, published by the Office of the Federal Register', 'federal_requirement', 'federal_rulemaking', 'https://www.federalregister.gov/api/v1/documents.json'),
    ('ecfr', 'eCFR titles 42 and 45', 'Office of the Federal Register (HHS and CMS regulations)', 'federal_requirement', 'federal_rulemaking', 'https://www.ecfr.gov/api/versioner/v1'),
    ('cms_coverage', 'CMS National Coverage Determinations', 'Centers for Medicare & Medicaid Services', 'federal_requirement', 'medicare_coverage_determination', 'https://api.coverage.cms.gov/v1'),
    ('uspstf', 'USPSTF recommendations', 'U.S. Preventive Services Task Force', 'federal_recommendation', 'preventive_recommendation_change', 'https://data.uspreventiveservicestaskforce.org/api/json'),
    ('cdc_acip_adult', 'CDC ACIP adult immunization schedule', 'CDC Advisory Committee on Immunization Practices', 'federal_recommendation', 'preventive_recommendation_change', 'https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-age.html'),
    ('cdc_acip_child', 'CDC ACIP child and adolescent immunization schedule', 'CDC Advisory Committee on Immunization Practices', 'federal_recommendation', 'preventive_recommendation_change', 'https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html'),
    ('pubmed', 'PubMed practice guidelines', 'Medical societies and expert panels, indexed by the National Library of Medicine', 'medical_society', 'specialty_guideline_update', 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'),
    ('cpb_upload', 'Uploaded payer CPBs', 'Payer (uploaded by a user)', 'payer_policy', null, null)
on conflict (source_key) do update set
    name = excluded.name, authority = excluded.authority,
    authority_kind = excluded.authority_kind, trigger_type = excluded.trigger_type,
    endpoint_url = excluded.endpoint_url;

-- One immutable fetched or uploaded artifact. Raw bytes live in object storage at
-- storage_uri; the same bytes from the same source are stored once.
create table if not exists source_document (
    document_id     text primary key,               -- '{source_key}-{sha256[:16]}'
    source_key      text not null references source,
    retrieved_at    timestamptz not null default now(),
    storage_uri     text not null,                  -- object key: '{source_key}/{sha256}{ext}'
    content_sha256  char(64) not null,
    media_type      text not null,                  -- e.g. 'application/pdf'
    origin_url      text,
    unique (source_key, content_sha256)
);

-- A guideline atomized from exactly one source document.
create table if not exists guideline (
    guideline_id     text primary key,
    source_key       text not null references source,
    document_id      text not null unique references source_document on delete cascade,
    title            text not null,
    published        date not null,
    version          text,
    strength         text,                          -- a grade of strength_system, e.g. 'B'
    strength_system  text check (strength_system in ('uspstf', 'acc_aha', 'grade')),
    -- both or neither, and the grade must belong to the system (policy_radar/enums.py)
    check ((strength is null) = (strength_system is null)),
    check (strength is null
        or (strength_system = 'uspstf' and strength in ('A', 'B', 'C', 'D', 'I'))
        or (strength_system = 'acc_aha' and strength in (
            '1', '2a', '2b', '3_no_benefit', '3_harm'))
        or (strength_system = 'grade' and strength in ('strong', 'conditional')))
);

-- A payer policy (CPB) parsed from an uploaded source document.
-- Re-parsing the same policy_number replaces the row and its criteria.
create table if not exists policy (
    policy_number    text primary key,              -- e.g. '0584'
    doc_type         text not null check (doc_type in (
        'medical_clinical_policy_bulletin', 'dental_clinical_policy_bulletin',
        'pharmacy_clinical_policy_bulletin', 'cpb_state_deviation',
        'precertification_code_list', 'reimbursement_payment_policy', 'provider_manual',
        'formulary_and_step_therapy', 'medicare_advantage_coverage_overlay',
        'behavioral_health_level_of_care_criteria', 'um_level_of_care_guideline',
        'preventive_care_schedule', 'experimental_investigational_exclusion_list',
        'plan_document_spd')),
    title            text not null,
    coverage_effect  text not null check (coverage_effect in (
        'covered', 'covered_with_prior_auth', 'not_covered',
        'experimental_investigational', 'cosmetic')),
    effective_date   date not null,
    last_reviewed    date,
    document_id      text not null references source_document
);

-- One testable condition of a guideline, and of a policy. Same shape, separate tables so
-- each owner and its update history get a typed foreign key.
create table if not exists guideline_criterion (
    criterion_id   text primary key,                -- '{guideline_id}:{position}'
    parent_id      text not null references guideline on delete cascade,
    position       int not null,                    -- order within the guideline, from 1
    text           text not null,
    concept_words  text[] not null default '{}',
    embedding      vector(1536)                     -- OpenAI text-embedding-3-small
);
create index if not exists guideline_criterion_parent_idx on guideline_criterion (parent_id);
create index if not exists guideline_criterion_embedding_idx
    on guideline_criterion using hnsw (embedding vector_cosine_ops);

create table if not exists policy_criterion (
    criterion_id   text primary key,                -- '{policy_number}:{position}'
    parent_id      text not null references policy on delete cascade,
    position       int not null,
    text           text not null,
    concept_words  text[] not null default '{}',
    embedding      vector(1536)
);
create index if not exists policy_criterion_parent_idx on policy_criterion (parent_id);
create index if not exists policy_criterion_embedding_idx
    on policy_criterion using hnsw (embedding vector_cosine_ops);

-- Billing codes a policy lists.
create table if not exists code (
    policy_number  text not null references policy on delete cascade,
    system         text not null check (system in (
        'cpt', 'hcpcs', 'icd10cm', 'ndc', 'rxnorm', 'cdt', 'loinc')),
    value          text not null,
    primary key (policy_number, system, value)
);

-- History of proposed and applied changes to one criterion, one table per criterion type.
-- Written by the matching step, which is not specified yet; no code writes these today.
create table if not exists guideline_criterion_update (
    update_id     text primary key,
    criterion_id  text not null references guideline_criterion on delete cascade,
    kind          text not null check (kind in ('revise', 'retire')),
    origin        text not null check (origin in ('guideline_change', 'manual')),
    revised       jsonb,                             -- the proposed GuidelineCriterion, if kind = 'revise'
    document_id   text references source_document,  -- the guideline document that prompted it
    editor        text,
    rationale     text not null,
    recorded_at   timestamptz not null default now(),
    status        text not null default 'pending' check (status in (
        'pending', 'accepted', 'rejected'))
);
create index if not exists guideline_criterion_update_criterion_idx
    on guideline_criterion_update (criterion_id);

create table if not exists policy_criterion_update (
    update_id     text primary key,
    criterion_id  text not null references policy_criterion on delete cascade,
    kind          text not null check (kind in ('revise', 'retire')),
    origin        text not null check (origin in ('guideline_change', 'manual')),
    revised       jsonb,                             -- the proposed PolicyCriterion, if kind = 'revise'
    document_id   text references source_document,  -- the guideline document that prompted it
    editor        text,
    rationale     text not null,
    recorded_at   timestamptz not null default now(),
    status        text not null default 'pending' check (status in (
        'pending', 'accepted', 'rejected'))
);
create index if not exists policy_criterion_update_criterion_idx
    on policy_criterion_update (criterion_id);

-- One guideline criterion aligned to one policy criterion (or to none). policy_number is
-- kept because a null policy_criterion_id would otherwise lose which policy had no match.
-- Written by the matching step, which is not specified yet; no code writes this table today.
create table if not exists criterion_match (
    match_id                bigint generated always as identity primary key,
    guideline_criterion_id  text not null references guideline_criterion on delete cascade,
    policy_number           text not null references policy on delete cascade,
    policy_criterion_id     text references policy_criterion on delete cascade,
    similarity              real not null check (similarity between 0 and 1),
    divergence              text,
    unique nulls not distinct (guideline_criterion_id, policy_number, policy_criterion_id)
);

-- Status of one background pipeline run. Jobs run in the API process.
create table if not exists job (
    job_id       text primary key,
    kind         text not null check (kind in ('ingest', 'atomize', 'parse_cpb')),
    status       text not null default 'queued' check (status in (
        'queued', 'running', 'succeeded', 'failed')),
    detail       jsonb not null default '{}',       -- inputs and result counts
    error        text,
    created_at   timestamptz not null default now(),
    finished_at  timestamptz
);
