# Messages and Writing Assistant audit — 21 October 2026

The owner requested verification of the mandatory message scripts, agreed uploads and Writing Assistant. This audit preserves approved master wording, owner edits, deletion tombstones and explicit approval/send gates.

## Approved script inventory

| Channel | Approved styles present | Effective source |
| --- | --- | --- |
| Email | Professional, NLP/curiosity, Friendly, Brutal Honesty (4/4) | Professional October 17 replacement; other styles October 15 v4 |
| LinkedIn direct message | Professional, NLP/curiosity, Friendly (3/4 visible styles) | Existing approved direct-message masters |
| LinkedIn InMail | Four styles, four stages each (16/16 stages) | October 15 sources, factual contract October 16 v2 |
| Phone | Four complete styles (4/4) | October 17 approved cold-call sources |

Brutal Honesty has no approved direct-message master. Its InMail approval does not authorize copying that text into direct messages. No replacement was invented. All canonical script files remain unchanged. Original uploaded DOCX binaries are not in this checkout; source metadata and extracted text can be checked, but original binary uploads cannot be independently certified here.

## Reproduced defects and prevention

1. Email migration treated missing version metadata as proof of an obsolete builtin, overwriting owner text. A recognized old body could also overwrite an owner-edited subject. Migration now requires a recognized old builtin body, unchanged subject and no explicit owner-copy marker. Tests protect custom text, subjects, all-style tombstones, genuine migrations and read/save/reload history. Explicit Save retains the resolved migration history rather than rereading stale history from storage, and persists the owner-copy marker so a later reload cannot reclassify a name-only edit as an obsolete builtin.
2. Applying a proposal in the Writing Assistant workbench discarded source provenance before Use in Messages. Applied provenance and citations now travel with the working version, recovery and Undo, then accompany explicit handoff into email/direct LinkedIn Messages, the phone draft and the selected InMail stage. Phone/InMail save/reopen retains bounded workspace-matching metadata; invalid/foreign source attribution is rejected before saving. Manual/load replacement clears attribution rather than falsely claiming the new text came from that source. Historical source roles remain historical. Email/direct-message attribution is bound to an exact subject/body snapshot: changing the message or subject cannot relabel unrelated text as book-derived. Persistent Messages Undo restores both prior text and its paired attribution. Phone/InMail capture passes only subject/message to AI and carries attribution separately.
3. A pending Load script confirmation could complete after changing the buyer or context. The action now rechecks the captured context, usability and busy state after the await. Tests exercise buyer, draft and evidence changes.
4. Writing-reference listing could mix old cards with a new reference revision during concurrent activation. A bounded revision-before/after snapshot retry now rejects mixed selection snapshots during activation/role/upload edits, retrying or reporting a conflict. Background processing progress can still change independently of the selection revision and is refreshed by polling.

Regression tests first reproduced each failure. Source changes require the combined customer/backend suites, static build, independent review and the exact-SHA release-integrity proof before production claims. Cache keys cover the changed controller/view imports and their discovery/shell load chain; mandatory release checks cover those keys and applied-provenance guards.

## Writing-source behavior and evidence limits

The code supports three private upload slots, extraction/review, analysis, retry/replacement/deletion, explicit Ready-source activation and a single active source. New uploads remain inactive. Citations are validated against retrieved page/line sections; active sources and requests remain workspace scoped. Applying text, saving a template, CRM saving, approving and sending are separate actions.

The browser connector could not access the originating authenticated browser context during this audit. Therefore the owner's actual book filenames, upload completion, extraction review, Ready state, active selection and a live account generation were not verified. Passing source tests or release proof must not be substituted for that customer evidence. No private source was uploaded, activated, replaced or deleted by this audit, and no outreach was sent.

## Final source validation

The frozen implementation passed all 3,465 customer tests and 827 backend tests (4,292 total), the production static build, syntax and whitespace checks. Independent final review found no unresolved Critical or Important issues and independently passed 43 frontend and 30 backend focused checks. Canonical source files have no diff. Production freshness is a separate exact-SHA release gate; authenticated private-upload evidence remains unavailable as described above.
