# LeadIntel repair execution — 13 October 2026

Baseline: `cd799ba72bfad120d3428640383fbd1e0141a483`, following the observation-only rescue PR #555. Repairs implement the owner's existing autonomous authorization. Test fixtures do not consume paid providers or send mail.

## Reproduced failures repaired

| Area | Root cause | Result and regression evidence |
|---|---|---|
| Website activation | A late response could commit to a changed website/account and clear derived work | Account, workspace and visible URL checked before any destructive local replacement; stale responses retain current work |
| Same-company evidence refresh | Refresh reused the new-company reset path and downstream destructive event listeners | Profile, strategy, references, companies, buyers and messages remain intact; evidence refresh uses non-destructive hydration events and a stale-research marker |
| Profile research and AI synthesis | Commit spread the pre-request state and checked only website/answers | Latest-state merge preserves unrelated edits; changed markets, documents, evidence, approvals and account reject stale results and error writes |
| Saved subjects | Render-time repair could modify saved tailored/rewritten subjects | Saved, translated and rewritten working copies are preserved; explicit restoration is separate |
| Reset | Original text could be labelled as a failed new style and retain Save readiness | Historical style, essentials and trigger provenance restored; explicit Save required even for identical text |
| LinkedIn Reset | Restoration changed the email style/default rather than the active LinkedIn style | Channel-specific style/default restoration preserves the other channel |
| Draft provenance | A rewritten Professional copy looked like an approved original | Visible working-copy provenance distinguishes edits from personalized templates and AI generated copies |
| Writing Assistant Apply | New adapter did not enforce existing sender/link/meeting protections | Malformed subjects/bodies, omitted or invented links, missing sender and changed 20-minute commitment rejected before mutation; real adapter regression |
| Firecrawl forwarding | No request deadline/signal, cancellation could start another fallback | Bounded forwarding, client cancellation propagated and cancelled requests cannot start fallback |
| Direct extraction | Size checked after buffering the entire response | Streamed byte limit stops oversized chunked pages |
| Storage status | Stripe catalogue outage turned valid usage into a 503 | Private usage/entitlements remain readable, billing actions disabled with a yellow connection notice; no fabricated payment failure |
| Provider credit status query | Workspace-only audit index required sorting history for each provider | Non-destructive equality-key index verified with SQLite EXPLAIN and workspace-isolated results |
| Lookalike display | Active reference model and generic profile text came from different state | Active reference names displayed; blank generated anchors repaired; legacy duplicate hidden without deleting saved choices or manual edits |
| Discovery state | Zero-result display omitted retained selections; old counts and inactive run messaging implied continued work | Saved Buyers selections explicitly retained; latest-run counts used; finished runs do not promise background continuation |
| Journey status | Optional Market Research counted as a required Profile task | Reviewed/approved profile can be complete without optional research |
| Deployment dependencies | Pinned Wrangler brought four high-severity transitive development dependency advisories | Wrangler pinned to 4.149.0; audit and actual Worker-runtime suite required before release |

## Related contracts verified locally

Immutable approved-reference scripts are unchanged. Five-subject categories, deliberate style creation, blank preparation view, manual edits, explicit Save/approval, existing account/workspace isolation, customer-only credentials, optional paid verification, bounded discovery and delivery suppression remain covered by regression suites. This is evidence of tested behavior, not proof that arbitrary supplied facts are true.

Changed entrypoints and nested imports include `rescue=20261013-v1` to avoid stale cached dependencies. Release-integrity adds ten mandatory production asset checks for the repairs. Schema migration 0033 adds only an index; it does not rewrite, delete or migrate customer records.

## Unresolved evidence gates

- The reported customer login failure and missing ERCON history need authenticated reproduction/acceptance. Do not claim private data restored based on local fixtures.
- The live shortened Professional draft may have been a saved rewrite or older draft. These repairs preserve it and expose provenance; exact source restoration is tested but the customer's original screenshot is not a reproduced generator failure.
- The reported 734 million daily D1 reads remain unattributed. The indexed status path is a reproduced inefficiency, not proof of the whole traffic cause or savings.
- Storage Plus merchant activation and live Stripe payments are not tested by signed local webhook fixtures. No paid checkout is performed or billing enabled by these repairs.
- Full paid-provider search and real mailbox delivery need customer-owned credentials and separately authorized sending. Tests use isolated fixtures and no real sends.
- Browser automation returned protocol/focus timeouts during this session. Public exact-SHA release proof and authenticated user workflow acceptance must be reported separately.

## Verification procedure

Run the complete customer suite, backend suite, `npm run check:step6`, the static build, syntax checks and whitespace checks. Merge only after same-head CI succeeds. Production requires the exact merged SHA, matching live release manifest, backend deployment/health, all mandatory smoke checks and a PROVEN release-proof.json. Preserve a failing gate as failing rather than changing expected results to force success.

Additional root-cause details: `2026-10-13-profile-race-safety.md`, `2026-10-13-message-preservation-repair.md`, `2026-10-13-backend-error-repairs.md`.
