# Monitoring opportunity review — 19 November 2026

## Outcome and ownership

The workspace database owns finding status, source versions and monitor schedules. The header badge counts only findings whose saved assessment explicitly passes relevance and the configured threshold and whose status is `new`. All other unreviewed findings have a separate verification count. Opening, filtering, searching or refreshing never reviews findings.

Matching new findings sort ahead of verification work and reviewed/dismissed history, newest observed change first within each group. Cards retain source, matched criteria, publication date when supplied, and evidence-backed relevance score. Publication dates are separate from hearing/event dates. History is searchable across title, source and saved event text. Workspace-wide counts are explicitly labelled; pagination uses a 31-row lookahead for 30-row pages.

Visible, authenticated clients poll saved summaries at most once per minute. Changed summaries refresh the open list while preserving filters; detail views are not replaced. Requests retain workspace and interaction ownership. No polling performs provider research. Scheduled source checks retain the existing daily/weekly/monthly configuration, hourly due scheduler, bounded query budgets, leases and permission guards.

Monitor health in both the inbox and manager comes from durable run receipts, not inbox fetch time. It shows frequency, last fully successful check, next due time, and failure/partial/overdue/interrupted state. Failed checks retain history and never claim a successful zero-match result.

Source amendments reopen a finding, preserve older versions and describe changed facts. Identical rereads preserve explicit review/dismissal. The source-version details now expose retained text for comparison. Original buying-signal checks also record findings in the shared inbox, using source-read/criteria/threshold gates and existing syndication suppression. Their old alert records remain readable; newly linked alerts route review through the inbox and explicit review updates their historical read state.

## Preservation, compatibility and rollback

No schema migration or record deletion is needed. Existing unknown assessments remain verification work until a source check establishes a threshold pass. Existing statuses and immutable versions remain intact. Legacy signal alerts without a corresponding finding retain their earlier read control; subsequent checks create inbox records. No historical evidence is promoted without research. Existing API `unread` now aliases the matching-opportunity count; `opportunities` and `needsReview` are explicit fields. Returning to older code preserves data but restores the old all-findings badge semantics. No sending authority or template rules change.

## Acceptance evidence

- HTTP/SQL tests: scheduled due checks through `app.scheduled`, not-due no-spend, persistent counts after GET, review/dismiss/search, literal search escaping, source amendments, duplicate suppression, threshold separation, pagination and failed-check receipts.
- DOM tests: automatic arrivals, unchanged counts on open/reopen, explicit review, delayed summary/workspace protection, publication versus event dates, paused/partial/overdue health.
- Controlled real-browser acceptance extends `scripts/verify-universal-monitoring.mjs`: registered scheduler, three monitor purposes, review count, unchanged reread, amended event date, visible credit failure and recovery, desktop/mobile and saved downstream previews. All provider and transport calls in this acceptance harness are synthetic.
- Original signal monitor browser journey now reviews its finding through the same inbox and checks that the historical alert becomes read.

Exact release proof and authenticated customer outcomes remain separate gates. Controlled acceptance does not establish any particular customer's provider balance, extraction quality or successful live scheduled run.
