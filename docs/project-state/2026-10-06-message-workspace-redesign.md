# Messages workspace redesign — 6 October 2026

User approved a complete visual and interaction redesign of the existing Messages page. Success: immediately understand the recipient, personalization evidence, writing style and next action. Existing saved data, immutable core templates, personal template slots and channel restrictions remain authoritative.

The focused workspace reuses canonical DOM controls and listeners. Preparation contains a reviewed company fact, five email styles (or LinkedIn AI/personal templates), optional three-source references, sender/settings, and collapsed research/campaign tools. The editor contains language, generation readiness, subject choices, an editable draft, secondary draft tools and the channel-specific next action. Recipient restoration, missing reviewed Profile answers, empty editor and existing drafts have distinct states. Invalid booking URLs have a direct settings action. Hypotheses remain separate from evidence. Selecting a fact invalidates approval without running the legacy generator or replacing the selected writing style.

Email approval continues to Delivery only after the existing approval gates succeed; no outreach is sent. LinkedIn remains copy/open/manual send with explicit CRM acknowledgment. Template masters remain read-only; personal libraries retain 5 email and 3 LinkedIn slots. Source slots stay private and workspace-scoped. The references loader targets its dedicated collapsed panel.

Desktop uses a compact preparation rail beside the editor and removes the redundant utility column for this stage. Mobile uses one column, compact style cards, collapsed optional tools and full-width next actions. Existing navigation and all later stages remain available.

Independent review identified a stale-generation cleanup race. Busy cleanup is now request/workspace-gated; regression test proves canceled A cannot clear newer B or overwrite its draft. All customer tests, static build, exact-SHA production proof and authenticated visual acceptance must pass before completion. Production evidence follows on a documentation branch.
