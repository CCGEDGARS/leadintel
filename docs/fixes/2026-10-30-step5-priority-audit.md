# Step 5 Buyers: priority integrity audit — 30 October 2026

## Decision

Step 5 is the release priority. No new product scope or onward workflow acceptance is justified by this audit. Code verification, production freshness and authenticated customer outcomes are separate gates. The latter remains OPEN until the signed-in company's real research, selected buyer, provider receipts and CRM reopening have been observed.

## Scope and method

Trace Profile/Strategy context → selected company → buyer identity → public evidence → AI review → paid provider permission/reservation → response ownership → CRM → workspace sync/reload → explicit recipient handoff. Reproduce faults using deferred requests and controlled provider responses, then add regression coverage. Inspect adjacent paths for the same pattern. Do not run paid lookups, overwrite historical contacts, change budgets or approve sending during the audit.

## Findings and corrections

| Finding | Root cause and impact | Correction and regression evidence |
|---|---|---|
| Recheck/Proceed can act on another ranked buyer | Stable card IDs existed, but handlers and nested save calls still used mutable list positions. | Carry the ID through handlers, Keep, Proceed and Add to flow. Reorder before click and during CRM save; removed IDs cannot fall back to their old index. |
| Stale recipient selection crosses workspace/user changes | CRM verification and failed-sync rollback lacked ownership checks after awaits. | Capture discovery, bridge, workspace, user and buyer identity. Reject late verification/rollback without writing old metadata into a new workspace. |
| Reopening a saved message can use the wrong contact | Reopen trusted contact ID and confirmation status without matching the selected person and saved email. | Match contact identity/name and exact selected address, current selection and workspace/user. Reject late CRM/draft recovery; preserve manual draft text. |
| A queued research job can move to another workspace | Shared promises were keyed by company but recursive queued work used whichever context was active later. | Pin owner, discovery, account and commercial context. Check them after waiting; canceled jobs cannot launch queued scopes. |
| Force refresh/manual intent disappears in deduplication | A new forced/manual request reused an incompatible existing promise. | Queue incompatible scopes/force, share manual paid-suppression intent, and pass force into the company dossier. |
| Late research overwrites newer evidence under the same ID | The research snapshot replaced entire person records without comparing their live evidence. | Compare canonical normalized identity/contact inputs, isolate research copies, update the baseline only after own commits. Preserve newer email/source and changed-role evidence while tolerating harmless normalization. |
| Cancel loses completed company-source receipts | Official inventory was only published at phase end. | Publish guarded partial checkpoints after completed reads/queries, before progress. Cancellation returns the published checkpoint; late responses do not mutate it. Save/reload resumes unread sources. |
| Pending state can remain stuck or clear a newer job | Cleanup depended on a buyer still being current; old completion had no operation ownership. | Always release the captured operation token, while preventing it from clearing a replacement operation. |
| Old policy failures erase newer settings | Error handling did not compare request generations. | Apply load failures only to their current serial; preserve newer successful settings. |
| Automatic work crosses a user change during policy loading | Auto checked context/manual ownership before await but reused newer global policy afterward. | Retain workspace/user/company context and recheck after loading and before each paid target. |
| Saved professional data belongs to an older LinkedIn identity | Display and phone-completion paths trusted raw contactData rather than the shared identity validator. | Use safeContactData for display, phone reuse and result acceptance; reject mismatched name, person, domain and profile. |
| Interrupted spending disappears from limits | Retryable Treg attempts were excluded from budget counts even after a provider phase had started. | Retain submitted/uncertain reservations. Proven unspent retries must atomically reacquire limits; later holds cannot release earlier spending. |
| Cancellation does not reach provider phases/saves | Manual request signal was dropped; some legacy provider paths saved late results after cancellation. | Propagate cancellation to Treg/Hunter phase guards. Apollo retains charged/uncertain receipts and budget but suppresses canceled data writes. Legacy cancellation accounting stays compatible. |
| Stale AI review authorizes automatic lookup | Automatic review checked status/date/IDs but not the evidence signature. | Require the current shared signature. Preserve fit description, buyer roles, role-change flag and evidence through CRM/workflow snapshots. |
| Provider profile attribution can bypass ownership | Returned arbitrary LinkedIn links or conflicting normalized profiles could be accepted as identity support. | Validate expected profile ownership and reject contradictory normalized profile evidence. |
| Approval for one provider authorizes another | Automatic Apollo used enabled=true without matching the approved provider. | Match automatic provider approval; retain separately approved manual Apollo behavior. |

## Prevention controls

- Regression suites exercise normal, rejected, canceled, partial, retry, reordered, duplicate, stale response, changed account, changed identity, saved/reopened and resumed-source states.
- Paid completion never authorizes sending or selects a different recipient automatically.
- Backend budgets and reservations remain authoritative. Cancellation cannot make submitted usage disappear.
- Public findings, guessed email patterns, AI review coverage, provider verification and usable recipients retain separate statuses.
- Updated entry/dependency versions and mandatory release checks cover the changed modules; backend health exposes buyer_integrity_version=20261030-audit-v1.
- Do not replace a failed acceptance check with a success label or weaken identity/evidence checks to make an old fixture pass. Realistic fixtures retain the active buyer, signed-in identity, stable bridge and exact saved email.

## Acceptance matrix

| Gate | Required evidence | Audit status |
|---|---|---|
| Deterministic code behavior | Full customer and backend suites, targeted race/ownership/cancellation tests, build and syntax checks | Recorded in the final PR validation. |
| Exact production release | Exact merged SHA, successful required CI, matching custom-domain manifest, backend health and all mandatory smoke checks; saved PROVEN proof | Recorded in the final PR and release-proof artifact. |
| Real company/buyer outcomes | Correct researched identities and current roles, actual independent tool receipts, current review coverage, required confirmed priority emails | NOT ESTABLISHED by simulated tests or screenshots. |
| Authenticated end-to-end acceptance | Click the intended buyer; inspect exact provider request/result identity; save, sync, reload, reopen CRM/message; inspect real quota/charge receipts | OPEN: no interactive browser connector and local Cloudflare CLI is not authenticated. |

The read-only Cloudflare connection check returned unauthenticated. No temporary account, alternative authentication, real paid lookup or sending action was used. Passing release checks does not close the customer acceptance gates. Existing legitimate conflicting edits and exhausted budgets remain explicit requirements, not defects to bypass.
