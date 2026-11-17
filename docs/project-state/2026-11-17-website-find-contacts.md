# Website scan: Find contacts prerequisite handoff

## Report and root cause

The owner reported that **Find contacts · public research** did not work for a selected Liljas Svets & Mekaniska AB scan. The screenshot shows an unchecked website and the status “Check every selected company website before saving.” The click handler went straight to the shared CRM save guard, which correctly rejected unchecked identities; it never invoked website verification or opened contact research.

A controlled DOM integration reproduction with the real scanning runner, CRM handoff and contact panel confirmed that no verification, CRM save or contact API request occurred. Four new tests failed before the fix.

## Change

Find contacts now checks selected rows whose identity is unchecked, unresolved or no longer matches their website. It persists verification progress, then uses the existing CRM save/provenance handoff and opens the independent website contact panel. Already verified rows retain their checks on reopening. All selected rows must pass the existing identity guard before CRM import; unresolved rows stay saved with actionable feedback. The status scrolls into view when the contacts panel cannot open. Existing contact results close before a new request, so they cannot conceal prerequisite errors.

Cancellation and workspace ownership checks remain in the runner and handoff. The standalone Save and Prepare campaign actions still require explicit prior verification. Paid research, message approval and sending are unchanged. The shell and HTML module URLs are versioned for this change.

## Evidence and limits

- Focused scanning, handoff, campaign and contact UI regression tests passed (41 tests).
- New coverage exercises unchecked company → verified website → CRM provenance → exact contact job company ID; saved scan reopen without repeated verification; unresolved website; cancellation with late provider success; workspace change with late provider success; CRM save failure preserving verified data; mixed selection recovery after deselecting an unresolved company.
- External services are controlled fixtures. This does not establish live Firecrawl output for Liljas, the customer's authenticated session, or deployed release acceptance.
- Full customer suite: 6,317 passed, 7 skipped, 0 failed (6,324 tests).
- Static build passed its discovery deployment guard.
- A direct read of the supplied public website was blocked by the environment proxy (HTTP 403 tunnel refusal); no live source verification is claimed. No deployment or authenticated customer acceptance was performed.

## Prevention

Test visible action buttons from the preceding step's natural output state, including unmet prerequisites. A downstream guard passing its isolated tests does not prove that its upstream button gets users through those prerequisites. Preserve the guard and orchestrate the prerequisite, with visible recoverable failure feedback.
