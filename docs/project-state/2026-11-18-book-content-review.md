# Books upload and content integration review

## Reproduced defects and changes

- An initial Books/Skills list failure displayed “Retrying shortly” but the loader polled only known processing jobs. A failed first load could therefore stay empty indefinitely. Refresh failures now request retries with increasing delays, capped at one minute; successful idle loads stop polling.
- Book analysis updates the source status/revision without changing the workspace selection revision. The loader only notified the Writing Assistant about selection revision changes, so an unavailable Skills endpoint could leave the assistant's book shelf showing Processing after analysis completed. Source identity/revision/status changes now notify the assistant independently.
- Focusing a library tab or button stopped progress polling. The library itself now owns the interaction guard, preserving pending file selections and unsaved input edits while allowing tab/button focus during progress updates.
- Deleting skills remain in the polling set when a book snapshot arrives. Returning browsers receive both changed assets through a new cache version.
- Library instructions now distinguish book discussion from content writing: discuss one book in Book knowledge, or save its reusable skill and select up to three skills in the Writing Assistant. Uploading alone does not automatically rewrite content.

## Acceptance evidence

`customer/test/writing-reference-refresh.test.js` reproduces the initial outage, independent background completion notification and focused-tab stall. Each failed before its corresponding fix. It also verifies recovery, idle polling termination and unsaved input preservation.

`backend/test/book-content-journey.test.mjs` uses the customer API adapters and Writing Assistant controller with authenticated `app.fetch` requests, all SQL migrations, private object storage and the actual registered `app.scheduled` minute handler. Controlled external AI responses prove:

- Ticket upload stores the original and extracted text, and registers durable analysis without request-bound AI work.
- Rate limiting preserves completed sections; the next scheduler invocation resumes only unfinished work.
- Ready books supply actual extracted passages and validated citations to discussion without changing a draft.
- Prepared methods create an independent skill without a second analysis, including when the book is deleted before skill completion.
- Skills remain viewable, exportable and selectable after reopening; generated content retains validated skill attribution through a saved draft and reload.
- Deleted book references and another workspace's skill IDs are rejected.

The focused validation covers 177 customer tests and 170 backend tests, including PDF extraction in the Workers runtime, source/skill lifecycle, invalid output, coverage acknowledgement, workspace isolation, Writing Assistant context protection and save/reload. Static build validation is also required.

These are controlled local results. They do not establish live customer provider availability, credit balance or quality on a particular customer's book. No paid customer provider calls, outreach sending, storage/Stripe changes or deployment are part of this review.
