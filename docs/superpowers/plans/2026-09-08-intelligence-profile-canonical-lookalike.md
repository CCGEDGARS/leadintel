# Canonical Intelligence Profile + Lookalike Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overlapping profile/evidence/gap logic with one canonical Company Intelligence Profile, simplify Step 3, and add an activated reference-customer lookalike model that prioritizes Discovery inside the Step 1 target market(s).

**Architecture:** Add a pure canonical reconciliation layer that owns source authority, field provenance, diagnostics, contradictions, and migration. Keep Company Brain as a derivation helper invoked before canonical construction rather than as a post-build semantic mutator. Add focused Step 3 UI and Reference Customer modules. Discovery receives activated Reference Customer DNA as a separate, explainable ranking input while preserving evidence-first scoring and hard exclusions. Main Customer V2 state remains the persistence boundary. Backend Copilot already consumes bounded `main.profile` generically, so canonical metadata should flow through without a backend semantic mapper.

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
- Keep Customer State under the existing 500 KB sync ceiling. V1 technical bounds: retain up to 200 imported reference rows, allow up to 50 active/analyzed rows, and persist compact analysis/DNA rather than full scraped page bodies in reference-customer state.
- The old Step 2 `lookalike_customers` free-text question is retired from the visible intake. Legacy saved values are migrated into inactive `needs_review` Reference Customer rows so names are preserved without influencing Discovery until explicit activation.
- Do not delete legacy UI modules until replacement behavior and regression coverage are green. Remove runtime imports only after their responsibilities have moved.
- No production claim without exact-SHA Customer V2 CI, applicable Backend CI/deploy, Vercel production readiness, live release SHA, and Release Integrity proof.

---

## Task 1 — Canonical source authority and field reconciliation

**Create:**
- `customer/canonical-intelligence.js`
- `customer/test/canonical-intelligence.test.js`

**Modify:**
- `customer/profile-engine.js`
- `customer/index.html`
- `customer/test/profile-engine.test.js`
- `customer/test/structure.test.js`

### Contract

Implement `canonical-intelligence.js` as the same UMD/CommonJS pattern used by the current pure engines so it is available as `globalThis.LeadIntelCanonicalIntelligence` in-browser and through `require()` in Node tests. Load it in `index.html` immediately before `profile-engine.js`.

Export:

```js
classifySource(source, companyWebsite)
reconcileField(fieldKey, candidates)
buildCanonicalProfile(input, derived = {})
diagnoseCanonicalProfile(profile)
compareExternalEvidence(profile, externalSources)
normalizeCanonicalProfile(profile, input, derived = {})
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

Canonical profile keeps compatibility values at top level (`priorityOffers`, `idealCustomer`, etc.) and stores authoritative metadata under `profile.canonical.fields`. The compatibility value is always generated from the canonical field record; it is never an independent competing truth.

### TDD steps

- [ ] RED: add precedence tests: user-confirmed > uploaded document > same-domain website > first-party AI inference.

Run:

```bash
node --test customer/test/canonical-intelligence.test.js
```

Expected: FAIL because module does not exist.

- [ ] RED: add source-classification tests for apex/www equivalence, company-owned additional links, and external third-party links.
- [ ] RED: add test proving `https://klozers.com/...` can be `external_validation` but can never be first-party evidence for `https://ccgroup.lv/`.
- [ ] RED: add contradiction test: first-party claim remains canonical while external conflicting claim is recorded separately.
- [ ] RED: add diagnostics tests:
  - non-empty first-party inferred pain → `needs_confirmation`
  - user-confirmed pain → `known`
  - no value/evidence → `missing`
- [ ] GREEN: implement `canonical-intelligence.js` minimally until all new tests pass.
- [ ] REFACTOR: centralize hostname normalization and status/confidence sanitization; no UI logic in this module.
- [ ] Modify `profile-engine.js` so `buildCompanyIntelligenceProfile(input)` calls the canonical layer for final field assembly and diagnostics instead of treating answer-only `informationGaps()` as authoritative.
- [ ] Make the browser dependency explicit: structure test requires `canonical-intelligence.js` before `profile-engine.js`.
- [ ] Replace profile-engine regression expectations that inspect raw legacy gap strings with canonical diagnostics assertions.
- [ ] Run:

```bash
node --test customer/test/canonical-intelligence.test.js customer/test/profile-engine.test.js customer/test/structure.test.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/canonical-intelligence.js customer/profile-engine.js customer/index.html customer/test/canonical-intelligence.test.js customer/test/profile-engine.test.js customer/test/structure.test.js
git commit -m "feat: add canonical company intelligence reconciliation"
```

---

## Task 2 — Eliminate post-build semantic drift and stale profile evidence

**Modify:**
- `customer/company-brain.js`
- `customer/app.js`
- `customer/business-identity.js`
- `customer/profile-engine.js`
- `customer/company-profile-handoff.js`
- `customer/test/company-brain.test.js`
- `customer/test/business-identity.test.js`
- `customer/test/company-research-structure.test.js`
- `customer/test/profile-engine.test.js`

### Contract

Replace Company Brain's primary-field runtime patching with one explicit helper:

```js
deriveCanonicalContext(input, language)
// => {companyClassification, customerPainPoints, recommendedSignals, interpretation}
```

`app.js` statically imports `company-brain.js` before `let state=loadState()`. Both `analyzeCompany()` and `company-profile-handoff.js` compute `derived = LeadIntelCompanyBrain.deriveCanonicalContext(input, language)` and pass it into the same profile build call:

```js
LeadIntelProfile.buildCompanyIntelligenceProfile({...input, derived})
```

For saved-state migration, extend normalization to accept the derived context:

```js
LeadIntelProfile.normalizeSavedState(raw, {derived})
```

`app.js::loadState()` derives from the raw preserved inputs first, then normalizes. This makes migration deterministic and avoids relying on async module-patch timing.

### TDD steps

- [ ] RED: test that derived `customerPainPoints` and its Step 3 diagnostic originate from the same canonical field record and cannot disagree.
- [ ] RED: test saved state containing old `Klozers`/`Challenger` evidence plus current `ccgroup.lv` inputs; normalization removes those sources from active first-party company evidence.
- [ ] RED: test changing `website` from domain A to B rebuilds active evidence for B and does not retain A as current evidence.
- [ ] RED: test a clean user-confirmed canonical field survives reload/migration even when old derived identity/framework fields are discarded/rebuilt.
- [ ] RED: app/module-order test proves Company Brain is loaded before `loadState()` and the same helper is used in fresh analysis and migration.
- [ ] GREEN: implement `deriveCanonicalContext()` and stop Company Brain from post-build mutation of canonical fields/diagnostics.
- [ ] GREEN: update `normalizeSavedState()` to rebuild derived evidence/diagnostics when `profile.canonical.version !== 1`; preserve raw answers, documents, Step 1 website/markets, supplied source URLs and user-confirmed canonical edits.
- [ ] GREEN: do not preserve legacy `profile.evidenceSources`, `profile.informationGaps`, `profile.customerPainPointsStatus` as authoritative merely because they existed in `value.profile`.
- [ ] GREEN: update `company-profile-handoff.js` to use the same `derived` + canonical build path as `app.js`.
- [ ] Keep Business Identity derivations available for Copilot/content generation, but stop them from owning primary Step 3 field truth.
- [ ] Run:

```bash
node --test customer/test/profile-engine.test.js customer/test/company-brain.test.js customer/test/business-identity.test.js customer/test/company-research-structure.test.js
```

Expected: PASS with canonical assertions.

- [ ] Commit:

```bash
git add customer/profile-engine.js customer/company-brain.js customer/app.js customer/business-identity.js customer/company-profile-handoff.js customer/test/company-brain.test.js customer/test/business-identity.test.js customer/test/company-research-structure.test.js customer/test/profile-engine.test.js
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

Do not delete those files in this task unless no imports/tests remain; first remove runtime use and convert legacy layout tests to assert retirement/replacement.

### Step 3 structure

Render exactly eight primary cards:

```js
const CORE_FIELDS = [
  'priorityOffers','idealCustomer','targetMarkets','customerPainPoints',
  'buyingTriggers','decisionMakers','differentiation','commercialObjective'
];
```

Each card reads one canonical field record and shows value + provenance/status + confidence. Edit mode writes through one helper, for example:

```js
confirmCanonicalField(profile, fieldKey, newValue)
```

which sets `status:'user_confirmed'`, `provenance:'user'`, high confidence and the user source id.

Render:
- `LeadIntel Interpretation`: Commercial Focus, Strongest Opportunity Conditions, Main Commercial Risk, Recommended Next Move.
- `Profile Quality`: known / needs-confirmation / missing counts and concise diagnostics.
- `Contradictions & Review`: hidden if empty.
- `Supporting Context`: collapsed `<details>` with company overview, current markets, Reference Customer summary, exclusions, commercial value, detailed outcomes/documents.
- `Evidence & Validation`: compact first-party/external counts and expandable evidence.
- `Signal summary`: active theme count + `Open Signal Designer →`; no full Step 3 signal checkbox list.
- Review summary/action: confirmed/inferred/needs-review counts; `Confirm current profile`; `Improve with Ask LeadIntel`.

### TDD steps

- [ ] RED: structure test requires exactly the eight core field hooks and forbids `marketFocus` as a primary card.
- [ ] RED: UI test requires provenance/confidence labels from canonical field metadata.
- [ ] RED: editing an inferred field and saving promotes its canonical status to `user_confirmed` and updates its compatibility value.
- [ ] RED: Step 3 no longer contains the full `recommended-signals` checkbox library; Step 4 Signal Designer remains intact.
- [ ] RED: duplicated Golden Circle/FAB/USP/elevator-pitch blocks are not primary Step 3 sections.
- [ ] RED: evidence view separates first-party evidence from external validation and keeps unsafe-URL escaping regression.
- [ ] RED: contradiction panel is hidden when empty and rendered when present.
- [ ] GREEN: implement `intelligence-profile-ui.js` as the sole Step 3 renderer; make `app.js::renderProfile()` delegate to it.
- [ ] GREEN: update Step 3 HTML/CSS and responsive behavior.
- [ ] GREEN: remove runtime imports of `commercial-context-layout.js` and `profile-evidence-layout.js` from `evidence-view.js` after replacement tests are green.
- [ ] Run:

```bash
node --test customer/test/intelligence-profile-ui.test.js customer/test/evidence-view.test.js customer/test/structure.test.js customer/test/business-identity.test.js customer/test/commercial-context-layout.test.js customer/test/profile-evidence-layout.test.js customer/test/premium-ux-redesign.test.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/index.html customer/app.js customer/evidence-view.js customer/intelligence-profile-ui.js customer/intelligence-profile.css customer/test/intelligence-profile-ui.test.js customer/test/evidence-view.test.js customer/test/structure.test.js customer/test/business-identity.test.js customer/test/commercial-context-layout.test.js customer/test/profile-evidence-layout.test.js customer/test/premium-ux-redesign.test.js
git commit -m "feat: simplify company intelligence profile UI"
```

---

## Task 4 — Reference customer state, legacy migration, CSV/XLSX/PDF import and activation

**Create:**
- `customer/reference-customers.js`
- `customer/reference-customer-ui.js`
- `customer/reference-customers.css`
- `customer/test/reference-customers.test.js`
- `customer/test/reference-customer-ui.test.js`

**Modify:**
- `customer/index.html`
- `customer/app.js`
- `customer/profile-engine.js`
- `customer/company-research-engine.js`
- `customer/state-budget.js`
- `customer/test/profile-engine.test.js`
- `customer/test/company-research-engine.test.js`
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

### Intake migration

- Remove the visible Step 2 `data-question="lookalike_customers"` textarea and replace it with a compact note/action pointing to Reference Customers in Step 3.
- Preserve `lookalike_customers` only as a legacy migration key. It no longer contributes to completeness or company-research AI drafting.
- On first reference-state normalization, split a legacy value such as `Apple; Microsoft; Toyota` into inactive `needs_review` rows with company names only. Never auto-activate them.

### Import behavior

- CSV: parse quoted fields, commas/semicolons, header aliases, UTF-8 BOM.
- XLSX: lazy import pinned `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm`; first worksheet only; convert rows to objects before normalization.
- PDF: reuse pinned PDF.js 6.2.108 extraction. Parse conservatively and set all PDF-derived rows to `needs_review` until the user confirms them.
- Manual: single-row form fallback.
- Do not silently guess a domain. Missing domains may be resolved in Task 5 through a reviewable search workflow.

### TDD steps

- [ ] RED: CSV parser handles company + website + country + commercial metadata and quoted separators.
- [ ] RED: duplicate rows collapse deterministically.
- [ ] RED: unsafe URLs are rejected; unresolved names are preserved with `unresolved` status.
- [ ] RED: XLSX row-normalization contract accepts the array produced by SheetJS and maps header aliases correctly.
- [ ] RED: PDF extracted records are `needs_review` and cannot become active until reviewed/confirmed.
- [ ] RED: legacy Step 2 lookalike names migrate to inactive `needs_review` rows and the old field no longer contributes to completeness/research drafting.
- [ ] RED: imported list is inert until explicit activation; `getActiveReferenceModel()` returns null before activation.
- [ ] RED: activation respects the max-active bound and stores a version/fingerprint used by Discovery invalidation.
- [ ] RED: state-budget test proves a maximum normalized reference list + compact DNA still syncs below 500 KB without deleting core profile data.
- [ ] GREEN: implement pure import/state functions in `reference-customers.js`.
- [ ] GREEN: implement Step 3 `Reference Customers` compact card + manager panel with Upload CSV/XLSX/PDF, Add manually, review table, activate/deactivate controls, and read-only Step 1 target-market display.
- [ ] GREEN: no new country selector.
- [ ] GREEN: update Customer CI syntax checks for new modules.
- [ ] Run:

```bash
node --test customer/test/reference-customers.test.js customer/test/reference-customer-ui.test.js customer/test/profile-engine.test.js customer/test/company-research-engine.test.js customer/test/state-budget.test.js customer/test/structure.test.js
node --check customer/reference-customers.js
node --check customer/reference-customer-ui.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/reference-customers.js customer/reference-customer-ui.js customer/reference-customers.css customer/index.html customer/app.js customer/profile-engine.js customer/company-research-engine.js customer/state-budget.js customer/test/reference-customers.test.js customer/test/reference-customer-ui.test.js customer/test/profile-engine.test.js customer/test/company-research-engine.test.js customer/test/state-budget.test.js customer/test/structure.test.js .github/workflows/customer-ci.yml
git commit -m "feat: add activated reference customer import flow"
```

---

## Task 5 — Resolve reference domains and build evidence-backed Reference Customer DNA

**Modify:**
- `customer/reference-customers.js`
- `customer/reference-customer-ui.js`
- `customer/test/reference-customers.test.js`
- `customer/test/reference-customer-ui.test.js`

**Use existing infrastructure:**
- authenticated Firecrawl workspace router
- existing managed fallback for unsigned/local research
- bounded concurrency and timeout patterns already used by company/market research
- no provider secrets in the browser

### Reviewable domain resolution

For an active/reviewed row without a domain, expose `Find website`. Perform at most one exact-name + country Firecrawl search with up to 3 results. Normalize likely company-domain candidates, but never silently accept one. Show the proposed domain and require explicit confirmation before it becomes `ready`.

For rows with confirmed domains, analyze only bounded official company evidence. V1: scrape the homepage and, when discovered from the official domain, at most one high-value `about/products/services` page per active row. Use concurrency 3 and visible progress. Store compact analysis summaries only.

### DNA shape

```js
{
  version: 1,
  activeCount: 18,
  analyzableCount: 16,
  confidence: 'high' | 'medium' | 'low',
  dimensions: [
    {key:'industry', values:['industrial manufacturing'], confidence:'high', evidenceCount:12},
    {key:'sizeBand', values:['100-500'], confidence:'medium', evidenceCount:8}
  ],
  generatedFromFingerprint: '...',
  generatedAt: '...'
}
```

Allowed DNA dimensions are bounded to the approved set: industry, size band, business model, growth stage, operating complexity, site footprint, buyer roles, purchased offer, recurring problems, trigger patterns, and reliably evidenced technology/operating stack. Unsupported dimensions are omitted.

### TDD steps

- [ ] RED: unresolved domain search returns review candidates only; it cannot auto-confirm a domain.
- [ ] RED: DNA ignores inactive and unresolved rows.
- [ ] RED: DNA dimensions require evidence counts; unsupported dimensions are omitted rather than fabricated.
- [ ] RED: fewer than 3 analyzable active companies yields `low` confidence and an explicit limited-model status.
- [ ] RED: 3+ consistent, evidenced companies can yield medium/high confidence based on evidence coverage.
- [ ] RED: changing activation, confirmed domain, or row commercial metadata invalidates the DNA fingerprint.
- [ ] GREEN: implement deterministic DNA aggregation from normalized per-company analysis records.
- [ ] GREEN: UI shows `N imported · N active · N analyzed`, DNA confidence, strongest dimensions and Step 1 target market(s).
- [ ] GREEN: analysis failures leave the active list intact and mark only affected rows; never silently deactivate the model.
- [ ] Run:

```bash
node --test customer/test/reference-customers.test.js customer/test/reference-customer-ui.test.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/reference-customers.js customer/reference-customer-ui.js customer/test/reference-customers.test.js customer/test/reference-customer-ui.test.js
git commit -m "feat: derive evidence-backed reference customer DNA"
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

Keep the existing evidence/opportunity score intact:

```js
score = {fit, signal, evidence, timing, value, total}
```

Add a separate explainable lookalike result when active DNA exists:

```js
lookalike = {
  score: 0, // 0..100
  dimensions: [{key:'industry', score:90, explanation:'...'}],
  confidence: 'High' | 'Medium' | 'Low'
}
```

For active DNA only, compute:

```js
priorityScore = Math.round(0.70 * lookalike.score + 0.30 * score.total)
```

The 70/30 weighting implements the approved rule that an explicitly activated existing-customer model becomes the dominant practical Discovery priority, while preserving ordinary commercial/evidence scoring separately. Apply hard exclusions before calculating or sorting scores. If DNA is inactive/unavailable, `priorityScore = score.total` and no Lookalike Match is shown.

### Geography

Discovery uses expanded Step 1 target markets only. For multiple countries, generate country-scoped work, retain each result’s market, normalize all component scores to the same 0–100 range, and present one combined list with market labels/filters. Never add a separate country input.

### TDD steps

- [ ] RED: legacy `profile.lookalikeCustomers` no longer creates an automatic Lookalike ICP in `market-engine.js`; core + trigger-led ICP remain.
- [ ] RED: inactive reference list does not change discovery queries, scores or ordering.
- [ ] RED: active DNA adds evidence-backed DNA terms to queries while still requiring Step 1 market and respecting the four-query guard.
- [ ] RED: candidate Lookalike Match uses candidate evidence text/domain facts, not research query metadata.
- [ ] RED: hard exclusion removes a candidate even if lookalike score would be 100.
- [ ] RED: active DNA changes ordering through documented 70/30 `priorityScore` while leaving `score.total` unchanged.
- [ ] RED: multi-country Step 1 selection keeps country-specific results and produces one combined ranked list.
- [ ] RED: candidate narrative explains top lookalike dimensions in selected language without unsupported traits.
- [ ] GREEN: extend discovery signatures consistently:

```js
buildDiscoveryQueries(profile, marketState, maxQueries = 4, referenceModel = null)
mergeCompanyCandidates(results, profile, marketState, referenceModel = null)
```

- [ ] GREEN: include Reference Customer fingerprint in `discovery-ui.js` run fingerprint so list/model changes invalidate stale Discovery results.
- [ ] GREEN: render `Lookalike Match: NN/100` plus 2–4 evidence-backed similarity reasons on candidate cards when active.
- [ ] GREEN: show a compact `Reference Customer DNA active` banner with Step 1 target market(s); no extra geography control.
- [ ] Run:

```bash
node --test customer/test/discovery-engine.test.js customer/test/market-engine.test.js customer/test/structure.test.js
node --check customer/discovery-engine.js
node --check customer/discovery-ui.js
```

Expected: PASS.

- [ ] Commit:

```bash
git add customer/discovery-engine.js customer/discovery-ui.js customer/discovery.css customer/market-engine.js customer/test/discovery-engine.test.js customer/test/market-engine.test.js customer/test/structure.test.js
git commit -m "feat: prioritize activated lookalike DNA in discovery"
```

---

## Task 7 — Downstream canonical-profile compatibility and Copilot regression

**Modify only if required by failing customer tests:**
- `customer/market-engine.js`
- `customer/discovery-engine.js`
- `customer/outreach-engine.js`
- relevant customer tests

**Modify:**
- `backend/test/copilot-context.test.mjs`

**Expected backend source change:** none. `backend/src/copilot-context.js` already loads authoritative server Customer State and passes the bounded `main.profile` object through `safeProfile()`, so canonical profile metadata should reach Copilot automatically.

### TDD steps

- [ ] RED: add backend fixture where `main.profile.canonical.fields` exists; Copilot context preserves safe canonical metadata and does not leak raw protected data.
- [ ] RED: Market Strategy reads compatibility values generated from canonical profile and does not independently create a conflicting customer pain/ICP truth.
- [ ] RED: Discovery and Outreach continue to receive `priorityOffers`, `idealCustomer`, `customerPainPoints`, `decisionMakers`, `buyingTriggers`, `exclusions`, `opportunityValue` from the canonical compatibility surface.
- [ ] GREEN: make only changes required by those failing tests.
- [ ] Run customer subset:

```bash
node --test customer/test/market-engine.test.js customer/test/discovery-engine.test.js customer/test/outreach-engine.test.js
```

- [ ] Run backend Copilot regression:

```bash
node --test backend/test/copilot-context.test.mjs
```

Expected: PASS. If backend source remains unchanged, Backend Deploy is not required for this feature.

- [ ] Commit exact changed paths; do not stage unrelated directories:

```bash
git add backend/test/copilot-context.test.mjs customer/market-engine.js customer/discovery-engine.js customer/outreach-engine.js customer/test/market-engine.test.js customer/test/discovery-engine.test.js customer/test/outreach-engine.test.js
git commit -m "test: lock canonical profile downstream contracts"
```

If a listed customer source/test did not change, omit that path from `git add`.

---

## Task 8 — Migration, cache/version contract and full CI verification

**Modify:**
- `customer/index.html`
- `customer/process-map.js` if module imports live there
- `.github/workflows/customer-ci.yml`
- `customer/test/state-budget.test.js`
- `customer/test/premium-ux-redesign.test.js`
- `customer/test/ci-release.test.js` only if the CI contract itself changes

### Steps

- [ ] RED: add migration test for a realistic pre-canonical workspace: preserve raw answers, docs, Step 1 website/markets and user source URLs; rebuild canonical derived fields/evidence; old external company evidence is not current truth; legacy lookalike names become inactive review rows.
- [ ] RED: add static-asset cache test requiring new canonical/reference/UI modules to use one release key so browsers cannot mix profile generations.
- [ ] GREEN: bump relevant Customer V2 asset versions together.
- [ ] GREEN: ensure Customer CI syntax-checks:

```bash
node --check customer/canonical-intelligence.js
node --check customer/intelligence-profile-ui.js
node --check customer/reference-customers.js
node --check customer/reference-customer-ui.js
```

- [ ] Run full Customer suite:

```bash
node --test customer/test/*.test.js
```

Expected: all PASS.

- [ ] Run every explicit JavaScript syntax check from `.github/workflows/customer-ci.yml`.
- [ ] Run backend tests because the Copilot regression fixture changed:

```bash
cd backend && npm test
```

Expected: PASS.

- [ ] Inspect:

```bash
git diff --check
git status --short
```

No accidental artifacts, secrets, generated binaries or temporary import files.

- [ ] Commit only final cache/CI/migration-contract changes:

```bash
git add customer/index.html customer/process-map.js .github/workflows/customer-ci.yml customer/test/state-budget.test.js customer/test/premium-ux-redesign.test.js
# add customer/test/ci-release.test.js only if intentionally changed
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
  - no post-build module silently replaces canonical fields,
  - stale evidence migration is deterministic,
  - Step 3 has exactly the approved eight primary intelligence cards,
  - Signal Designer is not duplicated in Step 3,
  - old Step 2 lookalike field is not a second source of truth,
  - Reference Customer list is inert until activation,
  - unresolved domains require review,
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
- [ ] If backend source changed, also require exact-SHA **Backend CI** and **Backend Deploy**. If only backend tests changed, document that backend deployment is not required by release-integrity change detection.
- [ ] Confirm Vercel preview is READY on the exact PR head SHA and smoke-test Step 1 → Step 3 → Step 5.
- [ ] Merge only after review and exact-SHA CI are green.
- [ ] Record merge SHA as **LATEST CODE** until production proof is complete.
- [ ] Confirm Vercel production deployment is READY on exact merge SHA.
- [ ] Verify `https://leadintel.ccgroup.lv/customer/` serves the new release and live release metadata matches exact merge SHA.
- [ ] Smoke-test production:
  - company website + Step 1 target market still load,
  - Step 3 shows only valid current first-party company evidence,
  - inferred Customer Problems no longer conflict with Diagnostics,
  - edit + confirm promotes a field to user-confirmed,
  - Reference Customer CSV import/review/activation works,
  - activated list shows DNA summary and existing Step 1 market,
  - Discovery displays Lookalike Match and remains constrained to Step 1 market(s),
  - Signal Designer remains functional in Step 4,
  - Copilot opens and receives current canonical profile context.
- [ ] If authenticated browser interaction cannot be performed with available tools, stop before claiming full E2E and ask the user for one precise signed-in smoke-test action.
- [ ] Confirm Release Integrity proof verdict is **PROVEN** for exact merge SHA before saying **PROVEN PRODUCTION**.
