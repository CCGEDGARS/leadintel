# Website monitoring: Profile ownership, scheduling and source coverage

## Outcome and authority

The user asked to audit the Monitor websites screen and fix defects. The authoritative configuration, revision, lease, run history, evidence and alerts remain in the existing workspace-scoped monitoring SQL tables. The Profile form is a draft, not evidence that a schedule was saved or research ran. Strategy approval remains mandatory for research, and only an explicit enable/save schedules recurring work. Saving an off configuration is allowed before approval.

## Reproduced defects

- The client disabled saving an off draft before Strategy approval, although the server supports it.
- A second UI renderer used the legacy `strategyApproved` boolean and could override the current-signature gate.
- Monitoring is mounted inside Step 2 Profile's Website Scanning module, but settings/history were loaded only by Strategy rendering. Opening Profile monitoring did not read authoritative settings. The old directions incorrectly pointed to Strategy.
- Returning to an already-open monitor panel after Strategy approval retained disabled controls. The wrapper now announces when monitoring becomes visible; the owner refreshes the gate and loads settings without creating duplicate monitoring controls.
- The saved summary looked like the draft, so Weekly/Deep above Daily/Quick appeared contradictory. It now explicitly says Saved; unsaved edits prevent a manual run and show an explanation.
- Quick's four default category queries exhausted the query slots before the user-entered website. Mandatory queries could also exhaust the budget before explicit sites or selected categories. Run planning now shares bounded capacity among those groups and persists rotation cursors in the existing run snapshot. Custom queries retain URL paths and market/offer context. No query limit or provider deadline increased.
- Strategy can replace signal IDs. The panel exposes active choices and explains retired selections; enabling with retired IDs is rejected before committing a schedule. Existing evidence and off drafts are retained.

## Review and execution

The Review Strategy action navigates to the visible Strategy view before opening its normal review dialog. It does not auto-approve Strategy or enable monitoring. Reopening Profile monitoring refreshes its current gate. User-entered websites remain separate from selected source categories and mandatory sources. The UI explains Firecrawl credit use, hourly due checks, rotation and in-app alerts without promising exact-page change tracking or email delivery.

No migration, customer-specific default, paid contact reveal, outreach, credential change or deletion was introduced. Old snapshots without cursors start at zero; previous failed runs do not advance rotation. Rollback ignores the additional snapshot fields and preserves all configuration and evidence.

## Acceptance and prevention

Unit regressions were observed failing before the corresponding fixes: off draft saving, stale approval gating, unsaved captions, Profile-only loading, wrapper visibility events and retired signal IDs. A controlled query reproduction returned four categories and no entered website before the fix. Engine and real HTTP/SQL tests cover entered paths, bounded rotation, source groups, geographic/offer portability, off drafts and retired-signal rejection. Existing lease, cancellation, timeout, stale-context, membership/session revocation, evidence and alert deduplication protections remain covered.

`backend/test/monitoring-journey.test.mjs` is mandatory in Customer CI. It uses real authenticated application HTTP routes, all SQL migrations, native encrypted service credentials and a controlled upstream Firecrawl response. It saves an off draft from the actual Profile wrapper, reopens a fresh browser, uses the real Strategy review/approval flow, selects current signals, enables monitoring, runs a manual check, marks an alert read, closes the browser and executes the registered hourly `app.scheduled` wrapper. It then checks history, deduplication, schedule cadence, a fresh browser, mobile layout and pausing. Controlled evidence is not a real Jobindex result or customer alert. Browser screenshots and structured results are retained under `/tmp/leadintel-monitoring/` and CI artifacts.

Release status requires the separate exact-SHA release-integrity proof, including the new health version and cache/smoke markers. Authenticated customer acceptance is separate: the previously saved shared browser was signed out during this audit; the user was offered a shared sign-in link. This does not establish that the customer's real schedule has been activated or has produced alerts.

Local validation: the full customer suite finished with 5,892 passed, zero failed and two existing skips (5,894 total). A subsequently added stale-monitoring-cache proof regression passed with all 18 proof-fixture tests. All 65 focused backend monitoring tests passed. The final authenticated monitoring browser journey passed in 20.4 seconds with four queries per run, browser-independent hourly execution, no duplicate alerts, retained read state, daily cadence, working pause, fresh reopening and zero page errors. Static build and syntax checks passed. Desktop and narrow-screen monitoring screenshots were inspected.
