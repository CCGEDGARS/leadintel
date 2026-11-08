# Meeting settings survive refreshes while editing

The authenticated Ercon audit entered a verified existing 20-minute Zoom Calendly link. The field reverted to its previous empty value before the user could save it. Meeting-setting input handlers invalidated the draft without persisting the entered settings. An intervening workspace, progress or sender render populated the form from the older stored values; the later change/save handler then persisted those older values.

Capture and persist the current meeting settings before invalidation on input, change and explicit core save. Keep approval invalidation and the current working copy. The mounted UI regression types a new booking link, renders before blur/save, and verifies the entered value through change, core save and fresh reopen. Both paths fail with the old code. The test also retains the exact working draft and requires approval to remain blocked.

Refresh the outreach module and its dynamic loader cache URLs. This does not authorize sending, fabricate a booking URL, rewrite protected masters, or supply missing cost/certification/project proof.

Remaining acceptance: required exact-head CI, exact production proof and re-entering the verified existing booking URL through the real app.
