# Instruction 7 independent controlled review

Verdict: PASS for the frozen, locally controlled code scope below; no unresolved finding remains in that scope. This is not production, authenticated customer, recipient-delivery or business-outcome acceptance. Buyers remains OPEN. Authenticated/live outbound acceptance remains BLOCKED. No real provider, paid lookup, activation, credential mutation, outreach, commit or release was performed by this reviewer.

Baseline: `69a5905b20d469c3ca3c14ac80121013a65892ad`; branch `codex/delivery-system-reliability-audit-20261031`. The working-tree runtime is identified by `independent-final-frozen-hashes.json`, not by an invented final commit SHA. All 45 runtime hashes remained unchanged across the final backend review runs and final comparison.

## Executable evidence

- `independent-final-provider-queue.txt`: 228/228 PASS, zero failures/skips. Actual manual routes, full-migration SQLite, controlled OAuth/send/thread boundaries, supervised plans, queue/DST/capacity/replies, exact content and retained acceptance.
- `independent-final-workflow-operations.txt`: 216/216 PASS, zero failures/skips. Actual workflow/saved-flow/campaign handlers, native execution checkpoints, approval and owner/session/source transaction races, orphan recovery and diagnostics/scheduler hooks.
- `independent-final-ui-focused.txt`: 65/65 PASS, zero failures/skips. Shipping mounted UI modules, takeover confirmation and own-refresh race, current source and exact recipient, uncertain submission recovery, two-industry composed seven-stage fixtures, actual campaign UI and safe trace behavior.
- 509 targeted tests across these three final commands; this is not the complete repository suite. Parent complete-suite and browser/release evidence remain separate.
- `independent-final-preservation.json`: 44 JavaScript syntax checks PASS; five listed protected authorities are byte-identical to baseline. `git diff --check` PASS.

All external-provider behavior was replaced by deterministic fixtures. Tests exercise actual application modules and SQLite transactions; these are not authenticated production observations or claims of real contact yield.

## Independently reproduced findings and closure

| Finding | Original observed result | Final independently observed behavior |
|---|---|---|
| Unknown delivery could bypass a key or provider hold | New key after simulated post-submission timeout caused two provider calls and two sending rows for Gmail and Microsoft. | Original key remains held; new key, other provider and concurrent distinct keys cannot create another submission. One call. |
| Caller-controlled campaign prefix bypassed source before queue | `campaign:nonexistent:...` plus null source returned 201 and queued. | Source stamp, actual campaign approval, complete content and live internal delivery lease are required before queue. |
| Persisted campaign could carry unreviewed follow-up/HTML | Executed campaign authority returned true for an unreviewed follow-up; queued calls omitted HTML from their comparison. | Follow-ups are rejected; persisted initial subject/body/HTML/recipient and the reviewed member draft are compared. |
| Public LinkedIn identity alias was omitted across paths | Changed/conflicting public alias still produced actual route/runner provider calls in manual, queue and supervised paths. | Manual routes return 409/zero calls; queued and supervised paths hold before dispatch. Campaign original context includes the alias. |
| Pending queue and manual delivery could both send | Queued initial, then manual send, then worker produced two submissions. | Manual send is blocked while managed future intent exists; owner can explicitly cancel only known future steps, preserving sent/unknown evidence. |
| Accepted automatic revision could be manually replayed | Completed automatic initial, then the same exact text/HTML/source through manual delivery produced another call. | Automatic and supervised acceptance reservations carry the interoperable content hash; same rendered revision remains held across fresh key/provider. A distinct reviewed follow-up stays available. |
| Archived company was accepted into queue | Actual archived-company request created active/queued intent. | Archived company is rejected before queue. |
| Status could return private data after revocation | Revocation at final status read still returned 200 with mailbox and pending recipient. | Same actual-route reproduction now returns 401 without private payload. |
| Own cancellation was misreported stale after concurrent refresh | Final focused UI run failed its positive case; concurrent refresh removed the successfully canceled row. | Pre-dispatch row ownership is retained, while request-correlated success remains acknowledged after its own row disappears. Deterministic reproduction and final mounted UI tests pass. |

Independent reproductions are retained as `independent-*-repro.*` in this work directory. Findings were sent promptly to their owners; reviewer mutations were limited to work fixtures and this evidence record. Source review also caught and the owner corrected a create/duplicate audit-context variable shadow; final saved-flow authority tests pass.

## Scope and limits

Reviewed source authority before queue/dispatch; original recipient, sender and current owner; separate approval/activation; exact rendered transport; provider uncertainty and durable acceptance; same-key replay and cross-path reservations; atomic limits and current schedule/window; pause/stop/cancel/follow-up controls; repeated workers and retained holds; post-acceptance CRM failure; revoked upstream approval/session/role; context switching; bounded diagnostic projections, private IDs, retention and real scheduler-hook ordering.

Manual Compose remains an external user action and opening it proves no send. Microsoft 202 and valid Gmail receipts establish provider acceptance, not inbox delivery. There is no universal/provider-side exactly-once guarantee, automatic Sent-folder reconciliation endpoint or complete mailbox ingestion. Unknown submissions and loss of durable acceptance stores remain held; the review does not authorize clearing them. Automated configured daily caps are separate from explicit manual-send authority; manual app daily caps were not introduced. Missing/bound historical approvals require review rather than silent resealing.

Monitoring is bounded receipt evidence, not a measured production SLA or delivered alert service. Charges cover bounded recorded Treg receipts with uncertainty retained; other provider monetary charges and final settlement remain unmeasured. Existing reply classification and polling bounds remain documented; Microsoft inbound sync is not implemented by this work. Real customer persistence, paid-provider settlement, contact outcomes and outbound delivery require their own authorized observations.

The root release owner must supply exact final SHA, full-suite/build/CI and matching PROVEN release evidence. No production freshness or customer acceptance follows from this code review.

## Frozen runtime source scope

- `backend/src/app.js` — `e811a330ea3325b899102a3326379cdcbf6261eb8bb02c3063b84b27a65e632d`
- `backend/src/approved-workflow-engine.js` — `64d297d9a97b987b67cdcb2013c17f10e0fa50d1a8d7dc6965e1d0cd862966e7`
- `backend/src/approved-workflow-routes.js` — `a58155d95d1deadd513637c423c6df2d8400a5eb8053094984bcfe0285a7554d`
- `backend/src/approved-workflow-runner.js` — `6362338662c37c0cecba03894fcb577af21b5e34c4bb4b3641c2871f37dfbc5e`
- `backend/src/approved-workflow-store.js` — `7871378afe215289b488c27f7d858ab4947f775d915bcfaa3234de8134bf17e5`
- `backend/src/conversation-workflows.js` — `fe0682f9e5cbdaab4536266bd71a13e685aaac5fd1d28f680a42bfb653e09d09`
- `backend/src/conversations.js` — `6e9d814ca9dc5ed0d2bf8325c661a44dc3a4356bd2f459b48238e033cf90d30f`
- `backend/src/customer-state.js` — `f07d5ed25b17ea3ae8413390d5400fc55335e823484062b8e832f73fb01fb732`
- `backend/src/delivery-idempotency.js` — `b74024d2ab6350bb2f85578d10d0fbfa0f8b7aa52629fa67a61ddc51aebbd681`
- `backend/src/email-campaign-routes.js` — `c7e70b93fd28a74a11e184e032ae32539e1e4579f0c0b8d9637a8f77277b5707`
- `backend/src/email-campaigns.js` — `3a5141159434be37f5c3a1fce8e2673ac68be2c8f6a7d902f9dbdc1f5fa62661`
- `backend/src/email-content.js` — `6a631b2be6b168fafc433e64b578bc79432da24ee17db0db05c08ce4b4363534`
- `backend/src/gmail.js` — `f840b9f0a5d65522528691fb744b754cd2e65b79c9877e4d47a86f86c1e04895`
- `backend/src/index.js` — `4fed265fd07a80179e7269943d140cea3eb3821fbf0def43ddec39e3e4c47e9a`
- `backend/src/message-delivery-authority.js` — `95cb5e15b1eb13a069ce4d227fe319820ea7251c77dc5b76bb31508fcd1f4090`
- `backend/src/message-source-authority.js` — `64d55158130e1376c5edfbdb24df6f31188f82d6a104e90654b01a22a0ba4d3d`
- `backend/src/microsoft-mail.js` — `6a29c7b168981ae790a6703da89ba890ed254516584f2eb255b19f1e8442e87e`
- `backend/src/operational-diagnostics.js` — `3b6683a53201a064cfe8883baf3122187de0a1e1000b090d7eb5e72a568d2f80`
- `backend/src/operational-observability.js` — `380b23c3a722369c7a4a4cf77324148f92efb247121a19e841763e9bdc7771de`
- `backend/src/outreach-automation-replies.js` — `1af48a235f41335efa4921737f4193c00e52a8b40037512110458d78148e3906`
- `backend/src/outreach-automation-routes.js` — `2564c9617bbefe72693ca784a27c6e3d3d93bef6df66e14b6e3d3b7e2b3b583c`
- `backend/src/outreach-automation-runner.js` — `a75589032842cedaf0cb5cedfc6f27de3f3ade099c32d12740cb251cee2a8eb0`
- `backend/src/outreach-automation.js` — `36a24ffe5146d539b2c8031cbcdadd2fdaa011587db2e4963d8802083ca7330b`
- `backend/src/queued-recipient-authority.js` — `d4836ab91899773980d56ba9df6071dda1b77f0c958452bfaaa35820d2e2fcb5`
- `backend/src/reviewed-recipient.js` — `06e5b03fe7f616fa5e6743d925bce2e631579143903031b44182834b47347619`
- `backend/src/saas-routes.js` — `da39764479140ea84a707765b723d049c339b91ca4b8dde8d50974e9504fabba`
- `backend/src/saved-flow-routes.js` — `b09c9d8ad4133775f6757887392d1b9b2afdbcf2e298e55bdc6b443575df9f19`
- `backend/src/saved-flow-runner.js` — `2c0857aac63c372f6e34d053d0981612104298c87e05520b98832c4abaa55349`
- `backend/src/saved-flow-store.js` — `049b583dc4b783d5edfcd34e7e6eb5a8eb77bde394796d1562ed19becbd4703e`
- `customer/app.js` — `3c6736cc8a52dc2a6abc89c00bfb772984a672054405a93a80c7d25e50dbf30c`
- `customer/delivery-engine.js` — `65d7784ae2b63db81cc945a1ba3f2d5eaf708d50d1664d838c6112690158aadf`
- `customer/delivery-ui.js` — `6c4fd3c1b41efb953ada55fcad266eb226f818be7de186dde3766dfa907d6d09`
- `customer/discovery-ui.js` — `0400dbb6626e2c9326d730aeb47925a7599d127f15a31b110885be4cb050da91`
- `customer/email-campaign-ui.js` — `ae9db341ff1b4b8e720f50d259dcacf4428c95b89d561d846677ab3cfe12dd94`
- `customer/index.html` — `0f53861c194c8a47dc63507c2da9a64686d939f91daab704353f7a85e6fe32c9`
- `customer/outreach-automation-delivery-handoff.js` — `fec0611dff507cf9366327218696fe0aad2647adb5d2723bcc9fd9006c67fc37`
- `customer/outreach-automation-loader.js` — `41ec07012184707830ee9bd32fbbfbb37fea789303133fb28b16d62315999043`
- `customer/outreach-automation-ui.js` — `a3a5d658820f0468f4e419ffef69d75430d0c5ab27f3d3d4f0c93c29b211c5dd`
- `customer/outreach-engine.js` — `bd35dd3b4e25bafeda43d30627fbe448c7d93eefa7cd2a3bd68f4e48e2e51297`
- `customer/outreach-ui.js` — `e530c66ef86216952e1e7d6029531859c239af0bdb3629db45777caf19a5a6e8`
- `customer/process-map.js` — `42eba38a076eb6cec054b215a4ff58fdede47c18c1daffe8fee03a5e98764beb`
- `customer/production-gmail-ui.js` — `eb5407ab358d646591491da1f65bcce6ac9cf2f206f994f6efea0d08b0b65534`
- `customer/server-bridge.js` — `4f21a434b0500fb09bee3770c69057662363ffca1298a72f473a06758f76a9fd`
- `customer/setup-operation-trace.js` — `2cb2e771172b77c284f34e4055d467a3c6af76f7b2409f2c5eae967155983a2a`
- `customer/shell-support-loader.js` — `2ffbf886a22dad1bfd9190f481b6862c12fbc5f05fafb6644122e9bc4e79ce95`
