# Writing Assistant workspace

Version: writing-workspace=20261023-v1. User-approved 23 October 2026.

## Three direct actions and automatic save — 29 October 2026, revised

This supersedes the earlier toolbar layout below. Customer work shows Reload script, Clear draft and Save as template directly. Continue to delivery automatically saves changes before closing and returning focus to the main delivery action. Exact persisted copies (including formatting and attribution) skip duplicate saving. The footer remains clickable to explain readiness issues and is disabled while saving. Reload confirms replacement of edits and preserves Undo. General writing keeps Load script and independent Save & close. Approval, sending and all workspace/context guards remain separate.

## Earlier toolbar and delivery return — 29 October 2026

The draft is directly editable. Load script, secondary Save draft, and More sit at the top. More holds Save as template, Restore original, Clear draft, and general-writing Copy. The single editor Undo/Redo controls cover manual and AI revisions, including formatting and source attribution.

The fixed dialog footer offers **Save & continue to delivery** for customer email. It uses the same validated save callback as Save draft and closes only after confirmed persistence of the unchanged draft in the same open session. It scrolls/highlights the existing main delivery control; it never clicks it, approves, activates, or sends. A disabled main control retains its readiness explanation. General writing, phone and LinkedIn offer **Save & close**. Failed/local-only/stale saves preserve the editor. Device recovery is labeled separately from an explicit LeadIntel save.

## Skills-first direct improvement — 28 October 2026

User approved retaining the two-column modal with Writing skills as the main source selector. All saved skills appear in a bounded scroll list; up to three Ready enabled skills can be selected. Selected chips remain visible. Selections alone do not change text; they stay for this working session until deselected or the existing context/session reset.

**Improve draft** replaces the isolated working copy immediately after the existing source freshness and draft validation checks. It preserves Undo and applied provenance. Instructions are optional for existing text, required to define a topic when the draft is blank. General writing can create or improve text without customer context. Repeated improvement works from the latest copy; identical responses do not create a new Undo revision. Saving, approval and sending remain explicit separate operations.

**Book knowledge** is collapsed initially and provides one-book advisory discussion using the current permitted context. Book advice never edits the draft. Skill-based improvement excludes discussion books; book discussion excludes selected writing skills. The earlier preview/Apply and three-book main-card instructions below are historical and superseded for the primary assistant flow. Existing preview APIs remain available to other callers. Voice discussion is not implemented by this interface change.

## Historical use

1. Open Writing Assistant in Messages. Choose **Current customer** to use that recipient's sender/research context, or **General writing** to work independently. General is available without a selected buyer.
2. Keep/edit the loaded working copy, paste another script, use **Load script**, or **Clear draft**. Clear empties subject and body; Undo restores the prior copy.
3. Optionally activate any combination of up to three Ready books on the main cards. Settings handles upload, replacement, details, extraction review and Delete; it does not activate books. At least80% readable content qualifies under the existing coverage policy.
4. Type an instruction. **Ask assistant** discusses it; **Preview changes** proposes a full revision. With an empty editor the primary action reads **Generate draft**. Shorten, Strengthen persuasion and Personalize request previews directly. Books are optional. General Personalize needs audience/person details in the instruction.
5. Review the proposal and cited sources, then **Apply changes**. This edits only the assistant working copy. Undo/Restore remain available.
6. Customer work: **Use in Messages** saves a working alternative, invalidates previous approval and requires fresh delivery review. No action here sends or activates a flow. General work: **Copy**, **Save draft**, or **Save as template**. General saved records reopen through **Load script**.

## Context and persistence

Explicit customer/general mode changes preserve visible text (an intentional user carry-over), clear conversation/instruction, invalidate pending work and clear book selection. Selecting a different customer, account or workspace restores that destination's separate working draft; previous-customer text is never imported automatically. Source selections reset on every open/close, workspace/customer/mode change, and removal of a selected book. Uploads remain stored.

Session choices never write durable source active flags. Assistant requests carry `sourceSelection:session` and exact Ready source IDs/revisions, independently validated in the authenticated workspace. Legacy active-source behaviour for separate AI Generated flows is unchanged.

General provider context uses a strict allowlist: writing context, general channel, language, explicit working text and isolated conversation, plus explicitly selected book guidance. Automatic recipient/seller/research/flow data is excluded on both client and server. General writing does not query or write CRM/customer/flow records. Existing customer fact, channel, identity, URL, citation, approval and send checks remain enforced.

Working-copy recovery is device-local. Explicit general saves use `/api/writing-workspace`, scoped to authenticated workspace and user, with revision compare-and-swap, maximum60 active records and workspace storage-quota accounting. Draft and template records are separate from channel templates and canonical masters. Historical source attribution follows exact saved/loaded text and Undo; manual edits clear it. A save conflict never overwrites another revision or claims success.

## Verification

Regression tests cover no-buyer access, blank and pasted scripts, explicit advice/preview, optional and multiple books, resets, stale chooser/provider responses, scope isolation, source provenance, partial coverage, save/reload/CAS/quota, and customer reapproval. Production release proof also checks the writing workspace version and the exact editor/library/source-selection assets.
