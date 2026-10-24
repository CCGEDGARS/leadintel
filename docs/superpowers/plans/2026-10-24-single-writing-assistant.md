# One Writing Assistant

Approved by Edgars: remove the AI Generated style choice, retain the four email templates, move useful length controls into Writing Assistant and preserve existing AI drafts. The assistant remains the creation/editing path; channel-specific core styles remain unchanged.

Implementation: remove original from visible style pickers without deleting the internal original mode or saved records. Keep historic drafts editable and recoverable. Hide legacy Generate another controls. Put the optional short/standard/detailed length preference in the assistant request form, using the existing workspace preference without invalidating message approval. Changing length prepares no request and alters no text. It travels as a separate validated request preference, preserving the full 4,000-character instruction allowance. It guides the next explicit preview only; quick actions and advice retain their existing behavior. Do not apply email word targets to LinkedIn or phone formats.

Verification: failing regressions for four core choices, preservation/reload of legacy drafts, assistant length placement and explicit request behavior. Verify blank and existing draft use, switching scopes, busy state, save/apply/Undo and guarded downstream handoff. Run customer suite using CI's Node version, static build, exact-source review and exact-SHA production proof. No live outreach or automation activation.

Use the existing vanilla JS modules and Node/jsdom tests. Keep core masters, facts, original/history and workspace isolation intact. Reuse existing APIs; no new generation backend. Update every changed loading edge and preserve unrelated changes on main.
