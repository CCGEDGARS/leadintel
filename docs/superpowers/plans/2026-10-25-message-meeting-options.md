# Message meeting options implementation plan

**Goal:** Implement the user-approved compact sender panel, consolidated business context and optional live calendar availability beside the message editor.

**Architecture:** Preserve canonical controls and draft persistence. Add a private per-user, per-workspace read-only Google Calendar connection, sharing the already registered Google Gmail callback URL through an isolated `calendar.` state namespace and separate state/token tables. Gmail connection and its permissions remain independent. Use CalendarList and FreeBusy only; do not fetch event contents or create events.

**Tech stack:** Existing vanilla JavaScript, Cloudflare Worker/D1, encrypted OAuth refresh tokens, node:test/jsdom.

## Constraints and review focus

- Core template masters remain unchanged. Insertion edits only the working message and requires Save again.
- No automatic insertion, approval, send or event creation.
- Expired/partial/error calendar responses never become available slots.
- Protect timezone/DST boundaries, other users/workspaces, changed recipient/draft context, and slow requests.
- Existing booking links and sender/business facts remain persisted through existing state paths.

## Tasks

1. Add failing backend tests for timezone slot generation, busy overlap, malformed/partial Google responses, membership isolation, OAuth state expiry/replay and encrypted connection storage. Implement `backend/src/google-calendar.js`, migration `0050_google_calendar.sql`, and route registration in `backend/src/app.js`.
2. Add failing customer tests for collapsed meeting controls, consolidated source context, explicit insertion, draft/context protection and stale availability. Implement `customer/message-meeting-options.js`, integrate through `message-workspace.js` / `outreach-ui.js`, and add responsive CSS.
3. Run relevant tests, full customer/backend suites, syntax/build checks; preserve canonical template regressions. Commit/push the exact tested source, inspect CI/deployment, and run repository release proof before any production claim.

## Accepted design

Sender details remain behind one compact Edit control. Business context is collapsed and contains structured reviewed value/proof. Meeting options is a separate collapsed panel next to the editor with booking-link insertion, calendar connection status, day/timezone selection, fixed 20-minute slots matching current invitations, selected calendars and explicit Insert selected times. Availability is a point-in-time check, not a reservation. Connections are personal to the signed-in user within the workspace.
