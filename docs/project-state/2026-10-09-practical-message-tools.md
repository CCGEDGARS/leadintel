# Practical Messages workspace — 9 October 2026

## User agreement

Simplify the Outreach Tools segment, remove duplicated shortcut/panel controls, restore vertical style buttons, and make the left preparation area useful. Preserve the single working message, exact Save/Flow gates, pinned default, recipient records, original/history recovery, sender/language settings, and full-width Event invitation.

## Implemented structure

The left rail contains the buying trigger, five vertical writing styles, Custom style settings, AI Writing Assistant, and Outreach Tools. The editor has more width for reading and editing. AI assistance offers Improve message, Shorten and Improve subject; the old Rewrite button is reused here instead of duplicated in the message toolbar. Main actions use Add template to distinguish adding a saved draft from opening Template library.

Outreach Tools has four direct expandable sections: Template library (20 email templates / 3 LinkedIn templates), My content, Approved originals, and Writing references (3 books). Custom style settings retains the four personal subject/body overrides, activation and previous revision restoration under the style selector. Business value and proof is under Sender & settings. Advanced research/campaign controls are preserved in a separate collapsed full-width section below the message workspace. Event invitation remains full width.

Approved originals combines the protected English scripts/subject references and existing owner-managed language references. The legacy selected-template pattern panel remains accessible for personal templates inside the library and is hidden for system originals, avoiding duplicate English previews. Canonical wording is unchanged.

## My content persistence and lifecycle

Migration 0029 creates dedicated workspace-scoped D1 content_materials records outside the workspace JSON budget. The authenticated first-party API supports listing, creation, revision-checked editing and deletion. Owner, researcher and sales roles can use it. Capacity is 50 materials; each has a title (100 characters), category and plain text (6,000 characters). Categories cover drafts, offers, case studies/proof, stories, FAQs/objections and resources/links. No automatic link crawling or file ingestion is implied.

Users select up to five material ID/revision references for the current message (16,000 characters combined). Only these small references are kept with the working message. Selection does not regenerate, approve or send anything. Failed saves preserve the edit form; stale writes fail with a conflict. Workspace changes clear private in-progress material fields and ignore late results. Deletion has an inline cancellation step; deleted records are never silently recreated.

The backend resolves selected records from the authenticated workspace before AI work, appends them as untrusted writing ingredients, then checks revisions again after the provider returns. The client rechecks provenance before applying. Saved notes are not verified evidence; their instructions, prior recipients, claims, quantities and links cannot override approved seller/recipient facts. Core factual-field preparation never receives these notes. They guide AI Generated or deliberate writing assistance only. They do not become automatic-flow defaults or change the approved originals.

## Writing assistance

Explicit assistance updates the one working draft, invalidates approval and supports Undo; Save remains a separate exact CRM operation. Subject assistance accepts a factual one-line subject of at most 60 characters and requires byte-for-byte body preservation. Shorten rejects results that are not shorter. Body assistance preserves existing links, sender identity, 20-minute invitations and AI disclosure, with existing event validation and core word ceilings. Changing selected materials cancels pending AI responses while preserving manual edit state and original/undo history.

## Verification

Local customer suite: 2,091 passing tests. Backend suite: 486 passing tests. Static build passed. Regression coverage includes material create/edit/reload/delete/cancel, stale revisions, workspace isolation, failed-save text recovery, selected-material AI injection, edits during provider generation, subject-only changes, Undo, protected originals, single-editor Save/Flow gates, and direct tool sections.

Release-integrity configuration adds mandatory checks for the practical tools, material client, and unauthenticated storage denial. Production status must be established separately using exact-SHA CI, matching live manifests, backend health and PROVEN release-proof.json. These local checks do not imply that outreach was sent or that an arbitrary saved note is verified evidence.
