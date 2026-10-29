# Per-user calendar connection links

Approved scope: let other users connect Google or Microsoft calendars through the provider consent screen. Extend the existing Meeting options flow; Google Cloud API enablement remains a one-time app administrator task. Keep Microsoft and Google connections separate from sign-in and email delivery, scoped by user and workspace.

1. Add failing backend tests for Microsoft OAuth (existing mail callback with isolated state, PKCE, exact session/user binding, encrypted tokens, scope checks), private calendar listing and bounded availability reads for Outlook.com and Microsoft 365. Test denied access, unsafe pagination, partial data and isolation.
2. Implement Microsoft Calendar with delegated Calendars.ReadBasic and User.Read identity, requesting only start/end/free-busy fields. Reuse the existing Microsoft callback and Google slot calculation; add a separate schema migration. Do not create calendar events or send messages.
3. Add failing UI tests for both connection actions, provider switching, reconnect/disconnect, blocked edits and stale results. Add clear user/account instructions and provider-specific help links, separating app administrator setup from user consent.
4. Wire provider selection through the Messages adapter, preserve existing Google identifiers and draft/Undo behavior, and invalidate changed module caches.
5. Run focused and full CI checks, build, then release through the existing exact-SHA production proof workflow. An OAuth redirect, configured application or mocked provider response is not a verified live user connection.

References: Microsoft Graph v1.0 list calendars and calendarView both support Calendars.ReadBasic for delegated work/school and personal accounts. calendarView expands recurring instances; Prefer outlook.timezone UTC and bounded pagination provide consistent availability without fetching subjects, bodies or attendees.
