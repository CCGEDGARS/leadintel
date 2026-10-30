# Setup reliability audit — 30 October 2026

## Scope and evidence boundaries

Trace website/domain entry, market selection, optional sources/materials, workspace creation and saving, provider connections, paid preferences, navigation and reload. Root-cause investigation and red/green behavioral tests precede fixes. Shared status/handoff: [master audit](2026-10-30-reliability-master.md).

Severity: P1 = private data/credential exposure, wrong-account action, lost evidence, or stale write; P2 = misleading completion or blocked recovery. Reproductions use controlled requests and local SQLite/DOM fixtures, not live customer data.

## Reproduced findings and corrections

| ID / severity | Requirement, expected vs observed, reproduction | Root cause / downstream impact | Fix and regression evidence |
|---|---|---|---|
| S1 P2 | Failed save must stay failed; activation reported active after false/refused/rejected/timed-out save | Activation swallowed persistence errors; fresh evidence could look durably saved | Require affirmative acknowledgement, retain local evidence and show retry-save guidance. `website-activation-reliability.test.js` |
| S2 P1 | Activation must retain its owner; change session/workspace/URL during scrape, event dispatch or save | Only the first post-fetch boundary was checked; late status/save could act on replacement context | Capture account/session/workspace/URL; assert before acquisition, after events, before and after save; block incomplete hydration; release pending state. Same suite |
| S3 P2 | Only intended HTTP(S) website syntax accepted; supply ftp/mailto or embedded credentials | Three normalizers prepended HTTPS inconsistently and could reinterpret input | Consistent rejection of explicit unsupported schemes/credentials; preserve IDN, fragments, HTTP and ports. Same suite |
| S4 P1 | Missing optional control must not delete saved sources; navigate after optional links panel removal | `readSources` treated absent input as empty input; downstream Profile lost links | Update only when control exists; explicit empty input still clears. `setup-source-preservation.test.js` |
| S5 P1 | Materials belong to initiating account; switch user in same workspace during list/delete confirmation/upload ticket | Only workspace and UI generation were compared | Include user, account ticket and cache validity in ownership; clear prior cards, reject stale responses/confirmation; check context before consuming ticket and after upload, including pre-bridge account invalidation. `setup-material-context.test.js` |
| S6 P1 | Settings confirmation must authorize original account; switch account while dialog awaits | AI/service/mailbox/paid handlers captured context after confirmation or only compared workspace | Capture user/workspace before await, recheck at every subsequent action and UI commit. `setup-settings-context-races.test.js` |
| S7 P1 | Newer settings/status must win; reverse requests or fail an old status load | Missing request ownership/generation; old completion could overwrite providers or clear new policy | Serial/context guards, captured busy ownership, reset cached keys/status on user change, stop diagnostic second read after switch. Same suite |
| S8 P1 | Legacy paid preferences require owner and explicit consent; submit canceled confirmation or viewer form | Older submit enabled Apollo before its own approval/role boundary | Owner/context preflight and confirmation before mutations; no provider lookup/send; preserve channel/provider approvals. Same suite and existing paid controls |
| S9 P1 | Connection errors must not expose provider credentials; fake upstream/network error echoes API key/account URL | Public verification errors copied raw messages | Sanitized provider/payment categories for service and AI checks. SQLite runtime tests |
| S10 P1 | New connection/disconnect must win over old provider check; delay verification then replace/delete key | Unconditional service metadata update/upsert after external await | Encrypted-credential compare-and-swap; reload authoritative status; 409 on superseded saves; verified replacement balance clears obsolete exhausted-credit warnings. `service-integrations-runtime.test.mjs` |
| S11 P1 | AI reconnect/model settings must not restore disconnected key or overwrite newer model | AI verification paths lacked credential/model CAS | Guard old key/model at commit; preserve newer setting and return conflict. `ai-engine-runtime.test.mjs`, `ai-integration-routes.test.mjs` |
| S12 P2 | Failed same-account verification must preserve entered retry key | New operation cleanup remounted failed cards | Keep failed card/input and restore button; clear keys on actual account changes. Existing `payment-connection-alerts.test.js` + race suite |
| S14 P1 | Credential/model save must reject revoked ownership; pause provider verification, remove/demote owner or revoke session, then release response | Initial authorization preceded external await; key/model CAS alone did not bind access at commit | Atomic session/owner predicate and explicit authorization rejection; independently reproduced before fix, 12 red/green cases covering removal/demotion/session deletion/expiry across service PUT and AI PUT/PATCH; independent 66-test runtime rerun approved |
| S13 P2 | Setup operation ID must survive first-party boundary | Proxy header allowlists stripped correlation in both directions | Preserve bounded ID header; backend validates it; correlate safe audit outcomes. `setup-trace-proxy.test.js`, backend runtime/CORS tests |

## Trace, authorization and persistence coverage

- UI source: `index.html`, `app.js`, website activation/input sync, company-materials, AI/service settings, additional-contact preferences. Required fields are website activation and at least one target market; materials, extra links and sender details are optional.
- Shared state: normalized Profile source fields → workspace persistence/snapshot → server bridge → first-party API proxy → authenticated Worker customer-state routes → workspace-scoped versioned records. Existing merge/conflict recovery retains both legitimate edits and a recovery copy.
- Backend acceptance fixtures exercise first-login workspace creation/reuse, missing membership, workspace isolation, viewer write denial, owner-only connection/research settings, saved preference reload, stale state 409 and no research/send side effects from preferences. `backend/test/setup-boundaries.test.mjs`.
- Existing policy gates distinguish email permission, phone permission, provider approval, budgets, automation selection and delivery authorization. No audit test relaxes consent or increases limits. A permission indicator does not assert provider readiness, remaining credits or a successful search.
- Source/activation cases: empty/invalid/duplicate entry, IDN, valid HTTP(S)/ports, fragments, readable redirect response, inaccessible/empty response, slow hydration, timeout/retry, duplicate install/clicks, same-company evidence refresh, changed company, changed account/workspace/user, failed persistence and reload.
- UI/layout evidence and final integrated test counts are recorded in the final verification section. Fixtures are clearly separate from authenticated customer behavior.

## Prevention and remaining limits

Meaningful regressions pin the broken boundary and adjacent paths. Cache-busting entry markers and new release smoke checks require these assets and the backend Setup version. A formerly stale root cache-chain assertion now verifies a directly loaded versioned journey/activation entry instead of hardcoding obsolete September stamps.

No new migration or monitoring platform. Reuse audit events, existing save/conflict/version diagnostics and bounded client trace. Source acquisition records are not independent provider web-research proof. Local SQLite does not prove production migrations. Direct website redirects remain attributed to the selected activation URL; this audit does not add DNS/redirect/private-host policy to the frontend.

Credential CAS protects replacements and disconnects of existing connections. A hypothetical initially-absent key → no-op delete → absent key sequence has no durable tombstone; ordinary UI has no Disconnect for absent credentials. It is not claimed as a verified protected transition. Best-effort audit logging also cannot prove an external request did not execute if no event is present.

## Final verification

Local code verification PASS: 4,211 customer tests (including three root suites), 1,226 backend tests, static build, changed JavaScript syntax and whitespace checks. Controlled Chromium fixtures at 1440/720/390 CSS pixels passed activation, Sweden/Kazakhstan selection, keyboard Continue to Profile, and reload retention with zero page errors/horizontal overflow; Continue was 72/72/58px high. Providers, authentication and persistence were controlled, and only the relevant production function/module paths were loaded; this is not a complete assembled authenticated browser test. The 720px layout is narrowed desktop coverage, not a native 200% browser-zoom test. Exact source/CI/production evidence is linked from the final PR and release-proof artifact; production remains NOT TESTED until those gates pass. Authenticated Setup → Profile save/reload remains BLOCKED: the managed environment has no customer session/production database authorization and Wrangler reports unauthenticated. No live credential mutation, paid lookup, delivery activation or outbound message was executed.


Final evidence handoff: [audit PR #781](https://github.com/CCGEDGARS/leadintel/pull/781). Its validation and release-proof links record the exact final source/merged SHA and observed CI/production status. This document records the pre-release audit snapshot; use the PR proof to resolve the pending production gate, never infer it from this document. Initial runtime code was locally verified at `9bba49abe849f6c7ae9cfb4646ba96a594c61431`; the independent authorization follow-up is verified separately on the final PR revision.

Independent final review found the commit-time owner/session gap (S14); its fix was re-reviewed and approved. All 12 new authorization races and the full 1,226-test backend suite pass. No remaining confirmed Critical/Important review findings; this does not close the authenticated/customer outcome gates.
