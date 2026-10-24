# Delivery experience

Edgars requested a clearer design and a check that the Delivery screen is friendly and connected. Retain the existing light workspace and its green interaction states. The screenshot shows dark legacy automation CSS in the light shell, an oversized disabled footer, repetitive empty learning cards and weak workflow hierarchy.

Use the existing modules rather than a new page/framework. A CSS-only repaint would leave the dead-end and stale conversation state; a full rewrite would risk sending/CRM behavior. Chosen implementation: focused styling plus the small verified navigation/status gaps. This is an implementation choice within the authorized improvement request.

Delivery: readable white cards, consistent borders, 44px targets, green hover/focus and responsive layouts. Show saved sending mode honestly, including loading/error/retry instead of a false default. Keep suppression visible, label its form and preserve owner-only workspace scope. Place delivery mode near the mailbox, and suppression at the end.

Learning: retain metrics/export; with no sends, replace four repeated empty breakdowns with one useful explanation. Three sends is an exploratory threshold, never proof of effectiveness.

Replace the disabled footer with a status and working navigation to the next prerequisite. Navigation must never send mail. Expose pre-send locked reply/outcome explanations. Refresh conversations and Delivery from confirmed provider-send events; preserve dirty follow-up edits. Connection status must distinguish a disconnected mailbox from a configured hourly cadence.

No outreach, activation, suppression of real contacts, provider configuration, approved template changes or customer-data changes are authorized by this verification. Use synthetic fixtures for mutations. Report tests, production proof and authenticated observations separately.
