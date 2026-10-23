# Writing Assistant workspace

Version: writing-workspace=20261023-v1. User-approved 23 October 2026.

## Use

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
