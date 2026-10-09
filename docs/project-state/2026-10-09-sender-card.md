# Sender details upfront — 9 October 2026

Messages now shows a Sending as card above the working draft, displaying saved sender full name, title, company, email, phone, LinkedIn and Calendly. Missing values remain explicit; no account-owner contact details are invented. The canonical sender/settings controls have moved out of Outreach Tools into this card. Edit sender details opens the existing editor and focuses the sender name.

Email is an optional, validated sender identity field (254 characters), preserved by normalization, controller edits, workspace persistence and immutable approval snapshots. Email joins phone in plain-text and HTML signatures. This contact email does not select or authorize a sending mailbox. Protected original scripts and exact-text Save remain unchanged.

Regression checks cover card ordering, workspace clearing, canonical field uniqueness, real UI email/phone editing and save, identity snapshot roundtrip, validation and signatures. Full customer suite and static build must pass; exact-SHA production evidence is required separately under release integrity. Authenticated CRM reload acceptance is not established by these DOM/model tests.
