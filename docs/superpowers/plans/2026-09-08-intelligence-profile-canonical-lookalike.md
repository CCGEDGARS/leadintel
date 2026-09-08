# Canonical Intelligence Profile + Lookalike Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overlapping profile/evidence/gap logic with one canonical Company Intelligence Profile, simplify Step 3, and add an activated reference-customer lookalike model that prioritizes Discovery inside the Step 1 target market(s).

**Architecture:** Add a pure canonical reconciliation layer that owns source authority, field provenance, diagnostics, contradictions, and migration. Keep Company Brain as a derivation helper rather than a post-build semantic mutator. Add focused Step 3 UI and Reference Customer modules. Discovery receives activated Reference Customer DNA as a separate, explainable ranking input while preserving evidence-first scoring and hard exclusions. Main Customer V2 state remains the persistence boundary; backend Copilot already consumes `main.profile` generically, so no backend semantic mapping change is required unless a regression test proves otherwise.

**Tech Stack:** Vanilla JavaScript, Node 22 `node:test`, existing localStorage/server-bridge Customer V2 persistence, Firecrawl workspace routing, Apollo decision-maker search, PDF.js 6.2.108, SheetJS/XLSX 0.18.5 loaded lazily for XLSX imports, Vercel customer frontend, Cloudflare Worker backend.

**Spec:** `docs/superpowers/specs/2026-09-08-intelligence-profile-canonical-lookalike-design.md`

## Global Constraints

- Preserve the project intelligence-state discipline: **Known → Planned → Researched → Verified**.
- Company Profile evidence is first-party only: user-confirmed input, uploaded company documents, company-owned/same-domain pages, then AI inference from those sources.
- Third-party sources are secondary validation/context only and must never silently overwrite canonical first-party claims.
- Discovery may use external research, but no company opportunity score or lookalike explanation may be created from query text alone; candidate evidence must support the claim.
- Hard exclusions outrank Reference Customer DNA.
- Step 1 `targetMarkets` remains the only geography source; do not add a Lookalike country selector.
- Activated Reference Customer DNA is a separate empirical discovery model and must not rewrite canonical ICP fields.
- Keep Customer State under the existing 500 KB sync ceiling. V1 technical bounds: retain up to 200 imported reference rows, allow up to 50 active/analyzed rows, store compact DNA summaries rather than full scraped page bodies in the reference-customer state.
- Do not delete legacy modules until replacement behavior and regression coverage are green. Remove runtime imports only after their responsibilities have been moved.
- No production claim without exact-SHA Customer V2 CI, applicable Backend CI/deploy, Vercel production readiness, live release SHA, and Release Integrity proof.

---

## Task 1 — Canonical source authority and field reconciliation

**Create:**
- `customer/canonical-intelligence.js`
- `customer/test/canonical-intelligence.test.js`

**Modify later in this task:**
- `customer/profile-engine.js`
- `customer/test/profile-engine.test.js`

### Contract

Use a pure module with these exported functions:

```js
classifySource(source, companyWebsite)
reconcileField(fieldKey, candidates)
buildCanonicalProfile(input, derived = {})
diagnoseCanonicalProfile(profile)
compareExternalEvidence(profile, externalSources)
normalizeCanonicalProfile(profile, input)
```

Canonical field record shape:

```js
{
  value: 'Manufacturers with 50–500 employees',
  status: 'user_confirmed',
  provenance: 'user',
  sourceIds: ['U:ideal_customer'],
  confidence: 'high',
  updatedAt: '2026-09-08T20:00:00.000Z'
}
```

Canonical profile keeps compatibility values at top level (`priorityOffers`, `idealCustomer`, etc.) and stores authoritative metadata under `profile.canonical.fields` so existing downstream code can migrate incrementally without two competing values.

### TDD steps

- [ ] RED: add precedence tests: user-confirmed > uploaded document > same-domain website > first-party AI inference.

Run:

```bash
node --test customer/test/canonical-intelligence.test.js
```

Expected: FAIL because module does not exist.

- [ ] RED: add source-classification tests for apex/www equivalence, company-owned additional links, and external third-party links.
- [ ] RED: add test proving `https://klozers.com/...` can be `external_validation` but can never be a first-party source for `https://ccgroup.lv/`.
- [ ] RED: add contradiction test: first-party claim remains canonical while external conflicting claim is recorded separately.
- [ ] RED: add diagnostics tests:
  - non-empty first-party inferred pain → `needs_confirmation`
  - user-confirmed pain → `known`
  - no value/evidence → `missing`
- [ ] GREEN: implement `canonical-intelligence.js` minimally until all new tests pass.
- [ ] REFACTOR: centralize source hostname normalization and status/confidence sanitization; no UI logic in this file.
- [ ] Modify `profile-engine.js` so `buildCompanyIntelligenceProfile()` delegates canonical field assembly/diagnostics to `LeadIntelCanonicalIntelligence` rather than using answer-only `informationGaps()` as the final authority.
- [ ] Replace profile-engine regression expectations that inspect raw legacy `informationGaps` strings with canonical diagnostics assertions.
- [ ] Run:

```bash
node --test customer/test/canonical-intelligence.test.js customer/test/profile-engine.test.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/canonical-intelligence.js customer/profile-engine.js customer/test/canonical-intelligence.test.js customer/test/profile-engine.test.js
git commit -m "feat: add canonical company intelligence reconciliation"
```

---

## Task 2 — Eliminate post-build semantic drift and stale profile evidence

**Modify:**
- `customer/company-brain.js`
- `customer/business-identity.js`
- `customer/profile-engine.js`
- `customer/company-profile-handoff.js`
- `customer/test/company-brain.test.js`
- `customer/test/business-identity.test.js`
- `customer/test/company-research-structure.test.js`
- `customer/test/profile-engine.test.js`

### Design

`company-brain.js` remains responsible for useful derivations such as classification, pain inference and signal recommendations, but those derivations must be supplied to the canonical builder before diagnostics. It must not patch a completed profile afterward and leave stale gap/evidence state behind.

Profile migration must preserve raw sources/answers/documents and user-confirmed edits, but rebuild current derived evidence and diagnostics. Do not preserve legacy `profile.evidenceSources`, `profile.informationGaps`, `profile.customerPainPointsStatus`, or other derived fields merely because they exist in saved `value.profile`.

### TDD steps

- [ ] RED: test that `customerPainPoints` derived by Company Brain and Step 3 diagnostics come from the same canonical field record and cannot disagree.
- [ ] RED: test saved state containing `Klozers`/`Challenger` evidence plus current `ccgroup.lv` source; normalization must remove those sources from active first-party company evidence.
- [ ] RED: test changing `website` from domain A to B rebuilds active evidence for B and does not retain A as current evidence.
- [ ] RED: test a clean user-confirmed canonical field survives reload/migration even when old derived identity/framework fields are discarded/rebuilt.
- [ ] GREEN: change Company Brain install flow so derivations are helper inputs to canonical profile construction, not a second semantic mutation pass.
- [ ] GREEN: update `normalizeSavedState()` to rebuild authoritative profile metadata from raw first-party inputs when canonical version is absent/stale.
- [ ] GREEN: version canonical state, e.g. `profile.canonical.version = 1`, and rebuild when missing or mismatched.
- [ ] GREEN: update `company-profile-handoff.js` to call the same canonical build path as the main analyzer; no second profile construction semantics.
- [ ] Keep Business Identity generation available for Copilot/content use, but stop it from owning primary Step 3 field truth.
- [ ] Run:

```bash
node --test customer/test/profile-engine.test.js customer/test/company-brain.test.js customer/test/business-identity.test.js customer/test/company-research-structure.test.js
```

Expected: PASS with revised canonical assertions.

- [ ] Commit:

```bash
git add customer/profile-engine.js customer/company-brain.js customer/business-identity.js customer/company-profile-handoff.js customer/test
git commit -m "fix: unify profile derivation and stale evidence migration"
```

---

## Task 3 — Build the simplified Step 3 Intelligence Profile UI

**Create:**
- `customer/intelligence-profile-ui.js`
- `customer/intelligence-profile.css`
- `customer/test/intelligence-profile-ui.test.js`

**Modify:**
- `customer/index.html`
- `customer/app.js`
- `customer/evidence-view.js`
- `customer/test/evidence-view.test.js`
- `customer/test/structure.test.js`
- `customer/test/business-identity.test.js`
- `customer/test/commercial-context-layout.test.js`
- `customer/test/profile-evidence-layout.test.js`
- `customer/test/premium-ux-redesign.test.js`

**Retire from runtime after replacement tests pass:**
- `customer/commercial-context-layout.js`
- `customer/profile-evidence-layout.js`

Do not delete the files in the same commit unless no other test/import references remain; first remove their runtime imports and old assertions.

### Step 3 structure

Render exactly eight primary cards:

```js
const CORE_FIELDS = [
  'priorityOffers','idealCustomer','targetMarkets','customerPainPoints',
  'buyingTriggers','decisionMakers','differentiation','commercialObjective'
];
```

Each card reads one canonical field record and shows value + provenance/status + confidence. Edit mode edits the compatibility value and writes back a `user_confirmed` canonical field record.

Render additional sections:
- `LeadIntel Interpretation`: Commercial Focus, Strongest Opportunity Conditions, Main Commercial Risk, Recommended Next Move.
- `Profile Quality`: known / needs-confirmation / missing counts and concise field diagnostics.
- `Contradictions & Review`: hidden if empty.
- `Supporting Context`: `<details>` collapsed by default; company overview, current markets, reference customer summary, exclusions, commercial value, detailed outcomes/documents.
- `Evidence & Validation`: compact first-party/external counts and expandable evidence, not giant default source cards.
- `Signal summary`: active theme count + `Open Signal Designer →`; remove full signal checkbox list from Step 3.
- Review summary/action: confirmed/inferred/needs-review counts; `Confirm current profile`; `Improve with Ask LeadIntel`.

### TDD steps

- [ ] RED: structure test requires eight core field hooks and forbids `marketFocus` as a primary card.
- [ ] RED: UI test requires provenance/confidence labels from canonical field metadata.
- [ ] RED: editing an inferred field and saving promotes its canonical status to `user_confirmed`.
- [ ] RED: Step 3 no longer contains the full `recommended-signals` checkbox library; Step 4 Signal Designer remains intact.
- [ ] RED: duplicated Golden Circle/FAB/USP/elevator-pitch blocks are not primary Step 3 sections.
- [ ] RED: evidence view separates first-party evidence from external validation and keeps unsafe-URL escaping regression.
- [ ] RED: contradiction panel is omitted/hidden when no contradictions exist and rendered when present.
- [ ] GREEN: implement `intelligence-profile-ui.js` as the sole Step 3 renderer; make `app.js::renderProfile()` delegate to it.
- [ ] GREEN: update Step 3 HTML/CSS and responsive behavior.
- [ ] GREEN: remove runtime imports of `commercial-context-layout.js` and `profile-evidence-layout.js` from `evidence-view.js` once replacement tests are green.
- [ ] Run:

```bash
node --test customer/test/intelligence-profile-ui.test.js customer/test/evidence-view.test.js customer/test/structure.test.js customer/test/business-identity.test.js customer/test/commercial-context-layout.test.js customer/test/profile-evidence-layout.test.js customer/test/premium-ux-redesign.test.js
```

Expected: PASS after old layout tests are rewritten to assert retirement/replacement rather than legacy geometry.

- [ ] Commit:

```bash
git add customer/index.html customer/app.js customer/evidence-view.js customer/intelligence-profile-ui.js customer/intelligence-profile.css customer/test
git commit -m "feat: simplify company intelligence profile UI"
```

---

## Task 4 — Reference customer state, CSV/XLSX/PDF import and activation

**Create:**
- `customer/reference-customers.js`
- `customer/reference-customer-ui.js`
- `customer/reference-customers.css`
- `customer/test/reference-customers.test.js`
- `customer/test/reference-customer-ui.test.js`

**Modify:**
- `customer/index.html`
- `customer/app.js`
- `customer/state-budget.js`
- `customer/test/state-budget.test.js`
- `customer/test/structure.test.js`
- `.github/workflows/customer-ci.yml`

### State shape

Store inside main Customer V2 state so existing local/server persistence works:

```js
main.referenceCustomers = {
  version: 1,
  source: {type: 'csv', name: 'customers.csv'},
  rows: [],
  activeIds: [],
  dna: null,
  activatedAt: '',
  analyzedAt: ''
}
```

Normalized row:

```js
{
  id, companyName, website, domain, country,
  productService, approximateValue, reason, notes,
  status: 'ready' | 'needs_review' | 'unresolved',
  active: false
}
```

Technical bounds: max 200 imported rows persisted; max 50 active/analyzed rows. Deduplicate by normalized domain when available, otherwise normalized company name + country.

### Import behavior

- CSV: parse quoted fields, commas/semicolons, header aliases, UTF-8 BOM.
- XLSX: lazy import pinned `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm`; read first worksheet only; convert rows to objects before normalization.
- PDF: reuse pinned PDF.js 6.2.108 extraction. Parse candidate lines/columns conservatively and set all PDF-derived rows to `needs_review` until user confirms them.
- Manual: single-row form fallback.
- Do not guess a website/domain for an unresolved company. Domain enrichment can be a later explicit action; V1 import marks unresolved.

### TDD steps

- [ ] RED: CSV parser handles company + website + country + commercial metadata and quoted separators.
- [ ] RED: duplicate rows collapse deterministically.
- [ ] RED: unsafe URLs are rejected; unresolved names are preserved with `unresolved` status.
- [ ] RED: XLSX row-normalization contract accepts the array produced by SheetJS and maps header aliases correctly.
- [ ] RED: PDF extracted records are `needs_review` and cannot become active until confirmed.
- [ ] RED: imported list is inert until explicit activation; `getActiveReferenceModel()` returns null before activation.
- [ ] RED: activation respects the max-active bound and stores a version/fingerprint used by Discovery invalidation.
- [ ] RED: state-budget test proves a maximum normalized reference list + compact DNA still syncs below 500 KB without deleting core profile data.
- [ ] GREEN: implement pure import/state functions in `reference-customers.js`.
- [ ] GREEN: implement Step 3 `Reference Customers` compact card + manager drawer/panel with Upload CSV/XLSX/PDF, Add manually, review table, activate/deactivate controls, and read-only Step 1 target-market display.
- [ ] GREEN: do not add any new country selector.
- [ ] GREEN: update Customer CI syntax checks for new modules.
- [ ] Run:

```bash
node --test customer/test/reference-customers.test.js customer/test/reference-customer-ui.test.js customer/test/state-budget.test.js customer/test/structure.test.js
node --check customer/reference-customers.js
node --check customer/reference-customer-ui.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/reference-customers.js customer/reference-customer-ui.js customer/reference-customers.css customer/index.html customer/app.js customer/state-budget.js customer/test .github/workflows/customer-ci.yml
git commit -m "feat: add activated reference customer import flow"
```

---

## Task 5 — Build evidence-backed Reference Customer DNA

**Modify:**
- `customer/reference-customers.js`
- `customer/reference-customer-ui.js`
- `customer/test/reference-customers.test.js`

**Use existing infrastructure:**
- authenticated Firecrawl workspace router for company page research
- existing bounded-concurrency/timeout patterns
- no new provider secret handling in the browser

### DNA shape

```js
{
  version: 1,
  activeCount: 18,
  analyzableCount: 16,
  confidence: 'high' | 'medium' | 'low',
  dimensions: [
    {key:'industry', values:['industrial manufacturing'], weight:1, confidence:'high', evidenceCount:12},
    {key:'sizeBand', values:['100-500'], weight:1, confidence:'medium', evidenceCount:8}
  ],
  generatedFromFingerprint: '...',
  generatedAt: '...'
}
```

DNA may use uploaded row metadata plus evidence gathered from activated customer company domains. Do not store full scraped bodies inside `referenceCustomers`; persist compact dimensions/evidence counts and bounded per-row analysis summaries.

### TDD steps

- [ ] RED: DNA ignores inactive rows.
- [ ] RED: DNA dimensions require evidence counts; unsupported dimensions are omitted rather than fabricated.
- [ ] RED: fewer than 3 analyzable active companies yields `low` confidence and an explicit limited-model message.
- [ ] RED: 3+ consistent, evidenced companies can yield medium/high confidence according to evidence coverage.
- [ ] RED: changing activation invalidates stale DNA fingerprint.
- [ ] GREEN: implement deterministic DNA aggregation from normalized per-company analysis records.
- [ ] GREEN: UI shows `N imported · N active · N analyzed`, DNA confidence, strongest dimensions and Step 1 target market(s).
- [ ] GREEN: an analysis failure leaves the active list intact and marks only affected rows; it must not silently deactivate the list.
- [ ] Run:

```bash
node --test customer/test/reference-customers.test.js customer/test/reference-customer-ui.test.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/reference-customers.js customer/reference-customer-ui.js customer/test/reference-customers.test.js customer/test/reference-customer-ui.test.js
git commit -m "feat: derive reference customer DNA"
```

---

## Task 6 — Integrate Lookalike DNA into Discovery without corrupting evidence scores

**Modify:**
- `customer/discovery-engine.js`
- `customer/discovery-ui.js`
- `customer/discovery.css`
- `customer/market-engine.js`
- `customer/test/discovery-engine.test.js`
- `customer/test/market-engine.test.js`
- `customer/test/structure.test.js`

### Discovery contract

Keep the existing five-part evidence/opportunity score intact:

```js
score = {fit, signal, evidence, timing, value, total}
```

Add a separate explainable lookalike result when an active DNA exists:

```js
lookalike = {
  score: 0, // 0..100
  dimensions: [{key:'industry', score:90, explanation:'...'}],
  confidence: 'High' | 'Medium' | 'Low'
}
```

For active DNA only, compute a transparent ranking score:

```js
priorityScore = Math.round(0.70 * lookalike.score + 0.30 * score.total)
```

This makes the activated list the dominant empirical ranking factor while preserving the ordinary evidence-backed commercial score separately. Apply hard exclusions before scoring/ranking. If DNA is inactive/unavailable, `priorityScore = score.total` and no Lookalike Match is displayed.

### Geography

Discovery queries must use the expanded Step 1 target markets only. For multiple countries, generate per-market query work and keep each result’s market; merge into one ranked list with market filters. Never add a separate country input.

### TDD steps

- [ ] RED: legacy `profile.lookalikeCustomers` string no longer creates an automatic Lookalike ICP in `market-engine.js`; core + trigger-led ICP remain.
- [ ] RED: inactive reference list does not change discovery queries, scores or ordering.
- [ ] RED: active DNA adds DNA-relevant query terms while still requiring Step 1 market and bounded query count.
- [ ] RED: discovered candidate Lookalike Match uses candidate evidence text/domain facts, not research query metadata.
- [ ] RED: hard exclusion removes candidate even if lookalike score would be 100.
- [ ] RED: active DNA changes ordering through the documented 70/30 `priorityScore` while leaving `score.total` unchanged.
- [ ] RED: multi-country Step 1 selection keeps country-specific results and produces one combined ranked list.
- [ ] RED: candidate narrative can explain top lookalike dimensions in selected language without inventing unsupported traits.
- [ ] GREEN: extend discovery engine signatures consistently, e.g.:

```js
buildDiscoveryQueries(profile, marketState, maxQueries = 4, referenceModel = null)
mergeCompanyCandidates(results, profile, marketState, referenceModel = null)
```

- [ ] GREEN: include reference-model fingerprint in `discovery-ui.js` run fingerprint so activating/deactivating/changing the list invalidates stale Discovery results.
- [ ] GREEN: render `Lookalike Match: NN/100` and 2–4 short reasons on candidate cards when active.
- [ ] GREEN: show a compact `Reference Customer DNA active` banner with Step 1 market(s); no extra geography control.
- [ ] Run:

```bash
node --test customer/test/discovery-engine.test.js customer/test/market-engine.test.js customer/test/structure.test.js
node --check customer/discovery-engine.js
node --check customer/discovery-ui.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/discovery-engine.js customer/discovery-ui.js customer/discovery.css customer/market-engine.js customer/test
git commit -m "feat: prioritize activated lookalike DNA in discovery"
```

---

## Task 7 — Downstream canonical-profile compatibility and Copilot regression

**Modify only where tests require:**
- `customer/market-engine.js`
- `customer/discovery-engine.js`
- `customer/outreach-engine.js`
- `customer/test/market-engine.test.js`
- `customer/test/discovery-engine.test.js`
- relevant outreach tests
- `backend/test/copilot-context.test.mjs`

**Expected backend source change:** none. `backend/src/copilot-context.js` already loads authoritative server Customer State and passes the bounded `main.profile` object through `safeProfile()`, so canonical profile fields/metadata should reach Copilot automatically.

### TDD steps

- [ ] RED: add regression fixture where `main.profile.canonical.fields` exists; backend Copilot context must preserve safe canonical metadata and must not leak raw protected data.
- [ ] RED: Market Strategy reads compatibility values derived from canonical profile and does not independently reconstruct a different ICP/customer pain.
- [ ] RED: Discovery and Outreach continue to receive `priorityOffers`, `idealCustomer`, `customerPainPoints`, `decisionMakers`, `buyingTriggers`, `exclusions`, `opportunityValue` from the same canonical profile.
- [ ] GREEN: make only the minimum compatibility changes required by failing tests.
- [ ] Run customer subset:

```bash
node --test customer/test/market-engine.test.js customer/test/discovery-engine.test.js customer/test/outreach-engine.test.js
```

- [ ] Run backend Copilot regression:

```bash
node --test backend/test/copilot-context.test.mjs
```

Expected: PASS; if backend source remains unchanged, Backend Deploy is not required for this feature branch.

- [ ] Commit:

```bash
git add customer backend/test/copilot-context.test.mjs
git commit -m "test: lock canonical profile downstream contracts"
```

---

## Task 8 — Migration, cache/version contract and full CI verification

**Modify:**
- `customer/index.html`
- `customer/process-map.js` if module imports live there
- `.github/workflows/customer-ci.yml`
- cache/structure tests as required
- `customer/test/state-budget.test.js`
- `customer/test/premium-ux-redesign.test.js`
- `customer/test/ci-release.test.js` only if CI contract changes

### Steps

- [ ] RED: add migration test for a realistic pre-canonical saved workspace: preserve raw answers, docs, Step 1 website/markets and user source URLs; rebuild canonical derived fields/evidence; do not show old external company evidence.
- [ ] RED: add static-asset cache test requiring the new canonical/reference/UI modules to use one release key so old browsers cannot mix profile generations.
- [ ] GREEN: bump relevant Customer V2 asset versions together.
- [ ] GREEN: ensure Customer CI contains syntax checks for:

```bash
node --check customer/canonical-intelligence.js
node --check customer/intelligence-profile-ui.js
node --check customer/reference-customers.js
node --check customer/reference-customer-ui.js
```

- [ ] Run the full Customer suite locally/CI-equivalent:

```bash
node --test customer/test/*.test.js
```

Expected: all PASS.

- [ ] Run all explicit syntax checks from `.github/workflows/customer-ci.yml`.
- [ ] Run backend tests only because we changed a backend test fixture; no backend source/deployment is needed unless source was changed:

```bash
cd backend && npm test
```

Expected: PASS.

- [ ] Inspect `git diff --check` and `git status --short`; no accidental artifacts, secrets, generated binaries or untracked temporary imports.
- [ ] Commit:

```bash
git add customer backend/test .github/workflows/customer-ci.yml
git commit -m "chore: finalize canonical intelligence release contract"
```

---

## Task 9 — Review, PR, merge and production proof

**Required skills before merge/completion:**
- `superpowers:requesting-code-review`
- `superpowers:verification-before-completion`
- repository `.agents/skills/release-integrity/SKILL.md`

### Steps

- [ ] Compare final feature branch against `main`; review every changed file for scope and unintended behavior.
- [ ] Manual review checklist if no reviewer subagent is available:
  - canonical source precedence cannot be bypassed by external sources,
  - no post-build module can silently replace canonical fields,
  - stale profile evidence migration is deterministic,
  - Step 3 has exactly the approved eight primary intelligence cards,
  - Signal Designer is not duplicated in Step 3,
  - reference list is inert until activation,
  - no second country selector exists,
  - hard exclusions precede lookalike ranking,
  - lookalike score is separate/explainable,
  - query metadata cannot create evidence-backed similarity,
  - 500 KB state ceiling remains enforced,
  - no secrets/provider keys are introduced client-side.
- [ ] Run fresh full verification at the exact final feature SHA:

```bash
node --test customer/test/*.test.js
cd backend && npm test
```

plus all Customer CI syntax checks.

- [ ] Create PR from the implementation branch to `main`.
- [ ] Confirm **Customer V2 CI** succeeds on the exact PR head SHA.
- [ ] If backend source changed, also require exact-SHA **Backend CI** and **Backend Deploy**. If only backend tests changed, record that backend deployment is not required by release-integrity change detection.
- [ ] Confirm Vercel preview is READY for the exact PR head SHA and smoke-test the Step 1 → Step 3 → Step 5 path.
- [ ] Merge only after review and exact-SHA CI are green.
- [ ] Record the merge SHA as **LATEST CODE** until production proof is complete.
- [ ] Confirm Vercel production deployment is READY on the exact merge SHA.
- [ ] Verify `https://leadintel.ccgroup.lv/customer/` serves the new release and the live release metadata matches the exact merge SHA.
- [ ] Smoke-test production:
  - company website + Step 1 target market still load,
  - Step 3 shows only valid current first-party company evidence,
  - inferred Customer Problems no longer conflict with Diagnostics,
  - edit + confirm promotes a field to user-confirmed,
  - reference customer CSV import/review/activation works,
  - activated list shows DNA summary and existing Step 1 market,
  - Discovery displays Lookalike Match and remains constrained to Step 1 market(s),
  - Signal Designer remains functional in Step 4,
  - Copilot opens and reads current profile context.
- [ ] Confirm Release Integrity proof verdict is **PROVEN** for the exact merge SHA before saying **PROVEN PRODUCTION**.
