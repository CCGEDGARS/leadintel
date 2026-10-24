# Delivery experience — 24 October 2026

User request: improve the screenshot's design and verify user friendliness and connections.

Root causes: legacy dark automation CSS in the light workspace; a disabled footer used as an instruction instead of actionable navigation; repeated empty learning breakdowns; a missing confirmed-send refresh event in conversations and Delivery; connection status captured before async work; cached policy errors bypassing retry.

Changed: light cards/fields, visible keyboard focus and responsive grids; sending mode beside mailbox; secondary contact-preference form; compact empty learning; working navigation to Messages, recipient, outcomes or conversations; clear pre-send lock explanation. Status errors expose retries, disconnected Gmail disables activation, and disconnect status updates preserve unsaved edits. Three sends permits exploratory suggestions, not a statistically proven pattern.

Verified: new regressions were observed failing before implementation. Independent review reproduced two recovery cases, now covered by regressions: disconnect during dirty/in-flight edits, and policy refresh failure after a previous success. Backend suite: 894 passed. Focused Delivery suite: 62 passed before final fixture-only updates. Full customer tests and exact-SHA release proof are required in the release pipeline.

Authenticated observation before release: Google account signed in, Gmail connected, Stegra approved opportunity selected, no recorded send and no tracked conversations. No real outreach, follow-up activation or contact blocking was performed. Synthetic tests exercise mutation paths, workspace isolation, save/reload and CRM handoff. Production UI and exact revision must be verified separately; automated tests do not establish real recipient delivery.
