# Event preparation and connected invitation workflow

Owner outcome: make event preparation easy to find and use, preserve the event across Companies → Buyers → Messages → Delivery, and reuse the existing styles and template library.

Use the existing event campaign, recipient selector, CRM, research commands, message editor/library and delivery APIs. Avoid a parallel event CRM or mail sender. Highlight Analyze event website and the next action, show four compact journey stages, and keep optional source/meeting details collapsed until needed. Show website loading/results beside the initiating button and retain editable manual fallback.

Use five familiar style names for separate event invitation variants: Professional, NLP, Friendly, Brutal Honesty and Storyselling. These are event-specific working patterns, never replacements for approved core masters. Preserve legacy Direct drafts. Keep conditional attendance wording, exact event details, evidence receipts, source/recipient/workspace guards and explicit delivery authorization. No research or sending on render.

Library: reuse the existing named personal-template save flow. Save an event draft independently; explicitly Use & save as template to open the normal template naming dialog. Event-specific details remain in that personal copy and must be reviewed before reuse. Do not populate the library automatically or introduce another template store.

Found cross-flow risk: reopening a saved event-linked campaign can use another globally active event during Buyers research. Bind an explicit research handoff to the campaign's saved event and await workspace persistence before discovery/role selection. Reuse a saved campaign for the same event instead of clearing its recipient selection on every continuation.

Acceptance: focused UI/domain tests, actual authenticated HTTP/SQL event campaign browser journey including exact recipients, style persistence, save/reopen, shared Buyers handoff, template Cancel/name/save, approval and unsent Delivery; desktop and narrow viewports; core masters unchanged; required CI and exact-SHA production proof. Controlled mailbox/provider tests only; no real outreach or paid reveals. Private customer acceptance is a separate evidence level.

Prevention: unchanged event saves retain their revision. Company research uses a shared event research projection (event identity, edition, geography, audience, roles and source URLs), with compatible comparison for older saved full-event fingerprints, including CRM restore. Invitation style, stand, booking and meeting wording do not invalidate company research. Draft approval still binds the complete current event/style.

Controlled browser acceptance exercises an explicitly authorized send through the fixture mailbox, verifies the exact recipient and body, and confirms reload causes no duplicate submission. No real mailbox provider is called. The existing delivery checkbox and native send button remain the authorization path.

The actual native Buyers → Messages acceptance exposed a stale event button: message preparation completed through renderMessageWorkspace while event controls were refreshed only through renderMessageStudio. Refresh the event view from the normal workspace renderer so asynchronous busy/recipient transitions cannot leave Create invitation disabled. Event usability requires the confirmed native recipient; business-draft template preparation is not permission to change an event preview.
