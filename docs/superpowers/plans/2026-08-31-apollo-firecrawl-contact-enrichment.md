
# Apollo Firecrawl Contact Enrichment Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a verified LeadIntel workflow that discovers companies with Firecrawl, selects exactly 3–4 relevant decision-makers, enriches business emails and available phone numbers through paid Apollo, and saves only approved contacts to Master CRM.

**Architecture:** Firecrawl remains the primary research source. Company domains are normalized and quality-filtered before Apollo is called. Apollo first finds role-matched people, then enriches and verifies contact data under explicit credit, policy and owner-approval controls. Scrapling is an optional external fallback for pages Firecrawl cannot read and must use the same domain and evidence gates.

**Tech Stack:** Cloudflare Workers, Cloudflare D1, vanilla Customer V2 JavaScript, Firecrawl proxy, Apollo REST API, GitHub Actions and Node.js test runner.

**Spec:** docs/superpowers/plans/2026-08-28-master-crm.md, docs/superpowers/plans/2026-08-26-company-intelligence-autofill.md and the current LeadIntel Apollo/Firecrawl requirements.

## Global Constraints

- Firecrawl discovery remains bounded at 4 searches × 5 results; standard website research remains capped at 25 pages and 100,000 characters.
- Only a verified company domain may enter primary evidence.
- Foreign-domain sources may be retained only as explicitly labelled supporting evidence.
- Select exactly 3–4 decision-makers when enough relevant Apollo matches exist; show a shortage instead of fabricating people.
- Business emails require Apollo verification or a permitted strong-match status; personal email requires explicit owner approval.
- Phone lookup is disabled by default and requires an explicit workspace policy.
- Apollo keys and raw contact secrets never enter browser code, local storage, logs or evidence text.
- Every enrichment request records provider, timestamp, status, credits and reason.
- Reset and Pipeline removal preserve CRM records.
- Outreach is blocked unless the contact has an approved business email or owner-approved alternative.
- Every task adds a failing test before production code and ends with focused passing tests plus a commit.

## File Map

- backend/src/enrichment.js: Apollo request construction and contact validation.
- backend/src/index.js: authenticated enrichment routes, policy, credits, Apollo calls and CRM persistence.
- backend/wrangler.toml: non-secret Apollo and Scrapling configuration names.
- customer/discovery-engine.js: company scoring, role selection and safe Apollo normalization.
- customer/discovery-ui.js: discovery, contact review and enrichment controls.
- customer/server-bridge.js: authenticated browser-to-Worker enrichment calls.
- customer/crm-engine.js: CRM-safe company and contact mapping.
- customer/company-research-engine.js: Firecrawl filtering and Scrapling fallback metadata.
- customer/company-research-ui.js: bounded research and publication-quality gate.
- backend/test/enrichment-contract.test.js: backend policy and validation tests.
- backend/test/research-fallback.test.js: fallback adapter tests.
- customer/test/discovery-engine.test.js: selection-cap and response-safety tests.
- customer/test/discovery-structure.test.js: UI wiring tests.
- customer/test/company-research-engine.test.js: source and fallback quality tests.
- docs/operations/apollo-firecrawl-runbook.md: setup, credit controls, verification and rollback procedure.

---

### Task 1: Lock Apollo enrichment contracts and policies

**Files:**
- Modify: backend/src/enrichment.js
- Modify: backend/src/index.js
- Modify: backend/wrangler.toml
- Create: backend/test/enrichment-contract.test.js

**Interfaces:**
- Consumes: verified opportunity ID, company domain, requested roles, workspace policy and Worker-held Apollo credentials.
- Produces: POST /api/opportunities/:opportunityId/enrich returning request and contact status; GET /api/enrichment-policy returning safe configuration and usage.

- [ ] Step 1: Write failing tests.

~~~js
test('Apollo search is domain-scoped and role-scoped',()=>{
  const body=apolloSearchBody({domain:'acme.com',roles:['Procurement Director']});
  assert.deepEqual(body.organization_domains,['acme.com']);
  assert.deepEqual(body.person_titles,['Procurement Director']);
  assert.equal('api_key' in body,false);
});

test('business email validation rejects personal and foreign-domain addresses',()=>{
  assert.equal(provenBusinessEmail({email:'buyer@gmail.com',email_status:'verified'},'acme.com'),'');
  assert.equal(provenBusinessEmail({email:'buyer@other.com',email_status:'verified'},'acme.com'),'');
  assert.equal(provenBusinessEmail({email:'buyer@acme.com',email_status:'verified'},'acme.com'),'buyer@acme.com');
});
~~~

- [ ] Step 2: Run and verify failure.

~~~bash
node --test backend/test/enrichment-contract.test.js
~~~

Expected: FAIL because the contract is not yet complete.

- [ ] Step 3: Implement domain normalization, role caps, business-email validation and policy-controlled phone lookup. Keep Apollo calls inside backend/src/index.js.

- [ ] Step 4: Run focused tests and syntax checks.

~~~bash
node --test backend/test/enrichment-contract.test.js
node --check backend/src/index.js
node --check backend/src/enrichment.js
~~~

- [ ] Step 5: Commit.

~~~bash
git add backend/src/enrichment.js backend/src/index.js backend/wrangler.toml backend/test/enrichment-contract.test.js
git commit -m "feat: lock Apollo enrichment contract and policy controls"
~~~

### Task 2: Select exactly 3–4 decision-makers

**Files:**
- Modify: customer/discovery-engine.js
- Modify: customer/discovery-ui.js
- Modify: customer/crm-engine.js
- Modify: customer/server-bridge.js
- Modify: customer/test/discovery-engine.test.js
- Create: customer/test/discovery-structure.test.js

**Interfaces:**
- Consumes: scored company candidate, profile decision-maker roles and verified company domain.
- Produces: selectDecisionMakers(people, profile, limit=4) returning at most four role-ranked people; normalizeApolloPeople(payload) returning public identity fields only; enrichOpportunity(opportunityId, options) on the server bridge.

- [ ] Step 1: Write failing tests.

~~~js
test('selects no more than four relevant decision-makers',()=>{
  const people=Array.from({length:7},(_,i)=>({id:'p'+i,name:'Person '+i,title:i===5?'Unrelated Role':'Procurement Director'}));
  const selected=Discovery.selectDecisionMakers(people,{decisionMakers:'Procurement Director; COO'},4);
  assert.equal(selected.length,4);
  assert.ok(selected.every(person=>person.title==='Procurement Director'||person.title==='COO'));
});

test('browser exposes separate search and paid enrichment actions',()=>{
  const ui=fs.readFileSync(path.join(root,'..','discovery-ui.js'),'utf8');
  assert.match(ui,/Find decision-makers/);
  assert.match(ui,/Enrich contact/);
  assert.match(ui,/enrichOpportunity/);
  assert.doesNotMatch(ui,/X-Api-Key/);
});
~~~

- [ ] Step 2: Run and verify failure.

~~~bash
node --test customer/test/discovery-engine.test.js customer/test/discovery-structure.test.js
~~~

- [ ] Step 3: Implement role-ranked selection capped at four, keep contact secrets out of public normalization, and add the authenticated enrichment bridge.
- [ ] Step 4: Run tests and syntax checks.

~~~bash
node --test customer/test/discovery-engine.test.js customer/test/discovery-structure.test.js
node --check customer/discovery-engine.js
node --check customer/discovery-ui.js
node --check customer/server-bridge.js
~~~

- [ ] Step 5: Commit.

~~~bash
git add customer/discovery-engine.js customer/discovery-ui.js customer/crm-engine.js customer/server-bridge.js customer/test/discovery-engine.test.js customer/test/discovery-structure.test.js
git commit -m "feat: add capped decision-maker selection and enrichment controls"
~~~

### Task 3: Connect paid Apollo enrichment to CRM

**Files:**
- Modify: backend/src/index.js
- Modify: backend/src/enrichment.js
- Modify: customer/discovery-ui.js
- Modify: customer/crm-engine.js
- Modify: customer/test/discovery-structure.test.js
- Modify: backend/test/enrichment-contract.test.js

**Interfaces:**
- Consumes: selected Apollo person ID, opportunity ID, role and workspace policy.
- Produces: persisted CRM contact with email_status, phone_status, verification_provider, match_confidence, email_type and verified_at, plus an auditable enrichment request.

- [ ] Step 1: Write failing request and policy tests.

~~~js
test('Apollo match requests policy-controlled email and phone enrichment',()=>{
  const url=buildApolloMatchUrl({personId:'p1',personalEmail:false,phoneLookup:true});
  assert.match(url,/reveal_personal_emails=false/);
  assert.match(url,/reveal_phone_number=true/);
  assert.match(url,/run_waterfall_email=true/);
  assert.match(url,/run_waterfall_phone=true/);
});
~~~

- [ ] Step 2: Run and verify failure.

~~~bash
node --test backend/test/enrichment-contract.test.js customer/test/discovery-structure.test.js
~~~

- [ ] Step 3: Implement the authenticated transaction:
  1. Validate opportunity ownership and company domain.
  2. Reserve one Apollo credit per person request.
  3. Refuse enrichment when a verified contact already exists.
  4. Refuse phone lookup unless policy allows it.
  5. Call Apollo people search and people match.
  6. Accept only a business email matching the company domain.
  7. Store phone data only when policy permits it.
  8. Persist not_found without inventing fallback data.
  9. Release reserved credits on failure.
  10. Audit status and credit usage without raw API responses.

- [ ] Step 4: Connect UI review states: Not enriched, Enriching, Verified email, Phone found, No verified contact and Blocked by policy. Require approval before outreach eligibility.
- [ ] Step 5: Run tests and syntax checks.

~~~bash
node --test backend/test/enrichment-contract.test.js customer/test/discovery-structure.test.js customer/test/crm-integration.test.js
node --check backend/src/index.js
node --check customer/discovery-ui.js
node --check customer/crm-engine.js
~~~

- [ ] Step 6: Commit.

~~~bash
git add backend/src/index.js backend/src/enrichment.js customer/discovery-ui.js customer/crm-engine.js customer/test/discovery-structure.test.js backend/test/enrichment-contract.test.js
git commit -m "feat: connect Apollo paid enrichment to CRM contacts"
~~~

### Task 4: Add Scrapling as a controlled Firecrawl fallback

**Files:**
- Modify: customer/company-research-engine.js
- Modify: customer/company-research-ui.js
- Modify: backend/src/index.js
- Modify: backend/wrangler.toml
- Modify: customer/test/company-research-engine.test.js
- Create: backend/test/research-fallback.test.js

**Interfaces:**
- Consumes: verified company URL and Firecrawl result marked unreadable or incomplete.
- Produces: fallback source with provider scrapling, original URL, extraction timestamp and bounded readable text.

- [ ] Step 1: Write failing tests.

~~~js
test('fallback source must match the verified company domain',()=>{
  const result=filterResearchSources([
    {provider:'scrapling',url:'https://acme.com/about',text:'Acme evidence'},
    {provider:'scrapling',url:'https://wrong.com/about',text:'Wrong evidence'}
  ],'https://acme.com/');
  assert.deepEqual(result.primary.map(row=>row.url),['https://acme.com/about']);
  assert.ok(result.supporting.some(row=>row.url==='https://wrong.com/about'));
});
~~~

- [ ] Step 2: Run and verify failure.

~~~bash
node --test customer/test/company-research-engine.test.js backend/test/research-fallback.test.js
~~~

- [ ] Step 3: Implement Scrapling as an optional external adapter configured by SCRAPLING_API_BASE_URL. Keep it outside the Cloudflare Worker runtime. Send only verified URLs and bounded extraction parameters.
- [ ] Step 4: Apply the same asset filter, readable-text check, page/character limits, domain comparison and publication gate to Firecrawl and Scrapling.
- [ ] Step 5: Run tests and commit.

~~~bash
node --test customer/test/company-research-engine.test.js backend/test/research-fallback.test.js
node --check customer/company-research-engine.js
node --check customer/company-research-ui.js
node --check backend/src/index.js
git add customer/company-research-engine.js customer/company-research-ui.js backend/src/index.js backend/wrangler.toml customer/test/company-research-engine.test.js backend/test/research-fallback.test.js
git commit -m "feat: add controlled Scrapling research fallback"
~~~

### Task 5: End-to-end QA, runbook and release gate

**Files:**
- Create: docs/operations/apollo-firecrawl-runbook.md
- Modify: .github/workflows/customer-ci.yml
- Modify: customer/test/ci-release.test.js

**Interfaces:**
- Consumes: research, selection, enrichment, CRM and policy contracts from Tasks 1–4.
- Produces: repeatable setup, one-company verification procedure, credit-control checks and rollback steps.

- [ ] Step 1: Add release-gate tests.

~~~js
test('release gate covers backend and customer tests',()=>{
  const workflow=fs.readFileSync(path.join(root,'..','.github/workflows/customer-ci.yml'),'utf8');
  const runbook=fs.readFileSync(path.join(root,'..','docs/operations/apollo-firecrawl-runbook.md'),'utf8');
  assert.match(workflow,/backend\\/test/);
  assert.match(workflow,/customer\\/test/);
  assert.match(runbook,/APOLLO_API_KEY/);
  assert.match(runbook,/3–4/);
  assert.match(runbook,/CRM records are preserved/);
});
~~~

- [ ] Step 2: Document the exact operator sequence:
  1. Configure APOLLO_API_KEY as a Worker secret.
  2. Confirm policy status without revealing the key.
  3. Test one known company domain.
  4. Confirm Firecrawl evidence and domain quality.
  5. Select 3–4 decision-makers.
  6. Enrich one person and verify credit usage.
  7. Confirm email and phone status.
  8. Confirm CRM persistence and duplicate prevention.
  9. Confirm outreach blocks unverified contacts.
  10. Disable policy for rollback without deleting CRM history.

- [ ] Step 3: Run complete verification.

~~~bash
node --test customer/test/*.test.js backend/test/*.test.js
for file in customer/*.js backend/src/*.js; do node --check "$file"; done
~~~

- [ ] Step 4: Preview-test one real company and verify the complete evidence trail before production deployment.
- [ ] Step 5: Commit.

~~~bash
git add docs/operations/apollo-firecrawl-runbook.md .github/workflows/customer-ci.yml customer/test/ci-release.test.js
git commit -m "docs: add Apollo Firecrawl release and operations gate"
~~~

## Final Acceptance Criteria

- Firecrawl discovers a real company and preserves source evidence.
- The system selects no more than four relevant decision-makers and reports shortages clearly.
- Apollo enriches business emails and policy-approved phone numbers with visible statuses and credits.
- Only domain-matched, approved contacts reach CRM and outreach.
- Scrapling improves extraction only when configured and never weakens evidence controls.
- Full tests and syntax checks pass.
- Preview verification is complete before production deployment.
