# Intervention normalization: what to map, and with what

Policies and guidelines word the same intervention differently ("Lipitor 20 mg", "atorvastatin calcium",
"statin therapy"; "colonoscopy", "colon scope", "lower endoscopy"). Matching on text overlap misses these.
This document lists every kind of intervention a criterion can name, and every source we can use to map
each onto one canonical concept, grouped by access tier.

**Legend.** ✅ = probed live on 2026-10-14 from this machine. 📄 = from vendor documentation or general
knowledge, **not** probed; confirm terms and endpoints before building on it.

Tiers: **T1** keyless · **T2** free key or free licence · **T3** key + paid · **T4** key + paid + access-gated
(needs the hospital's engineers, contracts or existing licences).

## 1. Intervention kinds (the list to cover)

| # | Kind | Examples | Hub vocabulary to normalize onto |
|---|---|---|---|
| 1 | Small-molecule drugs | atorvastatin, metformin | RxNorm ingredient (IN) |
| 2 | Biologics and biosimilars | adalimumab, adalimumab-atto | RxNorm IN + product; FDA Purple Book |
| 3 | Vaccines | hepatitis B, COVID-19 mRNA | CVX (+ MVX for makers) |
| 4 | Immune globulins, blood and plasma products | HBIG, albumin, factor VIII | RxNorm, CVX (globulins), SNOMED |
| 5 | Cell and gene therapies | CAR-T, voretigene | NCIt, RxNorm (approved products), SNOMED |
| 6 | Radiopharmaceuticals, contrast agents | Lu-177 dotatate, gadolinium | RxNorm, NCIt, RadLex |
| 7 | Compounded, OTC, supplements, medical foods, cannabis | vitamin D, enteral formula | RxNorm (partial), NDC, UNII; HCPCS B-codes for enteral/parenteral nutrition |
| 8 | Drug regimens and combinations | FOLFOX, R-CHOP, step-therapy sequences | NCIt regimens; HemOnc.org; components resolve to RxNorm |
| 9 | Surgical procedures | knee arthroscopy, bariatric surgery | SNOMED CT procedure; CPT / ICD-10-PCS as billing codes |
| 10 | Endoscopic and interventional procedures | colonoscopy, PCI, embolization | SNOMED CT; CPT; ICD-10-PCS |
| 11 | Transplant, anesthesia, obstetric, dental, ophthalmic procedures | kidney transplant, cataract surgery, extraction | SNOMED CT; CPT; CDT (dental); ICD-10-PCS |
| 12 | Diagnostic imaging | CT colonography, MRI knee | SNOMED CT; RadLex / LOINC-RSNA Playbook; CPT |
| 13 | Laboratory, genetic and genomic tests, biomarkers | HbA1c, BRCA1/2 panel | LOINC; SNOMED CT; (genetic: GTR, HGNC, ClinVar for the variant side) |
| 14 | Screening and preventive services, counseling | FIT, tobacco cessation counseling | USPSTF category + SNOMED CT / LOINC; CPT; HCPCS |
| 15 | Rehabilitative therapies | physical, occupational, speech therapy | SNOMED CT; CPT 97xxx; ICD-10-PCS section F |
| 16 | Behavioral and psychotherapies | CBT, ABA, DBT | SNOMED CT; CPT 908xx/97xxx; ICD-10-PCS GZ; MeSH |
| 17 | Radiation therapy and nuclear medicine | IMRT, brachytherapy | NCIt; SNOMED CT; CPT 77xxx; ICD-10-PCS D |
| 18 | Dialysis, respiratory, infusion, phototherapy, hyperbaric | hemodialysis, CPAP, HBOT | SNOMED CT; CPT; HCPCS |
| 19 | Neuromodulation | ECT, TMS, vagus nerve stimulation | SNOMED CT; CPT; NCIt |
| 20 | Complementary and manual therapies | acupuncture, chiropractic, massage | SNOMED CT; CPT; MeSH |
| 21 | Devices, implants, prosthetics, DME | insulin pump, CGM, wheelchair, pacemaker | HCPCS (billing); SNOMED CT device; GUDID / GMDN / UMDNS (product) |
| 22 | Software and digital therapeutics | prescription digital therapeutic | FDA product code; HCPCS (new A/E/K codes); no clinical hub |
| 23 | Care setting and service | inpatient admission, SNF, home health, telehealth | Not clinical concepts: place-of-service and revenue codes, CPT modifiers; model as a separate `setting` facet |
| 24 | Behavioral/lifestyle programs | diabetes prevention program, diet counseling | SNOMED CT; CPT/HCPCS program codes |
| 25 | Drug **qualifiers** (not interventions, but they break matching) | strength, dose form, route, brand vs generic | RxNorm TTY levels (IN, SCD, SBD, BN); keep as attributes |

Each kind has one **hub** where synonyms collapse (RxNorm for drugs, CVX for vaccines, SNOMED CT for
procedures, therapies and devices, LOINC for tests) and **billing code sets** (CPT, HCPCS, ICD-10-PCS, CDT)
that policies actually cite. Billing codes are not synonyms of each other, so a crosswalk is needed (see §5).

## 2. T1: keyless

| Source | Covers | Notes |
|---|---|---|
| ✅ **RxNav / RxNorm** `rxnav.nlm.nih.gov/REST` | Drugs 1, 2, 7. `approximateTerm` (fuzzy brand/strength), `spellingsuggestions`, `related?tty=IN`, `allrelated`, `ndcproperties` | The previous session's finding. Live: "Lipitor 20 mg", "atorvastatin" and the misspelling "atorvastatn calcium" all resolve to `rxnorm:83367`. |
| ✅ **RxClass** (same host) | Drug classes: ATC, VA, EPC, MoA, PE, disease (may treat/prevent), CVX | Resolves "statin therapy" to the class, then members. `classTypes` lists ATC1-4, CHEM, CVX, DISEASE, EPC, MOA, PE, PK, SCHEDULE, STRUCT, TC, VA. |
| ✅ **NLM Clinical Tables** `clinicaltables.nlm.nih.gov` | HCPCS, ICD-10-CM, LOINC items, RxTerms, conditions | **Lexical only**: "colon cancer" returns 0 ICD-10-CM hits (it is "malignant neoplasm of colon"). No ICD-10-PCS table (404). Good for code lookup, not for lingo. |
| ✅ **tx.fhir.org** (HL7 terminology server) | SNOMED CT International (`$expand` with `filter`, `$lookup`, `$subsumes`), CVX, LOINC, others | Hub for kinds 9-21. Public test server: fine for experiments, not for production dependence. SNOMED use is licence-governed (free in the US via NLM/UMLS). |
| ✅ **NCI Thesaurus** `api-evsrest.nci.nih.gov` | Drugs, regimens, procedures, radiation, cell/gene therapy, devices; has synonyms | Best single keyless fallback across kinds, especially oncology. |
| ✅ **EBI OLS4** `ebi.ac.uk/ols4/api` | NCIt, ChEBI, MONDO, HPO and hundreds more ontologies | Cross-ontology search by one call. |
| ✅ **MeSH lookup** `id.nlm.nih.gov/mesh/lookup` | Procedures, therapies, drugs, behavioral and complementary therapies (MeSH has entry terms = synonyms) | Good for "colon scope"-style lingo only if the entry term exists. |
| ✅ **openFDA** `api.fda.gov` (drug label, NDC, 510(k), enforcement) | Brand/generic names, active ingredients, NDC | Works keyless with low quota (key is free: T2). Already used by the repo. |
| ✅ **DailyMed v2** `dailymed.nlm.nih.gov/dailymed/services/v2` | Drug names, SPL labels, set ids | Label text for "indications" cross-checks. |
| ✅ **FDA GSRS / UNII** `gsrs.ncats.nih.gov/api/v1` | Substances incl. biologics, excipients, supplements | Canonical substance id (UNII) and synonyms. |
| ✅ **CDC CVX / MVX files** `www2a.cdc.gov/vaccines/iis/iisstandards` | Vaccines (kind 3) | Flat file, no hierarchy: HepB maps to several CVX (infant, adult, dialysis, unspecified). Group via the CVX-to-vaccine-group table. |
| ✅ **AccessGUDID** `accessgudid.nlm.nih.gov` | Devices (kind 21): brand, company, model, GMDN term, product code | Search worked via `/devices/search.json?query=`; the `/api/v2|v3` lookup paths I tried returned 404, so use the documented path for a given DI. |
| ✅ **ChEMBL**, ✅ **PubChem** | Drug synonyms, ATC, structure (small molecules) | Large synonym lists (PubChem) help catch odd spellings and code names. |
| 📄 **ClinicalTrials.gov API v2** | Intervention names with browse-term mappings | Free, keyless; useful for emerging interventions not yet in RxNorm. |
| 📄 **CMS downloads**: HCPCS Level II quarterly file, ICD-10-PCS and ICD-10-CM tables, NCD/LCD API | Billing code sets with long descriptions | HCPCS and ICD-10-PCS are free; **CPT is not**. Load locally for fast lookup. |
| 📄 **Wikidata SPARQL / DBpedia** | Broad synonym and multilingual labels, with external ids (RxCUI, UMLS CUI, SNOMED) | Crowd-sourced; use only to harvest synonyms, never as ground truth. |
| 📄 **Orange Book / Purple Book downloads (FDA)** | Generic/brand equivalence, biosimilar interchangeability | Static files. |

## 3. T2: free key or free licence

| Source | Covers | Notes |
|---|---|---|
| 📄 **UMLS Metathesaurus + UTS REST API** (free licence, API key) | One concept id (CUI) over SNOMED CT US, RxNorm (full), MeSH, NCIt, LOINC, HCPCS, ICD-10-PCS and 150+ more; synonyms and crosswalks | **The strongest single upgrade.** `uts-ws.nlm.nih.gov/rest` returns 401 without a key ✅. CPT content is in UMLS but under AMA terms; do not assume redistributable. |
| 📄 **VSAC** (`cts.nlm.nih.gov/fhir`, UMLS key; ✅ 401 without key) | Curated value sets (eCQM, CMS) for procedures, drugs, immunizations | Pre-built "all colonoscopy codes" sets: ideal for guideline-to-policy matching. |
| 📄 **RxNorm full release / RxNav-in-a-Box** (UMLS licence) | Self-hosted RxNorm, no rate limits, no outbound calls | Needed if PHI-adjacent traffic cannot leave the network. |
| 📄 **SNOMED CT US Edition + MLDS** (free in affiliate countries) + **Snowstorm** (open-source SNOMED server) | Self-hosted SNOMED with full description search and ECL queries | Removes the dependence on tx.fhir.org. Public Snowstorm hosts returned 405/423 to me ✅ (blocked), so self-host. |
| 📄 **LOINC** (free account, download; ✅ search via NLM tables is keyless) | Tests (kind 13) with long common names and related names | Also the RSNA Playbook for imaging. |
| 📄 **BioPortal / NCBO Annotator** (free key; ✅ 401 without) | 1,000+ ontologies, text annotation | Useful to try many vocabularies at once. |
| 📄 **openFDA key**, **NCBI E-utilities key** | Higher quotas | Already supported by repo config. |
| 📄 **WHO ICD-11 API** (free token) | ICD-11 incl. interventions via ICHI (in development) | Mostly diagnoses today; ICHI coverage is still partial. |
| 📄 **OHDSI Athena** (free account; ✅ programmatic access returned 403) | Downloadable OMOP vocabularies: RxNorm, SNOMED, HCPCS, ICD10PCS, CVX, ATC with `concept_synonym` and `concept_relationship` crosswalks | Excellent for local, joinable normalization tables. CPT4 loads via a UMLS-key script. |
| 📄 **NHS TRUD** (free registration) | OPCS-4 (UK procedures), dm+d (UK drugs), SNOMED UK | Only if UK-style sources appear. |
| 📄 **DrugBank academic** (free for non-commercial; commercial is T3) | Drug synonyms, products, interactions, categories | Licence forbids many commercial uses; check. |
| 📄 **HemOnc.org** (open access ontology) | Oncology regimens (kind 8) | Not a normal API; download. |

## 4. T3: key + paid

| Source | Covers | Notes |
|---|---|---|
| 📄 **AWS Comprehend Medical** (`InferRxNorm`, `InferSNOMEDCT`, `InferICD10CM`) | Free text to RxNorm / SNOMED CT / ICD-10-CM with confidence | Pay per character. Strong "extract and link" in one call; PHI-eligible under BAA. |
| 📄 **Azure AI Language: Text Analytics for Health** (+ Azure Health Data Services) | Entity linking to UMLS CUIs and source vocabularies | Pay per record. |
| 📄 **Google Cloud Healthcare Natural Language API** | Medical entity extraction linked to UMLS | Pay per unit; availability and product naming change, confirm. |
| 📄 **John Snow Labs Healthcare NLP** (licence) | Entity resolvers for RxNorm, SNOMED, CPT, HCPCS, ICD-10-PCS, UMLS | Runs on-premises. |
| 📄 **AMA CPT licence + data file / API** | Official CPT descriptors, consumer terms, clinical descriptors | The only legal source for CPT text. Annual fee; redistribution restricted. Hospitals normally already hold it for billing. |
| 📄 **ADA CDT licence** | Dental procedure codes | Same model as CPT. |
| 📄 **DrugBank commercial API** | Drug and product normalization, synonyms | |
| 📄 **Encoder products**: Optum EncoderPro, Solventum/3M, AAPC Codify | Procedure code lookup and crosswalk | Mostly UIs; API access varies. |
| 📄 **Embase Emtree** (Elsevier), **Clarivate Cortellis**, **Citeline Pharmaprojects** | Synonyms for investigational drugs, pipeline names | Needed only for pre-approval interventions. |

## 5. T4: paid and access-gated (needs the hospital's engineers)

Most of this is probably already licensed by the hospital for clinical or billing use; the work is getting API access.

| Source | Why it matters | What to ask the engineers for |
|---|---|---|
| 📄 **IMO Health** (Intelligent Medical Objects) | De-facto interface terminology in Epic and Oracle Health; maps colloquial terms ("colon scope") to SNOMED CT, ICD-10, CPT, LOINC, RxNorm | Normalization API access, or a data extract of their term-to-code maps. |
| 📄 **Wolters Kluwer Health Language** | Terminology management and mapping platform; similar role to IMO | Same. |
| 📄 **First Databank (FDB MedKnowledge), Medi-Span, Merative Micromedex, Oracle Multum, Gold Standard, Lexicomp, AHFS DI** | Licensed drug knowledge bases: brand/generic, therapeutic classes, formulary and step-therapy structures, NDC to GPI / GCN | Whichever the pharmacy system already uses, via the enterprise licence and their service accounts. Medi-Span's GPI and FDB's GCN also give a drug-class hierarchy payers use. |
| 📄 **Epic**: Chronicles master files (ERX medication, EAP procedure), Clarity/Caboodle tables, Epic on FHIR; **Oracle Health**: code sets and Multum mappings | The hospital's own local codes and their mapping to RxNorm / SNOMED / CPT | Read-only warehouse tables for medication and procedure dictionaries with their standard-code mappings. |
| 📄 **Charge Description Master (CDM)** | The hospital's real CPT/HCPCS usage and descriptions per service | A de-identified extract. |
| 📄 **Hospital terminology server** (Ontoserver, Apelon, Health Language) | Licensed SNOMED/LOINC/CPT/etc. as FHIR `$lookup/$expand/$translate` | Endpoint and credentials; then swap `TX_FHIR` in the normalizer. |
| 📄 **Payer/clearinghouse code-edit tables** (NCCI edits, MUE, payer fee schedules) | How payers group procedures | Only if policies cite them. |

## 6. Recommended design

1. **Hubs, in order.** Drugs → RxNorm ingredient; vaccines → CVX; tests → LOINC; procedures, therapies and devices →
   SNOMED CT; everything else → NCIt. A criterion stores `{kind, verbatim, concept}`; matching uses the concept key.
2. **Match by relation, not just equality.** SNOMED `$subsumes` already turns "colonoscopy" vs "fiberoptic
   colonoscopy" into a broader/narrower pair (✅ verified). RxClass does this for drugs (a policy naming "statins"
   covers atorvastatin).
3. **Let the LLM propose, the terminology server dispose.** Ask the tagging LLM for the *canonical English name* and a
   `kind`; never let it invent codes. The lexical sources fail on colloquialisms ("colon scope" returned nothing ✅), so
   instruct the LLM to expand them first.
4. **Two upgrades pay for themselves first:** a free **UMLS licence** (one key unlocks the cross-vocabulary synonyms
   and crosswalks that T1 lacks) and, from the hospital, **IMO or Health Language access plus the existing CPT licence**.
5. **Known limits of the T1-only normalizer** (see `notebooks/intervention_normalizer.py`): vaccines map to a
   specific CVX product ("Hep B, adult"), not the family; "radiotherapy" and "radiation therapy" resolve to
   unrelated SNOMED concepts; brand-only strings with no strength may resolve to the wrong ingredient; CPT/HCPCS
   codes cited in a policy are not crosswalked to SNOMED (I know of no public SNOMED→CPT map; confirm before assuming none exists).
