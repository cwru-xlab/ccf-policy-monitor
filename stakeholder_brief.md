# Stakeholder Meeting Brief

## Part 1: The 2-minute explanation (non-technical)

**Think of it as a filing cabinet that never overwrites anything and knows which folders relate to each other.**

**Storing.** Every time we collect a document, whether a clinical guideline or one of your coverage policies, we first save an untouched copy with a timestamp and a digital fingerprint. That's our proof of exactly what we saw and when.

From that copy we pull out the record itself. A *Guideline* or a *Policy* holds the basics: title, dates, source, and for policies the billing codes and coverage effect. Each one is then split into its individual **criteria**, the single rules or statements inside it, like "patient must have tried X before Y." Criteria are the unit we work with, because documents change one rule at a time, not as a whole.

**Connecting.** We then link each guideline criterion to the policy criterion that covers the same ground, with a similarity score and a note on where they differ. This is the bridge: when a guideline changes, we already know which policy language it touches.

**Updating.** Nothing is ever overwritten. When a guideline or policy criterion changes, we add an *update* record: what changed, the revised wording, where it came from (a new source document or a person's edit), who made it, the rationale, and its status (proposed, approved, and so on). The old version stays. When a guideline criterion is updated, the flag is carried to every matched policy criterion, so reviewers see "this policy language may now be out of date" instead of hunting for it.

**Result:** a complete, auditable history, and a short review list rather than a pile of documents.

---

## Part 2: Sample Q&A

### Q1. How do we get guidelines, and how often?
**A.** Two routes. Where a source offers an API, we pull from it directly. Where it doesn't, we use a purpose-built collector for that specific website. Either way, each document is saved with a fingerprint. On each check we compare fingerprints, and only a *changed* document is processed further.

Guidelines change rarely (months to years), so frequent checks are cheap. **Proposed cadence: daily for API sources, daily-to-weekly for scraped sources, tuned per source to how often it publishes.** *(Confirm the numbers with your team before the meeting; the design supports any cadence.)* Every check is logged, so we can always show "we looked on this date and nothing had changed."

### Q2. Why can't we just have AI agents do everything?
**A (short).** We do use AI, at the steps where judgment is needed. We don't let it run the whole pipeline because in a compliance setting you need results that are repeatable, explainable and never silently wrong. See the TLDR and both views below.

### Q3–Q10. Other likely questions

| Question | Short answer |
|---|---|
| How do we know matches are accurate? | We measure it. A reviewer-labeled sample set gives a hit rate we track. Every match shows its similarity score and the reason for any divergence. |
| Who approves a change? | A person. The system proposes (`status` on each update); a reviewer approves. Nothing changes a policy automatically. |
| What if a website changes and our collector breaks? | It fails loudly. We get an alert and the last good copy stays intact. Fixing it is a small, scoped job. |
| How hard is adding a new source? | One new collector or API connection plus a mapping into the same structure. Nothing downstream changes. |
| Can we see history and who changed what? | Yes. Every update records origin, editor, rationale and timestamp, and old versions are kept. |
| Does this touch patient data (PHI)? | No. It only handles published guidelines and policy documents. |
| Is scraping allowed? | Per source, we check terms of use, prefer APIs and licensed feeds, and rate-limit politely. Sources we can't use stay manual. |
| How do we avoid alert fatigue? | Filters narrow matches to the relevant criteria first, so reviewers see a short, ranked list with the differing text highlighted. |
| What does the wireframe leave out? | Scores, severity and summaries are mock data. The real ones come from the matching stage. |
| What's in the first release? | Ingestion, criterion extraction, matching, and the review queue for a small set of priority sources, then expansion. |

---

## Part 3: "Why not agentic?" in depth

### The client's likely vision
> "An AI goes out, finds new guidelines, reads them, figures out which policies are affected, and tells us what to change. No manual setup."

**Feasible version of that vision:** AI does the *reading and judging* and the *maintenance*, inside a fixed pipeline:

- **Scraping:** agents *help build and repair* collectors (draft a new scraper for a site, fix it when the site changes, with human review). Agents also read messy PDFs and pull out criteria. We do *not* have an agent browsing the open web fresh each run.
- **Matching:** AI compares a guideline criterion against a *short list* of candidate policy criteria and writes the explanation (`divergence`). It does not search all policies unaided.

### Our view
A pipeline controls *what gets checked and when*. AI is a worker inside specific steps.

1. **Fetch:** deterministic collectors, one per source (API or scraper).
2. **Normalize:** into the schema, with AI-assisted extraction of criteria.
3. **Narrow:** derived categorical fields on `GuidelineCriterion` and `PolicyCriterion` (for example condition, service type, population, code group) filter candidates deterministically.
4. **Retrieve:** RAG ranks the remaining candidates by meaning.
5. **Judge:** AI assesses each shortlisted pair and records the result in `CriterionMatch`.
6. **Review:** a human approves.

**The two views are the same system with one disagreement:** who is in charge. Client view: the agent decides what to do. Our view: the pipeline decides, and AI does the thinking at steps 2, 5 (and 4).

### TLDR: plain-language arguments

1. **Compliance needs the same answer every time.** Pipeline: same input gives the same result, so we can show an auditor why. Agent: may take a different path on a different day.
2. **The worst failure is a silent miss.** A scraper that breaks sends an alert. An agent can decide a page "looks unchanged" and move on, and no one knows.
3. **We can prove what we checked.** Fixed collectors give a log of "source, date, result." An agent's browsing is hard to reconstruct.
4. **Filtering first makes AI cheaper and better.** Matching every policy criterion against every guideline criterion means millions of comparisons. Filters cut it to a few dozen per criterion, so AI is faster, cheaper and less likely to be distracted by look-alikes.
5. **Errors multiply across steps.** If each of five agent steps is 90% reliable, the whole chain is only about 59%. Fewer, smaller AI steps keep accuracy high.
6. **Use AI where it's actually better than code.** Reading messy documents and judging whether two sentences mean the same thing: yes. Knowing which URL to fetch each morning: no, code does that perfectly.
7. **This isn't a "never".** The schema we built is the foundation. Once we have measured accuracy, we can hand AI more steps where it proves itself, one at a time.
8. **Humans stay the decision-makers.** Whatever the AI does, a person approves changes to policies.

**One-liner for the room:** *"We use AI where judgment is needed and plain code where reliability is needed. Today's design lets us widen AI's role later without rebuilding anything."*
