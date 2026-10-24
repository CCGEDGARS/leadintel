# CRM daily priorities — 24 October 2026

## Implemented behavior

The existing Master CRM opens on **Today**. All Companies, Active Pipeline, Customers, Archived and Suppressed remain available. Today derives a read-only review queue from the current workspace's durable CRM and existing tracked Gmail conversation endpoint:

- Pending conversation reminders are compared against their actual stored instant. Past-due and remaining-today items are separate labels; today uses the conversation timezone. Future reminders appear under Upcoming. Completed reminders are excluded.
- Pending undated reply/manual-action tasks appear under Replies & next actions to review. They preserve the saved conservative next action and do not claim AI analysis occurred.
- Held/paused/error plans, failed syncs, bounces and rejection/opt-out states show their stored reason. Active approved schedules are displayed as schedules subject to the existing delivery safeguards; the dashboard does not send or retry them.
- A saved active opportunity with successfully loaded contacts but no saved email receives a No email saved blocker. Unknown contact data does not become a no-email finding, and email presence never establishes verification or sending eligibility.
- Each finding opens the existing company detail or uses `leadintel:open-conversations` with the stored domain and recipient. This reuses the existing conversation view, tasks and follow-up engine.

No new persistence, AI/provider call, message send, task completion, automation activation, schema or CRM mutation is introduced by Today. CRM detail retains its pre-existing explicit user actions.

## Scope and incomplete coverage

Today requests the first 100 companies without the other tabs' search/filter state. It discloses a remaining cursor and directs the user to All Companies, where existing Load more companies pagination remains available. Contact checks are bounded to 20 active nonterminal prospect opportunities in that loaded page, in batches of four. The UI gives successful/eligible/failed check counts.

`GET /api/conversations?workspace_id=…` returns at most the latest 500 tracked LeadIntel Gmail threads. Today states that cap and excludes unrelated mailbox threads. It uses `bridge.listConversations()` when available; otherwise it follows the existing conversation UI's authenticated same-origin credentials GET contract. Company list/detail reads use existing bridge methods.

A failed company or conversation read remains an explicit unknown source while successful sources can still show findings. Loading, signed-out, true-empty and partial/error states are distinct. Refresh is explicit, and refreshed time is shown in UTC. The view never claims all workspace work is complete.

## Isolation and accessibility

The controller captures authenticated account + workspace identity and a request generation. Workspace resets clear rows synchronously. Late reads, overlapping refreshes, A → B → A transitions and account changes cannot apply previous data. Pending batches stop after a scope change. Stale row actions are checked against the current scoped snapshot before issuing a company read or opening a conversation.

UI strings are escaped. CRM tab buttons expose selected state and support Left/Right/Home/End. Loading/status messages are announced, buttons have visible focus styles, and cards collapse to a single column on narrow screens. Colors use the existing ink/muted/line/paper/soft/accent2 tokens. No browser or real mailbox interaction was performed for verification.

## Files and loading

- `customer/crm-priorities.js`: pure deterministic derivation and scoped read controller.
- `customer/crm-ui.js`: Today entry/view, read adapters and existing-record navigation.
- `customer/crm.css`: light responsive priority card styles.
- `customer/test/crm-priorities.test.js` and `customer/test/crm-priorities-ui.test.js`: engine/controller and jsdom runtime regressions.

The support loader must import `crm-priorities.js?v=20261024-crm-daily-priorities-v1` before `crm-ui.js?v=20261024-crm-daily-priorities-v1`. CRM CSS uses that same marker. The stable `#crm-insights-slot` immediately below the CRM toolbar permits the separate cost panel to mount without being replaced by Today renders.

## Evidence

`node --test customer/test/crm*.test.js`: 72 passed, 0 failed. The tests exercise due boundaries/timezones, completed/invalid-date reminders, source failures, no-email evidence gaps, approved schedule wording, synchronous read failures, scoped stale requests, account changes, true-empty/signed-out reads, safe HTML, keyboard navigation, existing company/conversation navigation, and no send.

`node --check customer/crm-ui.js` and `node --check customer/crm-priorities.js`: passed.

These checks establish local implementation behavior. They do not establish deployment, authenticated customer acceptance or real mailbox coverage.
