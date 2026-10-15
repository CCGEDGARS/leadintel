# Phone call sidebar — 15 October 2026

The Messages sidebar now exposes Email, LinkedIn and Phone call. Phone call opens the existing CRM-contact-scoped calling workspace, retaining its four protected core-style slots, AI Generated, personal templates, Script Assistant and the existing coming-soon call dialog. Approved phone wording must be supplied by the owner; missing styles remain explicitly awaiting approval.

Root cause: the sidebar's channel list and outreach navigation adapter still supported only email and LinkedIn after the calling workspace was added. Both now route to the same channel workspace. The active sidebar item follows the visible phone workspace without changing the confirmed email/LinkedIn recipient selection. Switching back clears the phone view while preserving the contact's call working copy and existing message drafts. A saved recipient is reopened through the established CRM validation path when required. Signed-out, conflicting and foreign-workspace choices remain blocked. No call or outreach is sent.

Regression coverage includes all three sidebar entries and workspace-safe highlighting, the actual outreach-to-phone adapter, draft preservation, return to email, invalid channel rejection, and the existing calling placeholder. Production smoke checks require the sidebar and phone handoff markers. Changed browser module boundaries receive scoped cache-version updates.

Verification: run the full customer suite, build/static deployment check and exact-SHA production release-integrity workflow. DOM integration checks exercise the production adapters; authenticated customer acceptance is separate from automated checks.
