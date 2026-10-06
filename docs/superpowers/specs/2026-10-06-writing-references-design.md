# Writing References — implementation design

Date: 6 October 2026. Status: approved by user; implemented and locally verified; production acceptance pending.

## Outcome and scope

Three private, workspace-scoped source cards in Message settings let users influence AI Generated email and LinkedIn messages with books or other documents. A source is analysed after upload, but influences generation only while explicitly activated. With no active sources the existing generation path remains unchanged. Protected Professional, NLP, Friendly and Brutal Honesty templates, and the existing personal-template libraries, are not rewritten or governed by these sources.

V1 accepts PDF, UTF-8 TXT and Markdown, one file per slot; maximum 20 MiB, 600 PDF pages and 2 million extracted characters per file. Unsupported, password-protected or oversized files are rejected before processing. Image-only pages are reported as unreadable; V1 does not claim OCR support or full-book coverage when text is missing. The two attachments in this conversation are not automatically uploaded or activated.

## User interface

Each numbered card shows filename, processing state, coverage, concise “What AI learned” summary, optional editable “Use this for…” instruction and Upload/Replace, Delete and Active controls. States: Empty, Uploading, Processing, Ready, Needs attention, Failed, Deleting. Only Ready sources can be activated. Activation persists across sessions until switched off. A generation indicator names the active sources and their count. Summary/details expose extracted techniques, appropriate uses, cautions and adapted examples with page/section attribution.

Upload defaults to inactive. Replacement retains the old source until the new upload validates, then immediately disables the old influence, installs the new inactive version and deletes the old derivatives. Failed validation preserves the original card unchanged. Instructions and activation use optimistic revision checks; concurrent edits show a conflict instead of silently overwriting. Processing can be retried without duplicate charges for completed chunks. Neither activation nor source edits replace an existing draft.

## Storage and isolation

Follow the supplied Master CRM design: durable records outside the 500 KB workspace JSON. Store original bytes and extracted text privately in object storage, with metadata, slot assignment, instructions, processing jobs and structured writing guidance in dedicated D1 tables. Use workspace-scoped opaque IDs, authenticated reads and no public file URLs. A unique workspace/slot constraint enforces exactly three slots. Immutable source revisions and content hashes distinguish replacements and retries; never deduplicate private files across workspaces.

The checked repository has D1 and brand-asset storage abstractions but no R2 binding in backend/wrangler.toml. Implementation must verify available private object storage, provision/configure the required binding through an authorized deployment route, and report a concrete access blocker if unavailable. Do not silently embed books in workspace state or expose them through public brand-asset routes.

## Extraction and processing

Use a locally bundled, pinned PDF text extractor, with page boundaries and coverage counts. Text documents preserve section/line boundaries. Validate MIME/content signatures, size and extracted-text limits server-side; extracted text is untrusted input, not executable content. Originals are retained unchanged until deletion.

Process all readable content in bounded overlapping chunks. Durable server-side jobs track extraction, chunk analysis, aggregation and completion, with lease ownership, bounded retries and resumability. Browser closure must not discard work. Reuse the configured AI provider abstraction and workspace usage limits; do not introduce a new paid provider by default. Show quota/provider failures distinctly and never label incomplete processing Ready.

Each chunk yields schema-validated principles, techniques, openings, structures, tone/vocabulary guidance, invitations, appropriate uses, cautions and short adapted example patterns with source locations. Aggregate duplicate ideas while retaining meaningful variations and provenance. Keep a searchable technique catalogue, not just a single vague summary. Select relevant catalogue entries and short source passages for each message within a fixed prompt budget. No vector database is required for three files; deterministic relevance ranking plus bounded selection is the initial approach.

## Generation contract

Backend generation resolves active, Ready source revisions from authenticated storage; it does not trust browser-supplied reference content or activation lists. Apply only in AI Generated/original mode, including Improve in that mode. User-made numbered templates and protected styles remain outside this feature in V1.

Priority: system safeguards and mandatory message rules; verified sender/recipient/trigger evidence; explicit message and source-use instructions; relevant active-source guidance. Books cannot establish seller experience, customer results, recipient facts, scores or pain points. Preserve real-number evidence requirements, supported revenue/cost/process benefits, and the existing 30-minute Zoom/Calendly and channel constraints. Never force all techniques into one message. Resolve stylistic conflicts through explicit instructions; otherwise prefer common compatible guidance and omit conflicting techniques.

Source text cannot override instructions, request secret disclosure, initiate tools or sending, or create commitments. Adapt examples rather than reproducing long passages. Record the active revision IDs and applied technique IDs with the generated draft, without storing book passages in CRM. Ordinary CRM save/reopen, buyer/channel draft preservation and manual LinkedIn sending remain unchanged.

## Deactivation, deletion and concurrency

Deactivation excludes the source immediately from future generation but retains its data. Delete requires an explicit confirmation explaining permanence, then invalidates the source before removing original bytes, extracted text, catalogue, custom instruction and processing derivatives. A deletion tombstone/job may retain only opaque identifiers needed to prevent resurrection and finish cleanup; it contains no document guidance. Show Deleting until cleanup succeeds; failed cleanup is visible and retryable, never a success toast.

Deleting/replace/activation changes cancel applicable jobs and increment a workspace reference revision. Late extraction results cannot recreate a deleted source. Recheck reference revisions before returning AI output; discard output generated with deleted or deactivated guidance and offer regeneration. Retries and stale browser saves cannot restore a deleted source. Do not promise deletion from provider retention or backups; exclude document text from application logs and caches, disclose configured-provider processing, and document actual retention separately.

Existing drafts and saved templates remain intact: deletion removes active settings and derivatives, not content already created. Their historic source IDs are provenance only and cannot reactivate guidance. A current edited draft is excluded from fresh Generate unless the user requests using it; Improve explicitly uses its existing wording and can therefore retain earlier stylistic influence.

## API and components

Introduce isolated writing-reference storage, extraction, job, catalogue/ranking and generation-context modules, plus the three-card UI. Workspace-scoped authenticated endpoints list cards, validate/store uploads, read details, update instruction/activation with expected revision, retry processing and delete. Maintain versioned generation input/response provenance without changing email or LinkedIn output schemas. Add forward-only database migrations and deployment configuration; no raw files or extracted catalogues in workspace sync payloads.

## Acceptance and release gates

Tests must exercise three-slot limits; unsupported/oversized/encrypted/scanned/mixed PDFs; truthful coverage; chunk deduplication/resume; real extraction and real provider aggregation; activation combinations; zero-active unchanged behavior; core/personal styles unaffected; conflicting guides; injection attempts; unsupported fact rejection; workspace isolation and unauthorized object reads; concurrent replace/edit/delete; late results after deletion; idempotent cleanup; reload and migration non-resurrection; and cross-industry/name-invariance behavior.

Authenticated acceptance uses a purpose-made non-sensitive reference: upload, analyse, inspect learned techniques, activate, generate and observe meaningful influence, deactivate and observe exclusion, persist/reload, replace, cancel deletion, confirm deletion and verify derivative removal. Also verify independent email/LinkedIn drafts, existing protected templates and manual-send boundaries. Do not fabricate the remaining sender inputs to bypass existing generation gates.

Run full customer/backend suites, build, migrations and exact-SHA release proof with additional mandatory writing-reference checks. Report code tests, PROVEN PRODUCTION evidence and authenticated customer acceptance separately. Completion requires actual private-storage configuration, real document extraction/AI processing and generation integration—not placeholder cards.
