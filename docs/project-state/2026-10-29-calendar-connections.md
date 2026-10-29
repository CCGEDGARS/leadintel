# Per-user calendar connection links

Meeting options offers direct Connect Google Calendar and Connect Microsoft Calendar links, with a provider selector for read-only availability. Every member connects their own account through OAuth in the active workspace. Manual edits and previews must be finished before navigating. Provider/workspace/recipient changes invalidate pending reads and suggestions. Booking links, calendar access and email sending retain separate permissions.

Google reuses its existing calendar-only connection. Help links explain that enabling Calendar API is a one-time task in the app administrator's existing Google Cloud project; ordinary users approve access. The app must have the calendar scopes configured and an appropriate consent publishing/test-user setup. The console link is labelled for the app administrator. Google and Microsoft account-management portals are also linked.

Microsoft now uses the existing Microsoft mail redirect URI with an isolated mscalendar state, PKCE, single-use expiring state, first-party callback/session checks and encrypted per-workspace/per-user refresh tokens. Migration 0064 adds separate state and connection tables. It uses the existing Microsoft app credentials and registered mail callback; it does not borrow a user's mail grant or request sending/write permissions. Microsoft 365 tenant policy may require administrator consent. The app registration must allow the intended account types and delegated Calendars.ReadBasic/User.Read permissions.

Microsoft Graph v1.0 /me/calendars and calendarView support Calendars.ReadBasic for both work/school and personal accounts. The adapter requests only calendar names/default selection and event start, end, showAs and cancellation state; it never requests subjects, bodies or attendees. Recurrences are expanded by calendarView. UTC responses feed the same 20-minute slot calculation as Google. Pagination is constrained to the expected endpoint, calendar/page/row and time limits apply, and missing or ambiguous data cannot become free time. Refresh-token rotation is persisted with a conditional update. Authentication, denied consent, wrong users/workspaces, expiry, unsafe pagination, busy intervals, UI provider races and unfinished edits have regression coverage.

Calendar connection does not send outreach or book a meeting. Calendly's existing booking-webhook workflow remains separate. Automated tests and release smoke checks prove implementation and routing; a real account connection requires its user's interactive consent and a successful live availability read.

Official references:
- https://learn.microsoft.com/en-us/graph/api/user-list-calendars?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0
