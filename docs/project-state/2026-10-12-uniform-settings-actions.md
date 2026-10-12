# Uniform settings actions — 12 October 2026

Request: equal size and shape for the settings drawer buttons.

Cause: auto-sized grid rows stretched links and action groups to fill taller neighbouring cards; flex wrapping and unequal action columns sized buttons by label length.

Change: drawer-scoped shared action geometry (240 × 48 px, 10 px radius), responsive width capped by the available container, equal grid tracks and 8 px gaps. Integration cards align content to the start. The close icon retains its square geometry. Hidden LinkedIn actions stay hidden. Primary, secondary, destructive and disabled colours retain their meaning.

Scope: CSS plus cache invalidation of the settings CSS loader and its HTML entry. No credential, billing, provider, connection or workspace behavior changes.

Verification: existing settings, links, meeting-platform, LinkedIn, privacy and payment-alert tests; complete customer suite; syntax/diff checks. Production status requires the repository exact-SHA release proof. Browser screenshot verification is unavailable in this execution environment because the browser download is blocked.
