# Monitoring inbox filter ownership

Observed release gate: main revision `29a` failed the fresh-browser reopen step in `verify-universal-monitoring.mjs` while waiting for `.mi-message`; the equivalent PR run passed. The exact finding clicked in the failing CI run was not captured, so that run's precise click identity remains unproven.

A controlled JSDOM reproduction using the actual inbox module established a product race: selecting Court started an asynchronous filtered read but left the default list clickable. Clicking the old Hiring row opened its detail, incremented the shared request ticket, and discarded the pending Court response. The wrong detail had no prepared message and remained open indefinitely. No provider requests or sending were involved.

The filter now takes ownership synchronously: old rows are removed, pagination is disabled, the list is marked busy, and finding actions are blocked until the current filtered read finishes. Only the newest request can render. Failed reads leave no stale findings under the new filter; Refresh can retry. Workspace and close guards remain in place.

The browser acceptance selects a finding by its exact saved reference (`C-2026-5` for Court; `JOB-5` for Hiring) rather than clicking the first row immediately after changing Purpose. It retains the existing deadline and verifies the same prepared message and explicit approval/synthetic-delivery journey. This change introduces no provider, message preparation, approval or sending action.

Regression coverage: delayed filter read plus old native row click; exact filtered saved-message reopen with GET-only requests; out-of-order purpose responses; failed read followed by refresh. Passing implementation tests do not establish the new deployed release or authenticated customer success. The exact release CI and production proof remain separate gates.
