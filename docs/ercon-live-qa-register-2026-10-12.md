# ERCON live QA issue register — 2026-10-12

This register distinguishes user reports, screenshot observations, and verified test results. **Not a claim that every issue is reproduced or fixed.** Production modifications are prohibited until reviewed.

| ID | Priority | Area | Finding | Evidence classification | Acceptance requirement |
|---|---|---|---|---|---|
| QA-01 | P0 | Auth | Intermittent login/account-access errors | User report | Valid OAuth login and account switch, zero cross-user access |
| QA-02 | P0 | Persistence | Saved companies, buyers, research appeared missing | User report; backup proves some data survived | Same-account refresh/relogin restores all retained workspace and CRM data |
| QA-03 | P0 | Website intake | Website analysis sometimes fails to fill answers | User screenshot/report | Field hydration is deterministic, safely reports missing facts |
| QA-04 | P0 | Step 6 | Approved scripts altered by message generation | Repeated user reports | Verbatim protected template boundaries and validated dynamic facts |
| QA-05 | P0 | Step 6 | Five approved subject lines missing/wrong | Repeated user reports | Correct number, provenance and variants by tone, length validation |
| QA-06 | P1 | Step 6 | Style update, reset, edit and save can misbehave | User reports | Distinct actions; no automatic mutation; persistence/regression tests |
| QA-07 | P1 | Discovery | Regenerate company list stalled after several minutes | User report | Bounded runtime, progress and abort/recovery, no data loss |
| QA-08 | P1 | Account billing | Only customer-owned API credentials and billing, no platform fallback | User requirement; commit #552 deployed | Isolation tests for all providers and exhausted quotas |
| QA-09 | P2 | Profile | 'Run Company Research' offered despite existing saved evidence | Live screenshot observed | Explain fresh-vs-existing research and avoid unnecessary paid calls |
| QA-10 | P2 | Profile | 100% profile completeness versus 2/5 authoritative evidence areas verified | Live screenshot observed | Distinct labeled completeness and evidence confidence |
| QA-11 | P2 | Targeting | Lowest-price tender exclusion contradicts tender signal | Live screenshot; app flags conflict | Clarify filter, do not silently discard qualified tenders |
| QA-12 | P1 | Data queries | 734M D1 rows read in 24h | Cloudflare dashboard screenshot | Profile top query workloads, polling and indexes; verify before optimization |
| QA-13 | P1 | Customer experience | Previously saved ERCON data available but stage shows Step 1 | Backup and live screenshots | Correct per-session navigation and recovery semantics |
| QA-14 | P1 | Payments/storage | Storage upgrades and customer isolation require validation | User reports | Test per-workspace quotas, Stripe entitlements and alerts |
| QA-15 | P1 | Website/API connectivity | Provider status errors/alerts need differentiation | User screenshots; Node warning seen in Vercel logs | Real HTTP result and payment vs connection error classification |

## Live ERCON visual checks
- Website ERCON active, ~1.5k characters; Sweden selected.
- Step 2: four targeting inputs present, marked saved; separate examples include services, ICP, buyers and exclusion.
- Profile review: 8/8 known, 100% completeness; 12 first-party evidence items, 11 external validations, 2/5 authoritative coverage; approved.
- No full refresh/logout/relogin or end-to-end sending test has yet been completed.
- User uploaded a SQL export and restored SQLite database; local integrity check `ok` and 71 tables, original backup kept. DO NOT commit private database or credentials.
- No confirmed root cause yet for loss symptoms, and no fix claimed.

## Next QA stage
Walk through Strategy -> Companies -> Buyers -> Messages -> Delivery, capturing evidence and exact expected/actual behavior. Prioritize P0 fixes and tests, then review PR before any deployment.
