# Message flow quality — 27 October 2026

Root cause: Meeting options was moved after the entire drafts container, but that container also owns the Delivery footer. A sibling-order test passed while preserving the wrong customer sequence.

Correction: mount Meeting options immediately before the nested Delivery footer. Assert their actual shared parent and adjacency in the mounted workspace. Optional follow-up drafting belongs inside Tools; conversation management remains in Delivery. Keep the market translation shortcut visible in the closed language header.

Blocked continuation must identify its missing facts or required review. Reviewing a pending message update navigates to its canonical update control without executing it. Update, review and Save remain explicit; preserve saved versions, CRM isolation, approval and sending gates.

Prevention: verify ordering against the actual customer decision boundary, not just a high-level container. Test both missing-fact guidance and review actions that must not mutate drafts. The sidebar next requirement reuses the existing review navigation and never executes approval or sending.
