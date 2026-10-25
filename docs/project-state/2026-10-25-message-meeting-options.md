# Messages: sender simplification and meeting availability

## User-approved behavior

- Sender summary shows name, company and email with one Edit sender control.
- Sender fields open in place; Edit closes them and Save identity closes them after saving.
- Business context is collapsed and shows the reviewed outcome and proof once. The full source preview remains preserved internally. Internal review diagnostics are no longer appended to that preview.
- Meeting options sits above the working editor, closed by default. The previous date-only controls are retained hidden for data compatibility. Booking link and invitation settings use their original persistence handlers.
- Users can insert their booking URL or check a chosen day against selected Google calendars. The calendar view exposes 20-minute free slots between 09:00 and 17:00 in the chosen timezone. This is availability, not an event agenda or a reservation.
- Slot selection is limited to three suggestions. Availability expires after two minutes and is rechecked immediately before insertion. No calendar events or invitations are created.
- Insertion changes only the working copy, retains Undo, invalidates prior approval, and requires explicit Save. Existing approved templates remain unchanged.
- Date labels follow the selected outreach language through Intl. URL insertion adds no English sentence to translated drafts. Translation remains on the existing translation path.

## Calendar architecture and setup

`backend/src/google-calendar.js` uses Google CalendarList and FreeBusy. Scopes: `calendar.calendarlist.readonly` and `calendar.events.freebusy`, plus OpenID/email identity. Calendar event contents are never requested.

Apply migration `0050_google_calendar.sql` through the existing backend deployment. Connections and encrypted refresh tokens are scoped to `(workspace_id,user_id)` and remain separate from Gmail.

The existing `GMAIL_OAUTH_REDIRECT_URI` is reused. Only the isolated `calendar.` OAuth-state namespace is handled by the calendar route. Callback state lives in a separate hashed, expiring, single-use table. The callback returns through the first-party app proxy and verifies the authenticated user matches the initiator before consuming state or storing a token. Normal Gmail callback handling remains unchanged.

Google Calendar API must be enabled in the existing Google OAuth project. Each user must explicitly consent through **Messages → Meeting options → Connect Google Calendar**. Existing Gmail consent does not imply Calendar consent. API refusal, missing scopes or inaccessible selected calendars fail closed and retain the message.

Disconnect deletes only this user's LeadIntel calendar connection. It does not revoke the shared Google application's grants or disconnect Gmail.

## Review and verification record

Focused tests cover busy overlaps, DST and half-hour zones, malformed/partial FreeBusy responses, account/workspace isolation, encrypted OAuth storage, single-use/expired state, same-session account linking, stale recipient/context responses, explicit insertion, locale handling, unfinished-edit protection, and computed sender-control visibility.

Independent review found and resolved legacy CSS hiding the moved sender Edit control, a blank collapsed settings card, missing calendar callback session binding, and English insertion wording. These fixes have regression coverage.

Local browser rendering could not use localhost because the connected browser is on a different host. DOM/computed-style integration checks are automated. Authenticated Google consent and a real FreeBusy query are separate acceptance evidence and must not be inferred from offline tests.

Release claims require exact-SHA CI and repository release-integrity proof. New smoke checks cover the meeting entry point, module/layout and the calendar authentication boundary.
