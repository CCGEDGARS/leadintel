# Owner sign-in throttle and repository secret hygiene — 19 October 2026

Observed:

1. `/api/login` (owner e-mail + password) compared credentials in constant time but accepted unlimited attempts.
2. A Firecrawl API key was committed in two May 2026 commits (`2e9d4035`, `90e1dfa9`). It is not in the current tree, but the repository is public, so the key remains readable in history and must be rotated by its owner.
3. CORS (`allowedOrigin` + Vercel preview pattern), Apollo/Calendly/Stripe webhook signature checks and the session requirement on `/api/*` were reviewed and needed no change.

Changes:

- `backend/src/login-throttle.js` + migration `0040_login_attempts.sql`: after 10 failed attempts for the same client (CF-Connecting-IP) and e-mail within 15 minutes, `/api/login` answers `429` with `Retry-After` for 15 minutes; a successful sign-in clears the record; stale rows are pruned on write. Every storage error fails open so the real owner can never be locked out by infrastructure.
- Reserve-then-verify: the attempt is counted in one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` statement before the credential compare, so concurrent attempts cannot bypass the limit (found by the automated security review of the first version, which read the counter and wrote it back in two statements).

Verification: `backend/test/login-throttle.test.mjs` (SQLite fixture through the real migration) and the full backend suite.

Action for the repository owner: rotate the Firecrawl key that appears in history; consider purging it from history as well, since rotation alone leaves a dead key visible.

Prevention: new credential-bearing endpoints get a throttle with a fail-open store; keys never enter the repository (Worker secrets only).

## Release Integrity double run (same day, follow-up)

Observed: every push that touches `backend/` starts two Release Integrity runs — one when Customer V2 CI completes, one when Backend Deploy completes. The run that starts first looks up the other required run, finds no *completed* run for the SHA (`status == "completed"` filter) and fails with `BLOCKED_CI · Required CI did not succeed`, sending a failure e-mail; the second run then proves the release. Seen for `bdba0c29`, `9f929752`, `1444c212`, `9f1432be` and `a6dfc98b` on 19 October.

Change: in "Resolve automatic CI and deployment evidence", when no completed sibling run exists but one for the same SHA is still queued or in progress, the step outputs `deferred=true`; the proof step is skipped with a `DEFERRED` log line instead of failing, and the sibling's completion triggers the proof as before. A missing sibling run (not merely pending) still fails as today, and the 15-minute scheduled proof is unchanged.
