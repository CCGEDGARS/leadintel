# Select and proceed: Messages mount crash — 9 October 2026

## Root cause
`LeadIntelMessageWorkspace.mount` moved `message-save-draft` into a detached toolbar, then immediately looked it up with `document.getElementById`. The lookup returned null and `.hidden = true` threw before Outreach initialization published its handoff API. Buyer selection had already been saved with journey stage 6; subsequent Buyers rendering hid the company list even though the main view had never left Buyers.

## Repair
Capture the existing button before reparenting and set its hidden state through that reference. Preserve its event handler. Verify that lazy-loaded Outreach publishes the handoff API before resolving. If module initialization fails, keep the saved exact recipient but restore the Buyers stage and visible list. Version the customer entry, loader and workspace import to avoid stale cached assets.

## Verification
The original composer tests reproduced the null dereference before the repair. Two composer mount tests and 25 buyer/direct-navigation tests pass after repair. Syntax checks pass. The broader customer suite is not green: 123 failures were observed in the initial broad run after the mount repair, including existing outdated harnesses and unrelated subject/research tests. Do not label this revision PROVEN PRODUCTION until exact-SHA CI and release proof are green. The remote browser has no authenticated customer session, so Edgars workspace acceptance is not established by these tests.

No outreach was sent. Saved CRM contacts, research, protected scripts and drafts are unchanged by this repair.
