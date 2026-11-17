# Monitoring status and inbox recovery

## User outcome and ownership

Website monitoring must save settings, run explicitly or on its saved schedule, show fresh durable results, and open a usable findings inbox. SQL monitoring configuration, leases, runs, evidence and findings remain authoritative. Browser form edits are drafts; opening, refreshing and polling never starts paid research or sends messages.

## Confirmed defects and corrections

- The browser API awaited bridge readiness, response headers and JSON without a deadline. A stalled request could keep controls disabled indefinitely. Reads and saves now settle within 45 seconds; a manual run allows 330 seconds for the server's existing 300-second budget. Timeout messages distinguish an unconfirmed response from a confirmed failed save. There is no automatic mutation retry.
- The panel cached its loaded workspace indefinitely, so reopening could hide newly completed scheduled runs. Opening now reads the server; Refresh status and a visible, idle, once-per-minute read update saved history. Draft inputs survive refresh. Refresh cannot invalidate an in-flight save, and late responses remain context/revision guarded.
- Inbox filters used truthy fallbacks, preventing selection of All and losing monitor/category filters when returning from detail. Nullish fallbacks preserve intentional empty values and stored filters. Filter changes immediately clear old rows; only the latest response owns the list.
- Inbox Close was blocked by its busy flag. Close now invalidates requests and action ownership immediately. Late completions cannot reopen the dialog. Initial read failures retain a Refresh control; refresh notices do not steal keyboard focus. Background badge reads announce changed unread counts without replacing an edited detail.
- Firecrawl account failures were collapsed into generic query failures, with remaining queries still attempted. Confirmed exhausted credits, rejected credentials, rate limiting and missing credentials now stop the run with safe, distinct reasons. A bare 429 does not imply exhausted credits. Existing evidence and fixed request budgets remain intact.

## Message-format ownership correction

The full inbox acceptance journey exposed an additional runtime defect: monitoring read `main.messageStudio`, but Messages persists `outreach.messageStudio`. Startup normalization removed the fixture's Profile-only library, leaving preview disabled. Monitoring now shares one owner selector for template listings, preparation, sender facts and delivery revalidation. An explicitly empty or deleted outreach library overrides legacy Profile copies; fallback is allowed only when the Messages owner is absent. No master or personal-format wording changes. The browser fixture now seeds through the durable state writer with the seller ownership metadata and awaits startup persistence, and HTTP regression verifies exact preview text and deletion behavior.

## Presentation

Settings group matching criteria, websites and schedule; message preferences are collapsed. History shows human-readable status, time, source/alert counts and recovery explanations. A successful zero-alert run says no new findings met the criteria. Failed checks never become green successes. Inbox filters, clear/reset action, unread/saved counts, review cards and mobile controls use consistent styling.

## Acceptance evidence

- Customer regressions cover filter clearing, preserved filters, close during slow refresh, out-of-order reads, workspace changes, deadlines during bridge/body stalls, save acknowledgement and dirty drafts.
- Actual authenticated HTTP/SQL and registered `app.scheduled` browser tests cover save before approval, normal approval/return, manual run, alert read state, browser-independent scheduling, deduplication, fresh browser reopening, refresh without reload while preserving an edited URL, inbox open/refresh/close, mobile layout and pause.
- Provider HTTP tests verify one attempted call on confirmed quota/auth/rate errors, persisted reasons, released leases and correct billing-health classification.
- Independent-monitor acceptance covers category creation, single-page preview, enable, saved reload, isolated pause, scheduler registration and inbox monitor filtering.

Controlled provider responses prove application handling, not the actual customer's website accessibility, Firecrawl balance or source coverage. The screenshot alone cannot establish every provider failure. A production release proof and authenticated customer acceptance remain separate evidence gates.
