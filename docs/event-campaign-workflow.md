# Event and email campaign workflow

Both optional setup cards now appear at the end of Profile (Step 2), before the next-stage action. The event card contains event facts and audience choices; invitation/meeting detail is expandable and can be completed in Messages. Existing saved events and campaigns remain available.

## Start with the seller profile

Confirm the existing targeting and research answers. For a new event, the seller's ideal customer and buyer-role answers prefill empty event targeting fields. Save draft requires only an event name and safe URLs. Save & use / choosing recipients requires a named, dated event; stand/meeting point/value are checked when invitations are prepared. Activation alone starts neither research nor sending.

Choose event audience: existing participants, outside prospects, or both. Add participant source URLs for the exact edition. Company listings do not confirm an individual person's attendance. Source pages that cannot be read, lack exact-edition evidence, or are restricted leave attendance unknown.

## Choose companies in the shared selector

Use the event's Choose recipients & next step action to open the shared campaign recipient picker with the saved event ID. The email card supports one company, CSV lists (`company,website` plus optional `name,email,title`) and existing CRM companies/contacts.

Select Use my companies, Find companies for me, or My companies + find more. Desired system-discovery count is 1–50 companies; people per company is 1–4. Existing list selection still supports first N, all loaded/imported companies or a specific selection (campaign maximum 500). Company count and recipient count are displayed separately. Supplied targets stay selectable with research gaps; automatically discovered additions require the existing qualification gates. Mixed mode requests only the missing amount and reports shortfalls. No weak result is invented to complete a quota.

Research route saves the brief and opens the existing Companies research stage. Run research uses the configured customer tools. Quick research uses limited source checks and individual supplied-company batches; Market Research uses the standard pipeline; Deep Analysis allows up to three scoped evidence-acquisition passes, including existing verification/fit reasoning and followups. Participant-only runs omit generic event-irrelevant broadening and count only companies with positive exact-edition participation evidence. Provider failures, missing targeting confirmation, evidence gaps and budget-limited shortfalls are reported.

Review campaign buyers uses the existing decision-maker discovery. Use the displayed contact cap for initial selection; recipient selection remains reviewable. The direct writer route makes no research calls. Missing emails do not block writing, but existing contact and delivery eligibility requirements apply before sending.

## Messages and delivery

Step 6 contains campaign templates or the event-linked writer. Edit event details here without restarting the process. Event bulk invitations are derived from the live saved event and CRM evidence: company-listed participants receive meeting wording; unknown outside prospects receive an invitation to consider attending, supported by the user-provided reason and registration information. Individual event invitations retain their existing manual evidence-review panel, including person-confirmed attendance when evidence is explicitly reviewed.

Each event member's draft shows attendance status and available source/excerpt/check date. The Writing Assistant receives event and attendance context. Event revision/fields and attendance evidence enter the server approval fingerprint: editing or archiving an event blocks stale approval/send/queue authorization until re-review. Non-event campaign fingerprint format remains compatible with existing approved records.

Review subjects, recipients and messages; explicitly approve drafts. Queue or manual send requires separate delivery authorization. Existing CRM, mailbox connections, suppression policies, schedules and workspace isolation are reused. This feature does not initiate outreach on its own.

## Verification

Regression coverage includes Profile placement, unfinished drafts, conditional exhibitor/visitor fields, source/depth/count save/reload, mixed quota completion, quick batch counts, edition/negation evidence, event-linked approval invalidation and account-switch cancellation. Full customer and backend suites, build and production release-integrity proof are required for release. No real customer email is sent in verification.

## Optional website-first preparation (1 November 2026)

The existing optional Prepare event card now starts with an event website and Analyze event website. It uses the existing public Firecrawl scrape route, suggests a page title and participant-directory links, and retains a bounded source receipt in the saved event. Only one unambiguous future ISO date is suggested; city, country, date ranges and other date formats require manual confirmation. Existing field values are preserved. Late results are discarded after form edits, event selection changes or workspace changes. Failed/empty extraction leaves manual preparation available.

New UI events default to attending and system discovery. Saved exhibitor events retain their role. Audience choices are relevant event participants, business partners across the country, or both. The official website enters participant research; countrywide research retains the active seller's industries without a manufacturing default. Historical extracted text does not establish current-edition or personal attendance. Existing recipient, buyer, approval and delivery controls remain responsible for the rest of the flow.

## Connected event setup audit (8 November 2026)

Profile uses one primary **Save & choose companies** action and a secondary Save draft. Event details and audience targeting remain visible; participant sources, extra research choices and meeting details are collapsible. A single selected target country prefills only new events. Existing saved roles, event facts, source receipts and audience settings are preserved. Duplicate activation controls are retired; optional company-search context controls remain under Manage saved event.

Website analysis uses the authenticated workspace public-first Firecrawl service, with no shared-key fallback. Failed reads leave manual entry available, and late results cannot overwrite edited fields. Missing required fields are named and focused. Saves and recipient handoffs are single-flight; failed or stale workspace acknowledgements cannot navigate, and a canceled campaign switch is reported accurately.

Explicit campaign navigation restores the saved company state before loading Messages and Delivery. The controlled authenticated Chromium regression begins in Profile without visiting Companies first, saves and reopens an event, checks desktop/mobile layouts, hands its audience into shared company selection/research, prepares and approves a conditional event invitation, and reopens unsent Delivery. It uses synthetic public-source fixtures and real local SQLite/session/CRM routes; no real event or contact is inserted into the customer workspace and no email is sent.

The selected saved email campaign is also retained in workspace discovery metadata (`emailCampaignSelection`, bound to the workspace ID). A fresh browser restores that acknowledged selection through the campaign API; a foreign workspace pointer is ignored, and choosing New campaign clears both local and persisted selection. Event and campaign records remain the authoritative data; this pointer stores no draft, contact data or send authorization.

## Event audience and follow-up review (17 November 2026)

The audience selector explicitly distinguishes event participants, outside prospects across the target country, and both. The combined target is a total, not a promised split between audiences. Event-specific industries take priority in event search queries; in combined mode an outside-company query follows the first participant query so a long source list cannot leave that audience until last. Existing company qualification and edition-bound attendance evidence still apply. Supplied CRM companies remain deliberate user choices; unknown attendance stays conditional.

The event form keeps the source choice visible and places Save & choose companies after its fields, without a sticky bar covering them. Invitations are created in Messages, saved to CRM, reviewed, and separately authorised in Delivery. Each confirmed campaign send has a recipient-specific Conversations shortcut. Native Gmail threads support the existing reviewed no-response plans and reply monitoring. Outlook and external/manual sends require manual follow-up. Opening Conversations does not activate a plan or send a message; invitation follow-up dates should precede the event.

For an actual event conversation, select **Post-meeting follow-up** in the individual event writer in Messages. Record a recipient-ready recap and actual next steps; these notes go into the draft. Future events are blocked for this purpose; past events are allowed. The invitation’s registration, stand invitation, future attendance and availability wording are not reused. The notes, purpose, edited preview and original business draft survive CRM save/reopen, and changing buyer/event clears unsaved notes. Applying a follow-up uses the existing working editor, Save, approval and separate Delivery controls. Notes are part of approval authority; changed notes require review again. The optional writer may revise the working draft only. An inactive saved past event can be selected with **Manage saved event → Use saved event for post-meeting follow-up**. This does not restart company research or activate automation.
