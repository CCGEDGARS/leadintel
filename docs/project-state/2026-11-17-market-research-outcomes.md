# Market research interruption and downstream outcomes

Owner request: investigate the reported Market Research failure and verify Quick Overview, Market Research and Deep Analysis, including the use of results in the next steps.

## Observation and reproduced causes

The supplied screenshot says no public evidence was saved and attributes an incomplete check to Gemini: "Research stopped before verification completed". The owner identified the button as Market Research. No workspace, run ID or timestamp was supplied, so the exact historical provider failure is unconfirmed. That caption was a generic finalizer message: Gemini could be labelled running before its verification request started. It does not prove Gemini caused the interruption.

Controlled reproductions identified these defects:

1. Existing source checkpoints survived a provider deadline, but the interrupted path skipped opportunity, market-condition and quality derivation. Saved evidence therefore did not acquire the normal downstream interpretation.
2. The backend correctly returned partial verification with individual verdicts, but the client discarded every verdict unless the overall response was complete. Valid rejection decisions were lost too.
3. A completed review of the bounded 60-source verification request could imply completion for a larger evidence collection. Sources beyond that request had not been reviewed.
4. Once partial verdicts were retained, rejected evidence still contributed to market conditions and quality. Opportunity construction already excluded it.

## Changed behavior

- Normal and interrupted runs share local evidence derivation. After interruption, no further provider calls are made; the existing workspace/context guards still protect ownership. Acquired evidence produces qualified opportunities, conditions and quality before report persistence.
- Partial verification retains valid per-source verdicts and records reviewed/unreviewed coverage. Rejected or contradicted sources remain in the audit evidence but do not support opportunities, conditions or quality.
- A source collection larger than the verification request is explicitly partial. Provider receipts and saved state retain the actual failure reason and overall stop reason. Verification that never started is distinguished from verification that was interrupted.
- Saved and printable reports include partial verification gaps. Existing request limits, mode depth, evidence requirements and confirmation controls remain in place.

## Acceptance evidence

Real Chromium, authenticated application HTTP routes, migrations and SQLite storage were exercised with controlled external provider responses. No live provider credits or outbound outreach were used. These are product integration tests, not evidence about a private customer's historical run.

| Button | Controlled outcome | Persistence and downstream check |
| --- | --- | --- |
| Quick Overview | 20 sources; no Gemini verification request | Report, fresh browser reopen, Profile/Strategy handoff, actual Companies query input |
| Market Research | 60 sources; 59 reviewed, one unchecked; valid rejection retained | Report gap, rejected evidence excluded from opportunities, fresh browser reopen, actual Companies query input |
| Deep Analysis | 120 sources; 60 reviewed, 60 unchecked | Honest partial coverage in report, fresh browser reopen, actual Companies query input |

The Companies test captures the input to the real discovery query builder after UI activation, then cancels through the normal control while a company-extraction response is held. It proves the research handoff and retention; it does not assert that the synthetic fixture fulfills a real company acquisition target.

A separate Market Research interruption test holds a provider until the overall deadline. Fifteen completed sources, their derived opportunity/report evidence and the stop reason survive HTTP save and a fresh browser. No Gemini verification request is claimed or dispatched in that case. Unit lifecycle tests cover the same derivation for all three modes, cancellation, state replacement, conflicts and late responses.

Validation:

- `node --test customer/test/market-*.test.js customer/test/research-*.test.js customer/test/strategy-research-lifecycle.test.js customer/test/strategy-profile-reload.test.js customer/test/release-*.test.js customer/test/ci-release.test.js`: 318 passed; the SQL/browser interruption test skipped in this command and passed separately with the WASM loader.
- Backend verifier, Profile research routes and market-monitoring tests: 94 passed.
- `backend/test/market-research-modes-journey.test.mjs` with the WASM loader: all three passed, zero skips; desktop 1440x1000 and mobile 390x844; no page errors or horizontal overflow.
- `customer/test/market-research-checkpoint-persistence.test.js` with the WASM loader: passed, zero skips.
- `npm run build` and `git diff --check`: passed.

CI now runs the three-mode browser journey as a dedicated mandatory job and preserves its evidence artifacts. Existing Profile/Strategy CI continues to run interruption persistence and earlier Quick Overview acceptance cases. Deployment and authenticated customer acceptance are separate gates; this document does not establish either.
