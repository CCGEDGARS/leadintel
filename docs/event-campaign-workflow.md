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
