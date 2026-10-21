# Company Dossier First Implementation Plan

> For agentic workers: execute inline using executing-plans, with test-first checks.

**Goal:** Put two-provider sourced company research before buyer selection in both flows.
**Architecture:** Shared portable dossier evidence contract; workspace-scoped backend orchestration and settings; existing discovery and CRM integration.
**Tech Stack:** JavaScript, Cloudflare Workers/D1, existing provider adapters and browser modules.
**Spec:** docs/superpowers/specs/2026-10-21-company-dossier-first.md

## Global Constraints
- Preserve customer ownership of credentials, source evidence and per-person mandatory contact checks.
- Two distinct providers execute live search; an offline review cannot substitute.
- No fabricated identities/emails, paid reveals or sending.
- Preserve workspace isolation, cancellation, CRM persistence and exact-SHA release proof.

## Review Focus
- A provider returns sources but no readable passages: partial, never confirmed.
- Same name has conflicting titles/dates: retain conflict, prevent silent stale role replacement.
- Workspace changes during research: no stale state or writes.
- Only one connected provider: fail before any paid call.
- Refresh fails after prior success: keep prior dossier and expose failure.

### Task 1: Shared evidence contract and regression fixtures
- [x] Write failing tests for citations, dates, prose identities, reconciliation and normalization.
- [x] Implement customer/company-dossier.js and backend provider adapter; test all three providers.
- [x] Run focused tests; commit.
### Task 2: Workspace orchestration and settings
- [x] Write failing tests for primary/secondary/failover independence, single-provider preflight and auth.
- [x] Implement backend/src/company-dossier.js, D1 settings migration and AI routes.
- [x] Run backend suite; commit.
### Task 3: Journey, UI and persistence
- [x] Write failing tests for dossier-before-buyers, CRM reload, settings and cancellation.
- [x] Integrate manual and automatic flows, compact dossier and Settings overrides; retain all contact gates.
- [x] Run complete customer/backend tests and static build; commit.
### Task 4: Review, publish and live verification
- [x] Review whole diff independently; fix material findings with regressions.
- [x] Publish branch/PR, CI, merge and exact-SHA production proof.
- [ ] Fresh authenticated Stegra acceptance, persistence and downstream checks; report exact outcome.

## Verification checkpoint
- Independent review completed; seven material findings corrected: successful refresh retention, identity-level conflict holds, person-specific role/date attribution, future assignments, provider resume, seller/role race guards, and Gemini objective budgeting.
- Customer suite: 3,395 passed; backend suite: 761 passed. Static build and Worker dry run passed.
- Git main fork confirmed at bc46b5f1545ff27179674988052ed41531f08bea. User explicitly requested integration and repository instructions require release and authenticated acceptance; proceed through PR and CI without another integration-choice prompt.
- Release proof and authenticated research outcomes remain separate acceptance gates.

## Authenticated acceptance finding
- First fresh Stegra attempt returned two failed passes after the per-provider deadline windows. Existing buyers survived and the dossier was marked incomplete; this does not satisfy research acceptance.
- Fresh integration status confirmed both engines executed. Eight sources at three concurrent readers could consume the 90-second pass allowance through serial extractor fallbacks, leaving no guaranteed extraction time.
- Follow-up bounds each page read, starts six readers, shortens direct/Firecrawl waits only for dossier reads, and budgets extraction output. Receipts now retain phase, elapsed time and actual source counts. Source and mailbox evidence requirements remain unchanged.

## Extraction and coverage acceptance finding
- Second fresh Stegra attempt: Gemini completed in 64 seconds with four people and no contact routes; OpenAI read 8/8 sources but hit the extraction deadline at 90 seconds. This remains below the requested benchmark.
- Compact extraction now selects server-numbered source passages; the server restores exact quotes and URLs, reducing repeated model output. Leadership/recent-change and contact-route searches run separately within each independent provider, with balanced source slots.
- Failed required search families remain partial and resume without repurchasing successful family searches. Partial supported evidence stays visible. Provider signatures invalidate earlier checkpoints that lack the required family policy.
- Independent follow-up review found and regression tests cover cross-person title attribution, provider-order loss of scheduled departures, and false completion from contact-only search success. Shared module changes now trigger backend CI/deployment.

## Gemini extraction acceptance finding
- Production d16468065e4c1c43a8457957b47ff3677b16dd76 passed exact-SHA CI, backend health and all 325 mandatory smoke checks; release proof verdict PROVEN.
- Third fresh Stegra run: OpenAI completed in 80 seconds after reading 10/10 sources. Supported partial evidence included 11 people, all three delivery-area directors, the CEO transition and six published company routes. Gemini read 10/10 sources but timed out during extraction; resuming cached searches returned invalid extraction JSON after 21 seconds. No confirmed named buyer emails were obtained.
- The Gemini text adapter ignored the requested low reasoning effort. Dossier extraction now opts into JSON MIME, honors the supported model-specific low thinking control, and allows 6000 total output/thinking tokens for Gemini. Explicit MAX_TOKENS responses fail before parsing. Ordinary text calls without these options retain their previous request shape.
- Provider regression tests failed before the fix and passed after it. All 770 backend tests passed; independent follow-up review found no material issues. Live dual-provider completion and downstream acceptance still require verification.
