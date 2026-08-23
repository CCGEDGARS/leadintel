# LeadIntel Customer V2 Delivery & Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/customer/` from approved outreach packages into controlled Gmail-compose delivery, CRM stage updates, reply/outcome capture and a measurable learning loop.

**Architecture:** Add a pure `delivery-engine.js` for connector-neutral send/reply/outcome events, Gmail compose URL generation, reply classification, CRM stage recommendations, state normalization and learning analytics. Add modular `delivery-ui.js`/`delivery.css` for Step 7 and load them from the existing Outreach module. Persist delivery state separately and update the existing Discovery pipeline by domain.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node built-in test runner, browser localStorage, Gmail compose deep links, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-23-customer-v2-delivery-learning-design.md`

## Global Constraints
- Do not modify legacy `/v2/` application files.
- Do not claim Gmail OAuth or automatic inbox sync exists.
- No automatic sending.
- Gmail compose requires an approved Step 6 outreach package and a valid recipient email.
- `Confirm sent` is always a separate explicit action.
- CRM stages never regress.
- Reply classification is deterministic and conservative.
- Learning recommendations require at least 3 sent records in a segment.
- Delivery state caps: 50 opportunities, 20 replies per opportunity, 200 activity events.

---

### Task 1: Delivery and learning engine
**Files:** Create `customer/delivery-engine.js`; Create `customer/test/delivery-engine.test.js`.

**Interfaces:**
- Consumes: approved outreach item, discovery pipeline context, normalized delivery events.
- Produces: `normalizeEmail(value)`, `buildGmailComposeUrl(packageItem,recipient)`, `confirmSend(state,packageItem,recipient,at)`, `classifyReply(text)`, `recordReply(state,domain,text,at)`, `recordOutcome(state,domain,stage,at)`, `recommendedPipelineStage(record)`, `buildLearningSummary(state,outreachItems,pipeline,minSample)`, `normalizeDeliveryState(value)`.

- [ ] Write failing tests for compose URL safety, approval gate, send event, reply classification, meeting-stage inference, non-regressing outcomes, state caps and minimum-sample learning recommendations.
- [ ] Run tests and confirm failure because `delivery-engine.js` does not exist.
- [ ] Implement the pure engine.
- [ ] Run delivery-engine tests and confirm pass.

### Task 2: Step 7 Delivery UI
**Files:** Create `customer/delivery-ui.js`; Create `customer/delivery.css`; Modify `customer/outreach-ui.js`; Modify `customer/test/structure.test.js`.

**Interfaces:**
- Consumes: `LeadIntelDelivery`, approved `leadintel_customer_v2_outreach` items, `leadintel_customer_v2_discovery` pipeline.
- Produces: Step 7 navigation, Gmail compose bridge, explicit send confirmation, reply capture/classification, outcome controls, activity history, learning dashboard and export.

- [ ] Add failing structural tests for Step 7, Gmail compose, confirm-sent, reply capture, outcome controls, learning dashboard and explicit disconnected OAuth status.
- [ ] Load `delivery-engine.js`, `delivery-ui.js` and `delivery.css` from Outreach after Step 6 initializes.
- [ ] Gate Step 7 on at least one approved outreach package.
- [ ] Open approved email in Gmail compose via generated URL.
- [ ] Require explicit `Confirm sent` before recording delivery and advancing to Contacted.
- [ ] Record reply text and classification, then update pipeline to Replied/Meeting as appropriate.
- [ ] Add manual Meeting/Proposal/Won/Lost outcome controls.
- [ ] Render activity history and learning scorecard/segments/recommendations.
- [ ] Export connector-neutral delivery/learning JSON.
- [ ] Never call Gmail APIs or auto-send.

### Task 3: CI hardening
**Files:** Modify `.github/workflows/customer-ci.yml`.

- [ ] Keep full `node --test customer/test/*.test.js` suite.
- [ ] Add syntax checks for `customer/delivery-engine.js` and `customer/delivery-ui.js`.
- [ ] Open PR and verify Customer V2 CI is green.

### Task 4: Integration verification
**Files:** No production changes unless verification reveals a defect.

- [ ] Confirm PR contains no `v2/**` changes.
- [ ] Confirm full tests and syntax checks pass on final PR tree.
- [ ] Merge only after PR is mergeable and CI successful.
- [ ] Confirm `main/customer/delivery-engine.js`, `delivery-ui.js`, `delivery.css` and existing `/v2/` remain present after merge.
