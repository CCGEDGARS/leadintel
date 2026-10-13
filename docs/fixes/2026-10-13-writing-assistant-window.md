# Writing Assistant conversation-first window

The material panel was before the conversation, exposing three empty slots and controls whose styling was scoped to the main editor. Conversation history disappeared on reload.

The dialog now shows conversation, instructions and proposed-message review first. The optional material section starts collapsed and exposes one upload/replace control. Existing populated legacy slots remain manageable without deleting customer files; empty legacy slots are absent. Material settings are collapsed. Analysed material explicitly shows Ready · In use or Ready · Not in use. The separate activation list in custom style settings is removed.

Dialog controls have scoped styling, mobile layout rules, loading/cancellation states and inert text rendering. Apply to message remains separate from Save and grants no sending permission. Approved originals are unchanged.

Conversation and unsent instructions persist in bounded browser-local sessions keyed by workspace, buyer and channel. Account-cache validity guards storage. At most six sessions, each with at most 16,000 message characters, are retained. Unavailable storage cannot block writing or applying. Recovered conversations never revive an actionable proposal. Buyer/workspace changes reject stale responses and switch the displayed instruction. This is continuity in the same browser, not cloud conversation synchronization.

Regression coverage includes placement, one-slot uploads, activation, inert output, pending file retry, cancellation, stale Apply protection, scope switching, reload restoration and storage failure. Release checks require the new source markers and cache versions. Browser visual verification could not run because Playwright has no installed browser executable. Signed-in provider behavior remains a separate acceptance check.
