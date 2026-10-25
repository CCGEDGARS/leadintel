# Link dialog action design — 25 October 2026

The shared link dialog is mounted directly under body, outside the message editor and assistant style scopes. Its Cancel and Apply link actions therefore retained browser-default button styling.

Give the dialog its own scoped action styles: a dark green Apply link primary action, an outlined Cancel action, equal 40px minimum heights, 8px corners, consistent typography and visible keyboard focus. Mobile actions have 44px minimum touch targets and wrap when needed. Link validation, insertion, cancellation and draft behavior are unchanged. The CSS entry is cache-busted and the release smoke gate checks the shipped styling.

Validation: 32 focused rich text, message editor, deployment and production-watch checks passed; static production build passed.
