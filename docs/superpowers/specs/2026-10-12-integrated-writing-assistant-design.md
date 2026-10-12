# Integrated Writing Assistant — design for review

Date: 12 October 2026
Status: Concrete architecture for user review; implementation not started.
Project: LeadIntel; extends the existing Step 6 composer.

## 1. Approved outcome

Replace the Adjust message card with Writing Assistant. Keep Shorten, Rewrite and Reset as three equal quick-action buttons. Add a conversation connected to the active customer and current unsaved draft, private document sources, proposed drafts with Apply/Discard, and an expanded view. Built-in skills are explicitly deferred.

Ask LeadIntel remains the business/research/support assistant and retains its no-upload rule. This is one integrated writing assistant, not another disconnected customer selector or another independent message editor. A separate Add to assistant button is unnecessary in this version because the Step 6 message is already connected.

## 2. Existing components to reuse

- `customer/message-workspace.js` and its CSS own the card, quick actions and composer.
- `customer/message-editor.js` owns editing, explicit adjustments, recovery, Save boundaries and source-change protection.
- `customer/outreach-ui.js` supplies the active workspace, recipient, style, selected trigger, reviewed seller context and exact visible draft.
- `customer/writing-references-api.js`, `writing-references-ui.js` and `writing-references-loader.js` own private upload, activation, source revision and processing status.
- `backend/src/writing-reference-validation.js` extracts text with page/line locations.
- `writing-reference-store.js` and `writing-reference-context.js` provide workspace-scoped source records, extracted-text object keys and revision checks.
- Existing customer-owned AI integrations, quota/rate controls and storage metering remain the provider and billing authority.

Existing source limits: three slots per workspace, 20 MiB per document, 600 PDF pages, two million extracted characters per document. Accept text-readable unencrypted PDF, UTF-8 TXT and Markdown. Scanned/empty/encrypted documents produce a clear limitation; OCR is not claimed or included in this version. Partial coverage requires the existing explicit acknowledgement.

## 3. Compact and expanded interface

Card order:
1. Writing Assistant heading and recipient/context chip.
2. Shorten / Rewrite / Reset, retaining their current immediate explicit adjustment behavior.
3. Chat transcript and instruction field, plus an Ask button.
4. Expand button opening a larger dialog containing the same session and controls.
5. Collapsible Sources section with upload, processing, activation and instructions.
6. Proposed subject/body, source references, warnings and Apply / Discard when a draft exists.

The context chip names the selected buyer, company, style and language without exposing API credentials. With no confirmed buyer, chat explains the missing customer context and does not fabricate a customer-specific draft. Users may paste text into the instruction field for advice or a proposed rewrite once the workspace is authenticated.

Expand uses the same assistant controller and state; it does not duplicate upload instances, event listeners, chat requests or preview ownership. Closing the expanded dialog returns the same session to the compact card. Keyboard focus is contained while expanded and returned to Expand on close.

The existing document library moves into Sources with one shared upload/activation instance. Existing AI Generated reference selection remains functional. Source changes notify all consumers through the current revision event.

## 4. Task and output behavior

Users can ask for an explanation, edit advice, subject ideas, a shorter draft, a complete alternative email, or writing grounded in an activated document. The task determines whether the response includes a proposed draft. A request for advice alone must not modify or replace a draft.

Conversational requests produce a preview. Apply updates the working customer draft and invalidates approval/saved readiness. Save remains explicit. Discard drops the proposal without changing the message. Neither action sends, approves or adds to a flow.

The existing quick actions retain their tested direct behavior. Their action-specific loading labels and Reset recovery stay intact. Other operations disable while a request is running. Chat errors or cancellations preserve the entire prior draft and release the controls.

## 5. Context ownership and freshness

Each request captures:
- authenticated workspace identity;
- selected company domain/CRM company ID and buyer ID;
- channel, selected and applied style, language;
- exact current visible subject/body, including unsaved edits;
- reviewed seller identity, offer, reference URLs and meeting preferences;
- buyer/company evidence and selected trigger with verification state, URL and date;
- selected document IDs/revisions and library revision;
- instruction, bounded conversation history and a context fingerprint.

Snapshot limits: instruction 4,000 characters, ten previous turns capped at 12,000 characters combined, existing 12,000-character working-body limit, and a total bounded context payload of 60,000 characters. Oversized context is rejected or reduced by explicit evidence prioritization; never silently truncate the current draft or protected facts.

Recipient, workspace or channel changes cancel pending work and clear the old conversation/preview. Style, language, evidence, draft or source changes mark an existing proposal stale. Apply rechecks the exact fingerprint and active source revision; stale output cannot overwrite the new context. Rendering and hydration must never start an AI request.

Chat is session-scoped in this first version and is not silently persisted as customer history. Applied drafts use existing durable CRM/workspace Save. Uploaded originals and extracted sources retain existing durable private storage. The interface states that closing/reloading clears the conversation while saved messages and uploaded sources remain.

## 6. Document roles and evidence

Each source has a role: writing guidance, seller material, or customer material. The default is writing guidance. Role selection is explicit and persists with source metadata; source changes increment revision.

Books supply techniques and explanatory passages. Seller/customer documents supply attributed user-provided claims, not automatically verified external facts. Any unsupported addition needed for a customer message appears in warnings and is omitted from the draft until confirmed in the appropriate evidence workflow. A document cannot establish that a buyer needs a product, has a budget or holds purchasing authority merely because the model infers it.

## 7. Passage retrieval and attribution

The existing technique catalogue is useful but is not sufficient for book questions. Extend retrieval over extracted `sections` with retained page/line locations:
- split long sections into bounded overlapping passages;
- rank passages by the user question and current message context using deterministic lexical relevance;
- select at most eight passages, with a total retrieval budget of 12,000 characters;
- preserve source ID, revision, filename, location and passage ID;
- combine passage results with relevant existing technique guidance within the same total budget.

A book-specific question reads only the explicitly selected active source(s). Missing relevant passages produce an honest coverage message. Do not claim the whole book was applied or understood from a short excerpt. Citations are validated against the passages actually retrieved; model-invented page numbers, filenames and source IDs are rejected.

Show source filename and page/line location beside advice and drafts. Avoid reproducing long source passages in responses; explain and transform methods in original wording. Never generate an arbitrary download link to a private object key.

## 8. Backend boundary

Add an authenticated, workspace-scoped POST `/api/writing-assistant/reply` endpoint. The backend owns the system instruction, source selection validation, private text retrieval and response schema. Client-supplied system instructions are ignored.

Reuse the active workspace AI provider and its configured model, rate controls and usage accounting. Do not provision another provider or subscription. Return provider failures with a actionable message and no changed customer data. Bound generation duration and output; record usage through the existing integration mechanism.

Validate workspace membership before reading CRM/source data or generating. Resolve company/buyer references only inside that workspace. Treat unsaved text and user-provided document claims as client input, never as platform authority. Do not expose credentials, hidden app prompts, private object keys or another workspace's content.

Request contains the instruction, context snapshot, bounded history and selected source references. Response contains explanatory reply, optional `{subject,message}` draft, validated citations, warnings and context/source provenance. Advice responses have no applicable draft. Unknown fields, invalid formats, unresolved placeholders and unsupported citations are rejected before showing Apply.

No browsing or autonomous outbound tools are added here. Existing verified company research supplies customer evidence; Ask LeadIntel continues to handle broader public research.

## 9. Protected master and draft rules

`customer/approved-reference-scripts.js` remains canonical. Selecting Professional/NLP/Friendly/Brutal Honesty continues deterministic approved-field preparation with exact literals, sequence, spacing and subject categories. Assistant context must not hook into that preparation path or alter its master.

AI Generated can create original writing. Explicit assistant/Shorten/Rewrite requests can create a working alternative to any style, labelled as edited. Preserve supported facts, sender/recipient identities, approved links, meeting format/duration, required AI disclosure and applicable subject constraints. There is no general permission to invent new benefits or facts.

Apply must preserve the first personalized original and recovery history. Reset restores the original personalized version through the existing handler. Update in a core style restores the canonical pattern using current confirmed facts. Save stores the working draft; replacing a master template remains a separate explicitly authorized operation.

## 10. Failure and privacy behavior

- An inactive, removed, changed or foreign-workspace source is never used.
- An activated but unavailable source is reported, not silently substituted.
- Unsupported files and partial extraction show clear status and coverage.
- API errors, malformed output, timeout and cancellation preserve draft and original.
- Duplicate submission runs only one request.
- Late responses cannot enter another buyer/workspace conversation.
- Document text and quoted instructions are untrusted data; they cannot change system rules or execute actions.
- Safe DOM text rendering prevents pasted/document/generated content from becoming executable markup.
- Existing original files, source deletion confirmation and storage quota behavior remain intact.

## 11. Acceptance and verification

1. Compact/expanded views share one session and restore focus correctly.
2. Exactly one set of Shorten/Rewrite/Reset controls remains functional.
3. Current unsaved text and the right company/buyer/trigger reach the request.
4. Advice returns no draft and cannot mutate the composer.
5. A proposed rewrite changes nothing until Apply; Discard preserves everything.
6. Apply creates an unsaved edited version; Save/reopen preserves it and its provenance.
7. Reset restores the original after Apply; core Update restores its approved pattern.
8. All four core master records are byte-identical before/after the journey.
9. PDF upload/activation and source roles survive reload in the correct workspace.
10. Page citations correspond to actual retrieved passages; unsupported citations fail.
11. Empty/scanned/partial files, missing sources and quota/payment failures have actionable UI states.
12. Source/draft/style/recipient/workspace changes reject stale results.
13. Cross-industry tests use customers beyond the existing Ercon fixture.
14. No generation happens merely on mount, render, reload or dialog expansion.
15. Support assistant retains its no-upload behavior.
16. Run relevant backend and customer suites, build, syntax checks, exact-SHA CI/deployment and mandatory production release proof.
17. Verify the authenticated browser journey without sending outreach; report tested behavior separately from actual quality of generated content.

## 12. Deferred scope

The five built-in skills, book-to-skill generation, custom skill controls, OCR, vector database, autonomous sending, new public research tools, a separate assistant sidebar entry and an Add to assistant toolbar button are deferred. No placeholder skill selector appears in the first version.

## 13. Decisions to carry into implementation

Reuse the existing private three-slot source library rather than adding a parallel upload store. Use lexical passage retrieval first; do not add embeddings without evidence that retrieval quality requires them. Use the workspace's existing provider. Keep chat transient but source files and explicitly saved customer drafts durable. Expose edited-draft status and source coverage honestly. Implement inline in the selected isolated worktree after the required design review.
