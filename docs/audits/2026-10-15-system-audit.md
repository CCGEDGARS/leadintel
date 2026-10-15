# LeadIntel system audit — 15 October 2026

## Verdict

Scoped safety and consistency fixes are suitable for release after exact-SHA CI/deployment proof. **This is not an unconditional SaaS launch sign-off.** Mobile visual QA, fresh Google/Microsoft OAuth, external-provider research quality, real delivery/reply/booking cycles and unattended production execution were not exercised. No emails, paid research, campaigns or customer-record mutations were performed by this audit.

## Source, authority and conflicts

- Repository: `CCGEDGARS/leadintel`; base `6c5265aa204efcefc0ec59e22ac806cb439ad101`; isolated branch `audit/2026-10-15-system`. Older checkouts with unfinished changes were left untouched.
- Frontend: https://leadintel.ccgroup.lv/customer/ (Vercel). Backend: https://leadintel-api.edgars-7e7.workers.dev (Cloudflare Worker/D1). GitHub Pages is retired.
- Read `AGENTS.md`, template rules, market-intelligence and release-integrity skills, September cooperation checkpoint, October prevention rules and the attached August 28 Master CRM design.
- The August V1 exclusions of company imports and automation/campaign sequences are superseded by the newer approved campaign/import and automatic-flow work. Its step numbers are obsolete: current navigation is Setup → Profile → Strategy → Companies → Buyers → Messages → Delivery. CRM remains cross-process.
- Public-source person/email confirmation is the default; Apollo/Hunter deliverability verification is optional. Researched ownership is not proof of mailbox deliverability.
- Current approved messaging: split layout, styles and assistant launcher on left, expandable Writing Assistant, one optional book/material, separate follow-up assistant, protected originals.
- The October 14 manual-limit implementation note said backend quotas were unchanged. This contradicted the user's approved manual-work exemption and left a decorative UI-only change. This audit removes application daily caps from deliberate manual sends, including reviewed campaign Send; automatic queue/flow mailbox limits and provider-imposed limits remain.
- No approved template literals were rewritten, no dependencies added, no schema migrations added, no provider keys/billing/access settings changed.

## System map and coverage

| Area | Relevant implementation/test evidence | What was verified / limit |
|---|---|---|
| Setup → Profile | profile-engine, website-activation, company-research-ui, workspace-persistence; profile handoff/recovery tests | Baseline/final suite covers website normalization, extraction errors, state/race guards, save/reload and incomplete evidence. Live existing session/profile navigation only; no paid extraction. |
| Strategy → Companies | market-engine, discovery-engine/UI, effectiveTargetingProfile; strategy-switch-effects, icp-switch-persistence, discovery tests | OFF profiles excluded from new search/qualification; all OFF prevents new-company query planning; known targets remain researchable; useful existing results retained on empty/error runs. Live shortlist and Strategy observed. |
| Research | market-intelligence policy, interactive research/provider-resilience/verifier paths, ai-task-routing, service-integrations | Quick/Market/Deep interactive paths, source grounding/fallback tests run. No real source-quality or token-cost acceptance. Scheduled monitoring is a separate bounded Firecrawl path; see limitations. |
| Monitoring | app.js → authenticated monitoring config API → D1 → due scheduler | ON/OFF persistence, dirty disclosure, failed OFF rollback, explicit empty categories, delayed load/save context protection tested. Live open/close without changing enabled/configuration. Scheduled execution not invoked. |
| Companies/imports/shortcuts | email-campaigns/client/UI, campaign-plan/research; campaign tests | CSV/company-only briefs, direct writer route, entire imported list not expanding to unrelated CRM contacts, recipient selection, revision/approval invalidation tested with fixtures. No live imports or campaign creation. |
| Buyers/contact truth | CRM, public-email-confirmation, contact-confirmation-policy, automatic-email-verification | Identity/ownership evidence and optional paid confirmation paths tested; generic write spoofing and email-edit proof transfer corrected. No live enrichment or deliverability test. |
| Messages/assistant/materials | message-editor/studio/workspace, writing-assistant/context/references, follow-up-assistant | Existing protected-original, race, attachment, explicit apply/save and follow-up tests run. Live split workspace, launcher/modal, single material control and follow-up disclosure observed. No generated or saved customer messages. |
| Sending/automation | saas-routes, Gmail/Microsoft adapters, email-campaigns, outreach-automation-runner, approved/saved-flow runners | Mock provider submission, ambiguity, duplicate keys, persistence failures, suppression, archived recipients, manual/automatic limits, follow-up scheduling and approval/stop regressions. No actual delivery or production runner activation. |
| CRM | crm/routes, dedicated D1 migrations, CRM client/UI | Baseline/final suites cover domain/contact dedup, pipeline removal preserving records, lifecycle, migration, suppression and workspace isolation. Live list/detail showed contacts, intelligence and activity; no lifecycle mutation. |
| Accounts/data | oauth, account-cache, server-bridge, customer-state, workspace persistence | Two-account fixture round trips, stale-tab/request guards, recovery archival failures, session expiry and provider isolation tests. Existing live owner session observed; fresh OAuth and second-user/device live tests not performed. |
| Provider ownership | workspace AI/service integrations and task routing | Credential selection is workspace-scoped, authenticated and encrypted; inspected paths have no shared paid fallback. Settings accurately separates connected, active/main and specialist usage. No credential validation/generation call initiated. |
| UI/design | compact panel styles, Settings, Strategy, Messages, CRM | Desktop screenshots/DOM inspected. Comparable monitoring disclosure works; disabled prerequisites and explicit statuses observed. Existing responsive tests passed, but no true mobile viewport capability was available. No speculative visual redesign. |

## Verified defects and changes

| ID | Severity | Root cause / evidence | Resolution and regression |
|---|---|---|---|
| A01 | P1 | Automation treated a network timeout after submission as retryable (`outreach-automation-runner.js`). Database idempotency cannot prevent a second provider POST after lost confirmation. | Only positively identified pre-submission failures may retry. Unknown outcomes and legacy `transient` failures stay held. Injected accepted-then-timeout and second-run tests assert one provider submission. |
| A02 | P1 | Manual Gmail/Microsoft catch covered provider send plus database/activity/CRM work (`saas-routes.js`), so bookkeeping failure changed a delivered message to failed. | Confirmed provider result remains authoritative; sync failure is separately returned. UI reports synchronization uncertainty without recommending resend. Tests inject event and primary confirmation persistence failures for both providers. |
| A03 | P1 | Manual transport ambiguity was recorded as failed; archived companies could reach provider before CRM transition rejected them. | Unknown delivery keeps reservation unresolved and returns explicit Sent-folder reconciliation guidance. Same key cannot submit again. Archived companies rejected before send. Transport adapters distinguish definite rejection from ambiguous/5xx results. |
| A04 | P2 | Generic CRM writes accepted caller-supplied verified status; email edit preserved old provider/timestamp (`crm-routes.js`, `crm.js`). | Generic writes cannot assert provider/public confirmation. Editing normalized address clears status/provider/time; ordinary metadata updates preserve established evidence. Case-variant spoof, company-embedded contact, PATCH and existing-contact tests. |
| A05 | P1 | Monitoring loads/saves applied after active state replacement; global loaded flag prevented retry/new-context load (`customer/app.js`). | Capture market, account epoch and workspace; reject stale work before request, after JSON, and before commit. Failed loads retry. Late cleanup re-enables current controls without old data/toasts. Deferred success/failure/context-change tests. |
| A06 | P2 | Failed OFF save left unchecked UI despite enabled saved schedule; removing a research website also changed only the local monitoring copy and claimed both were removed. | Failed saves restore confirmed switch while preserving other draft edits. Research removal affects research only and directs scheduled changes to monitoring settings. Tests assert both state and visible controls. |
| A07 | P2 | Manual send limits hidden in UI but enforced as 20/day in Gmail/Microsoft and automatic default5/day in campaign Send. Activity API still advertised daily20. | Remove application cap only from deliberate manual endpoints/campaign Send. Activity API marks manual limit/remaining as null. Automatic queue/flow caps remain. Tests send above20 with automation policy1 and retain queue limits. |
| A08 | P2 | New backend sync warnings were initially not represented by the mail UI. | Confirmation and CRM sync are separate; both providers and both direct message/delivery surfaces tested. Unresolved same-key duplicates are never counted as sent. |

All behavior regressions were observed failing before correction. Astra reviewed the high-risk diagnosis and final scoped changes; Sol implemented bounded delivery/CRM fixes. The root agent handled monitoring, integration, live inspection and final release gates. No model/token usage meter was exposed, so no cost or consumption claim is made.

## Test evidence

Baseline on exact base SHA:

- Customer: 2,671 passed, zero failed/skipped (96.7s).
- Backend: 621 passed, zero failed/skipped (33.7s).

Final checks:

- Backend: **629 passed**, zero failed/skipped (26.0s).
- Customer: **2,682 passed**, zero failed/skipped (110.1s). First post-change full run had 2,680/2,682 passing: two fixture failures (single-line extraction of a now-multiline function; synthetic shell missing new cache proof markers). Both fixtures corrected, affected 13 tests passed, then full suite rerun.
- Monitoring/research focused group: 40 passed; delivery/CRM/automation focused group: 118 passed; mail UI focused: 15 passed.
- Python Scrapling safety tests: 4 passed.
- Syntax: all 23 changed JavaScript files checked; `git diff --check` clean.
- Vercel artifact build passed, including staged discovery/deployment checks; public output excludes source/test/private trees under existing build safeguards.
- npm audit: customer production dependencies and all backend dependencies reported zero vulnerabilities. No lockfile/dependency changes.

## Live observation evidence

The browser used an existing authenticated session. Inspected Settings → Strategy → monitoring open/close → Messages → Writing Assistant open/close → CRM list/detail → follow-up disclosure. Desktop Settings and assistant screenshots were visually reviewed. Existing data and navigation reloaded successfully; no send, research, save-message, activation, import, CRM edit, credential update or paid test action was invoked. Normal application navigation automatically persists UI position; this is not evidence of testing customer record writes.

Settings showed distinct identity and sending-mailbox connection states, active tools and optional Hunter switch. Messages preserved an existing working copy and correctly required save before adding it to flow. CRM list/detail exposed durable contacts/intelligence/activity independently of pipeline membership. Follow-up generation remained gated until required context was available. Captured console errors were browser-extension metadata errors; they are not attributed to LeadIntel.

No mobile screenshot, fresh login, real email receipt, research-result quality or multi-device mutation/recovery claim is made.

## Remaining issues and exact blockers

1. **P2 operational recovery:** provider acceptance followed by unavailable confirmation storage can leave durable `sending`, while response reports success with sync warning. Unknown/legacy transient attempts intentionally stay held. Same-key resend is blocked, but automated reconciliation is absent. Operator must inspect the connected mailbox before any new send; production mailbox operation was excluded by audit safety constraints. Existing ambiguous rows were not changed.
2. **P2 research-depth limitation:** scheduled monitoring in `backend/src/market-monitoring-engine.js` / `market-monitoring.js` is a bounded Firecrawl search/scoring loop. Quick/Deep differ mainly by term/query/result budgets, unlike the interactive research path's broader adaptive verification. Do not represent this as full interactive Deep Analysis or proven high-confidence intelligence. A complete scheduled research acceptance test would require controlled external-provider execution and semantic result review, excluded here; no speculative scheduler redesign was introduced.
3. **P1 release-verification gate, not a discovered runtime bug:** both OAuth providers, second account/device, live background flow, replies/Calendly stop events, and real provider costs/quality remain unverified. Mock coverage cannot close these product acceptance gates. Fresh login would replace the existing browser session; real research/delivery would violate this audit's no-charge/no-send constraints.
4. **P2 visual gate:** mobile layout remains unverified in a real narrow viewport; available browser API exposes no viewport resize/mobile emulation. CSS/static tests alone do not establish visual acceptance.
5. Historical CRM data is preserved. This change prevents new verification spoofing/transfer; it does not retroactively establish the provenance of existing legacy records or clean customer data.

## Release provenance

Baseline Vercel deployment `dpl_6sVRpAeQknF6kYXyoptUVEcq44Es` reported READY for the base SHA. Live release.json matched; backend health200 reported `6d97819d61d2c83f2c92ceac4826dc9192c5e090` (subsequent base commit changed frontend only). Same-SHA Customer CI `38709313765` and Release Integrity `38709473248` succeeded.

Fix deployment must be verified separately: exact merge SHA → required same-SHA CI → backend deployment → matching live manifest/backend SHA → all mandatory smokes → `release-proof.json` PROVEN. Added `system_audit_version=20261015-delivery-monitoring-v1` health identity and cache/safety smokes. Final commit, PR, proof verdict and deployment URL belong in the delivery report; baseline evidence must never be substituted for proof of these fixes.
