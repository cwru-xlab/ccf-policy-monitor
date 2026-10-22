# Frontend spec — v0

Status: **proposed**. Wireframes: <https://claude.ai/artifact/WwSHQgWtZeY3tJ2mbhK41E>

Scope of v0: four screens, Next.js + TypeScript, mock data only, no auth. The backend
contract in [Data the UI needs](#data-the-ui-needs) is the deliverable that outlives the mock —
it is what the Python side must eventually serve.

Keep this file in step with the code. A screen changed without its entry here changed twice.

Review is a separate Next.js frontend; the FastAPI backend in `docs/BACKEND_SPEC.md`
supplies it over HTTP.

## Screens

### 1. First run — choose folder

Shown once, when no folder is remembered.

- One text input holding a folder path, a `Browse…` button, a `Continue` button.
- Copy states that the folder is read once and remembered. It must not promise that
  nothing leaves the machine: the CPB parsing pipeline sends policy text to an LLM
  for structuring, and comparison is an LLM call too.
- On continue: persist the path, go to Home. Every later launch skips this screen.

**Constraint.** A browser cannot read an arbitrary local path. v0 treats the path as a
string: typed or pasted, held in `localStorage`, and read server-side by a route handler
when the backend exists. `Browse…` is inert in v0. The alternative — the File System
Access API — is Chromium-only and is not assumed.

### 2. Home

Two panes, no borders, separated by whitespace.

- **Left, `Check updates`** — one row per guideline source: name, last-checked time, and a
  count of new changes (or `No change`). A `Check now` button sits in the pane header.
- **Right, `Affected policies`** — tiles of CPB number, title, source, count of affected
  criteria, and the affected score as a bar plus a number. **Sorted by score, descending.**
  A severity dot leads each tile. Home shows the top N by score; the list shows all.
- The right pane header carries `All affected policies →`, which opens the policy list.
  (The brief said "right button"; this is the reading taken — one CTA at the right end of
  the right pane header, not a per-tile chevron.)
- A tile opens that policy's detail view.

### 3. Policy list

Three borderless columns — **high, medium, low, left to right** — each scrolling
independently, each headed by its severity and a count. Tiles carry CPB number, score,
title, source and affected-criteria count. A tile opens the detail view.

### 4. Policy detail

- Header: CPB number, document type, effective and last-reviewed dates, title.
- CPB summary paragraph, then `Read the full policy ↗` to the source document.
- `Guidelines affecting this policy` — a row of **source tiles**, one per guideline source
  affecting this policy. A tile carries the source name, its version transition, the change
  kind, and the criterion it touches. Exactly one tile is selected; the selected tile is
  white with a 2px accent border against flat unselected tiles, and carries `aria-pressed`.
  The first tile is selected on load.
- Selecting a tile swaps the **comparison panel** below it. It is a prose comparison, not a
  code diff — line numbers, `+`/`-` gutters and tinted rows were tried and dropped, because
  they imply two versions of one file and these are two different documents.
  - The panel opens with the **affected criterion** as its heading: serif, 23px, 600, in the
    criterion colour. Under it, one muted mono line: source, version transition, change kind.
  - Two columns of ordinary prose, 16px, labelled `IN THE POLICY` and `IN THE GUIDELINE`,
    with a single `→` between them so the pair reads as one statement.
  - Inside each paragraph, **the operative clause is bold and coloured** — the policy clause
    in the policy colour, the guideline clause in the guideline colour. Nothing else on the
    panel is coloured, so the eye lands on the two clauses and the criterion heading.
  - Each column ends with its own citation, in mono.
- **Three colours, three fixed roles.** Criterion `#6B3A62`, policy clause `#9E3B2C`,
  guideline clause `#2E5A4E`. The criterion colour also marks the criterion label on every
  source tile, so a tile and its panel agree at a glance. All three pass 4.5:1 on white.
- Colour is never the only signal: the column labels and the citations carry it too.
- Below the comparison: `Why this changes the policy`, then the citation for both sides.
- A source affecting several criteria stacks one comparison block per criterion in its panel.

**Invariant.** One criterion, one guideline. Several guidelines may affect *different*
criteria of the same policy; two may never be shown against the same criterion. For a
single policy, the `criterion_ids` of its findings are pairwise disjoint. Reconciliation
happens before the UI, and the mock fixtures obey this.

This is stricter than the brief, which forbade only *conflicting* pairs. v0 merges any
pair landing on one criterion into a single finding, so the UI never has to render two
and never has to decide whether two agree.

## Data the UI needs

The backend is specified in `docs/BACKEND_SPEC.md`. This maps UI elements onto it.

### Served by the backend today

| UI element | Source |
|---|---|
| Policy title, CPB number, dates, type | `GET /policies/{n}` → `title`, `policy_number`, `effective_date`, `last_reviewed`, `doc_type` |
| Diff, left column | `Policy.criteria[].text` |
| Guideline source names, authority and kind | `GET /sources` → `source_key`, `name`, `authority`, `authority_kind`; `Guideline.source_key` |
| Guideline criteria | `GET /guidelines/{id}` → `criteria[].text` |

### Waits on the matching step (not yet designed)

The design stores these in `criterion_match` and the two `*_criterion_update` tables, which nothing writes yet:
which policy criteria a guideline change affects, the diff's right column
(`*CriterionUpdate.revised`), the change kind (`*CriterionUpdate.kind`), the explanation
(`CriterionMatch.divergence` or `*CriterionUpdate.rationale`), and `needs_update` on each criterion.

### Mocked now, needs a backend decision

1. **Affected score** (`0–100`, the sort key on Home). No such field exists.
2. **Severity tier** (`high` / `medium` / `low`). Either a cut on the score or its own field.
3. **CPB summary.** No summary field on `Policy`.
4. **Source last-checked time and new-change count** on Home. Derivable from
   `source_document.retrieved_at` and the `job` table, but no endpoint serves them yet.
5. **Operative-clause offsets** for the bold coloured clause. Nothing carries character spans.
6. **Readable `Read the full policy` link.** Uploaded CPBs have no `origin_url`; the file is
   in object storage but no endpoint serves it yet.

Items 1, 2 and 5 are the ones that will hurt if they are settled by the frontend's mock
fixtures rather than by the model.

## Out of scope for v0

Auth, multi-user state, editing or approving findings, writing back to the policy
documents. Matching is unimplemented — the UI reads fixtures with the shapes above.
