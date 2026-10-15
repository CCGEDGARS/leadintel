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

## Step 6 deep review — subsequent focused work, 15 October

### Scope and version

The user redirected work to Messages as LeadIntel's principal selling point after reporting a successful Microsoft sign-in. That report is owner acceptance only; the external user's confirmation is still pending. This section records the subsequent Step 6 inspection and local corrections separately from the earlier system audit.

- Inspected base: `4f10010e5215cdeaa5248a392d5db5d5ab17fb47`, repository `CCGEDGARS/leadintel`, starting in detached HEAD; isolated follow-on branch `audit/2026-10-15-step6`.
- Browser inspected: https://leadintel.ccgroup.lv/customer/ in the existing authenticated owner session. The new changes below are local; no new production release is claimed.
- Existing build/cache debris was left untouched. No new dependencies, protected template wording, customer draft text or CRM records were deliberately edited. Normal UI navigation can autosave workspace UI state.
- The August CRM baseline requires durable content activities attached to canonical company/contact records. The newer October decisions govern the split composer, protected templates, explicit Save, one optional reference material and separate follow-up assistant. The older October 12 assistant spec's transient chat/three visible uploads is superseded by October 13's bounded browser-local conversation and one visible upload, preserving existing legacy materials.

### Product judgment

Step 6 has a substantial working foundation: buyer/seller context, reviewed triggers, protected templates, explicit assistant proposals, source-aware reference material, recoverable working copies and a separate sent-history follow-up flow. The present interface conceals much of that value behind warnings and separate disclosures. It is not yet sufficiently clear or independently quality-tested to sign off as the finished flagship experience.

The most useful product direction is to expose the existing reasoning chain: **buyer context → supported reason to contact → message → reviewed change → saved handoff**. This is a design judgment, not a demonstrated conversion improvement. Message effectiveness has not been measured in this review.

### Verified functional defects and local corrections

| ID | Severity | Evidence / cause | Local correction |
|---|---|---|---|
| S6-01 | P2 accessibility | In the authenticated assistant, Shift+Tab from Close with the material disclosure collapsed remained on Close. `writing-assistant-ui.js` included controls inside closed details in its manual focus loop. | Exclude collapsed/nested disclosure descendants, hidden/inert/disabled controls and negative tab stops. Preserve ordinary internal Tab behavior. Regression exercises closed and expanded nested panels. |
| S6-02 | P2 broken proposal handoff | `backend/src/writing-assistant.js` approved URLs from recursively traversing all supplied context; `writing-assistant-context.js` permits only current-draft links and explicitly supplied top-level seller URLs. A research/evidence URL could pass generation but fail Apply. | Align backend prompt and validation with the existing restrictive Apply rule. Cross-layer tests run both validators against the same allowed and rejected URLs. |
| S6-03 | P2 broken proposal handoff | Assistant generation knew only a 12,000-character cap, while Apply additionally enforced a canonical core word ceiling. An otherwise accepted proposal could therefore be unusable. | Capture the applicable ceiling from the canonical `coreContract`, include it in the assistant request/prompt, and validate before preview and again at Apply. Test exact boundary and one-over for all four core styles. No literal master changes. |
| S6-04 | P2 incorrect language/custom limits | Chat Apply and direct Shorten/Rewrite imposed the selected core's English ceiling even for translated working copies and personal patterns. The template policy explicitly gives these separate authority. | Use the same applicability predicate for chat and direct adjustments: English core email only; exempt translations, events, LinkedIn, AI Original and personal/custom patterns. Mounted direct-adjustment tests cover both actions across seven contexts. |
| S6-05 | P2 broken proposal handoff | Backend accepted an empty/whitespace email subject; Apply rejected it. | Reject blank email subjects before exposing a proposal. Keep LinkedIn's empty subject requirement. |

The changed frontend modules receive a cache-bust through the existing index → discovery → outreach import chain. The optional word-limit field allows older clients to continue working during rollout; the refreshed bundle is needed to supply that constraint. These controls do not certify semantic truth and do not grant save, approval or send authority.

### Observed design gaps and recommended bounded polish

| Priority | Observed issue | Proposed change and acceptance criterion |
|---|---|---|
| P2 | At a 1348×925 desktop viewport, recipient metadata, editor statuses, actions and the large recovery warning pushed the email body below the initial viewport. Global “Saved automatically” coexisted with local “Unsaved changes.” | Keep the split layout. Distinguish “Workspace synced” from “Message needs Save”; consolidate editor state into one concise row and one recovery disclosure. Make the email and its next required action visible earlier. Do not weaken the Save/Add-to-flow gate or hide an unresolved recovery warning. |
| P2 | The assistant says the current draft is connected but does not show that draft inside its modal. The user must remember it when evaluating a proposal. | Add a read-only current-draft view and compare it with the proposed subject/body before Apply. On mobile stack the views; do not introduce a second editable draft or a new save path. Reuse the captured editor snapshot and stale-context guard. |
| P2 | The trigger card says “Applied in the email” and “Selected automatically.” The observed source link points to the company homepage and no date/review status is visible there. Neither label establishes factual verification or current buyer need. | Reuse existing evidence in a compact “Why this message” disclosure: trigger, source/excerpt, known event date, review status and relevant seller capability. Show unknown dates/support plainly. Keep buyer need conditional unless separately evidenced. Do not invent a numerical quality/conversion score. |
| P2 | Material count “1 material” does not reveal that the stored book is OFF until the disclosure opens. The modal has both Attach and Add entry labels. | Keep one material control; expose “Ready · Not in use” or “In use” beside the closed disclosure. Clarify that it is AI reference material, not an outgoing email attachment. Preserve existing active/inactive behavior and legacy stored sources. |
| P3 | Context displays internal `brutal · en` codes. Reset sits beside Shorten/Rewrite while approved-template restoration and Update exist elsewhere. | Display “Brutal Honesty · English.” Explain Reset as “Restore first version” and Update as rebuilding from the current template/facts. Preserve exact recovery semantics. Use clear working-copy language for explicit rewrites. |
| P3 | The assistant opens with a large empty transcript and a broad question field. Direct Shorten/Rewrite applies an alternative, whereas chat offers Apply/Discard; the difference is easy to miss. | Use compact guidance and, if adopted, a few suggested questions that fill the prompt without submitting: assess relevance, flag unsupported claims, clarify the request. Clearly label direct adjustments versus proposed edits. Keep the approved immediate quick-action behavior unless the user explicitly changes that decision. |
| P3 | Follow-up assistance is below the long first-contact message, while global Business & Research assistance is in a separate rail. | Preserve the separate follow-up workflow and distinguish each assistant's purpose. An in-page shortcut can reveal the existing follow-up panel without adding another assistant or another draft store. |

Recommended sequence: ship the verified contract/accessibility fixes after release gates; then improve editor hierarchy, material status and readable labels; then add current/proposed comparison and the evidence disclosure. The last two are proposed product additions, not implemented features. Avoid introducing more tone styles, parallel draft editors or speculative automation during this polish.

### Functionality traced and verification limits

- **Core messages and shortcuts:** existing mounted tests exercise canonical style selection, five subject choices, blank new-recipient state, recovery/Undo/Reset, manual text preservation, CRM-shaped serialization, event/channel separation and context races. The preserved long working copy visible in the browser is not evidence that the current core generator produced it; the recovery warning is explicit.
- **Writing Assistant:** captures the visible draft and active recipient/workspace, reviewed seller/buyer context and selected references. Requests use the authenticated workspace's active AI integration. One in-flight request, bounded history, cancellation, late-result rejection, source revision checks and explicit Apply are covered. Apply invalidates saved approval and preserves original/undo history; it does not send.
- **Material OFF/ON:** code and tests reject inactive/stale/non-Ready source references; selected active sources use bounded lexical retrieval and validated passage IDs. Live owner data showed one book, “Ready · Not in use,” checkbox OFF, Writing guidance role, 112/113 readable pages/sections and 211 learned techniques. Those are observed application labels, not an independent audit of the book or every extracted technique. We did not activate, upload, replace or delete it. A source may guide writing without supplying verified buyer facts. Retrieved passages do not mean the entire book was read for a given request.
- **Follow-up:** live disclosure loaded sent context and correctly requested the actual previously sent message/date when no complete body was available. No-reply mode exposed last-contact confirmation; the original reply mode was restored and the panel closed. Generation/save were not invoked. Backend tests exercise contact/workspace ownership, sent chronology, suppression, quoted reply evidence, no-reply frequency gates and separately saved CRM drafts. Browser-local unsent follow-up work is not proven cross-device durable.
- **Persistence:** assistant conversation/instruction is bounded browser-local state, scoped by workspace/buyer/channel with account-cache guards. It is not cloud conversation sync. Durable working message and follow-up save paths are separately covered by fixtures; no customer Save or flow launch was used for this review.
- **Runtime recovery:** during UI navigation, the header briefly showed a sync retry and browser calls timed out. A later DOM check showed the original follow-up mode restored, panel closed and “SYNCED TO LEADINTEL / Saved automatically.” No persistent defect or root cause was established from that transient observation. Extension metadata errors are not attributed to LeadIntel.
- **Safety:** no paid AI/research/verification call, email submission, campaign launch, billing change or deliberate customer-record mutation was performed. Existing follow-up history reads and UI disclosures were used for runtime inspection.

### Step 6 test and acceptance record

Fresh focused baseline at the inspected SHA: **382** message-workflow tests (`npm run check:step6`), **103** customer assistant/material/follow-up tests, **69** backend assistant/reference/follow-up tests; all passed with zero skips. These overlap with earlier whole-system suites and must not be added to them as unique coverage.

Local regression verification: 90 affected tests passed, then 12 backend tests passed after the final subject-validation case. Astra independently ran 17 focused tests and found one regression in the new metadata: `maximumWords` entered the existing numeric evidence scan. The final correction excludes that formatting value from factual evidence; its regression rejects a fabricated quantity equal to the ceiling, while allowing the same quantity when explicitly supplied in seller facts. All 16 assistant backend tests passed after correction; Astra independently confirmed the new regression and reported no remaining blocker in the reviewed change.

Final checks on the final source:

- Customer: **2,685 passed**, zero failed/skipped (74.3s). The first full run exposed nine failures in three mounted-test files because their stripped-import harness omitted the actual WritingAssistantContext dependency. The two shared/individual fixtures now load that real module; the affected 29 tests passed before the full rerun. Production already imports the module before editor handlers execute. No assertion or production guard was weakened.
- Backend: **635 passed**, zero failed/skipped (15.7s). The preceding full run passed 634 before the additional numerical-evidence regression.
- Static build passed, including the existing discovery deployment checks. Syntax checks passed for all 12 changed/new JavaScript files; `git diff --check` clean.
- Remote `main` still resolved to `4f10010e5215cdeaa5248a392d5db5d5ab17fb47` at final review. Its existing production proof was `PROVEN` at `2026-10-15T09:31:29.807Z`; this is **LAST KNOWN WORKING** evidence for the prior release, not proof of these local Step 6 fixes.
- Sol implemented the bounded fixes and test harness corrections. Astra reviewed the change independently and verified its blocker correction. The root review covered actual desktop behavior, evidence/approval boundaries, integration, final checks and this product judgment.

Open acceptance gates:

1. **P1 release gate, not a newly observed production failure:** local Step 6 fixes have no same-SHA production CI/manifest/backend/smoke proof yet. Do not describe them as deployed.
2. **P2 visual gate:** real mobile/narrow viewport and post-fix native-browser keyboard verification remain outstanding. The available browser has no viewport resize API; local jsdom tests cannot prove pixels or native rendering.
3. **P2 content-quality gate:** fresh model output, source relevance, language fluency and meaningful personalization need representative fixture-based human assessment with explicitly authorized provider calls. No paid calls were permitted here; passing structural checks does not prove persuasive quality or factual entailment.
4. **P1 broader SaaS acceptance gate:** second-user Microsoft confirmation and cross-device save/recovery remain pending. The owner's reported Microsoft sign-in is useful evidence but does not close the other user's result.
5. **P2 integration acceptance gate:** real receipt/reply/scheduler/stop behavior remains excluded by the no-send constraints; mocks demonstrate behavior under the tested scenarios only.

No model token, credit or price meter was exposed for this work. No consumption estimate is reported.
