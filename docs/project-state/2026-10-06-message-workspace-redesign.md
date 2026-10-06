# Messages workspace redesign — 6 October 2026

User approved a complete visual and interaction redesign of the existing Messages page. Success: immediately understand the recipient, personalization evidence, writing style and next action. Existing saved data, immutable core templates, personal template slots and channel restrictions remain authoritative.

The focused workspace reuses canonical DOM controls and listeners. Preparation contains a reviewed company fact, five email styles (or LinkedIn AI/personal templates), optional three-source references, sender/settings, and collapsed research/campaign tools. The editor contains language, generation readiness, subject choices, an editable draft, secondary draft tools and the channel-specific next action. Recipient restoration, missing reviewed Profile answers, empty editor and existing drafts have distinct states. Invalid booking URLs have a direct settings action. Hypotheses remain separate from evidence. Selecting a fact invalidates approval without running the legacy generator or replacing the selected writing style.

Email approval continues to Delivery only after the existing approval gates succeed; no outreach is sent. LinkedIn remains copy/open/manual send with explicit CRM acknowledgment. Template masters remain read-only; personal libraries retain 5 email and 3 LinkedIn slots. Source slots stay private and workspace-scoped. The references loader targets its dedicated collapsed panel.

Desktop uses a compact preparation rail beside the editor and removes the redundant utility column for this stage. Mobile uses one column, compact style cards, collapsed optional tools and full-width next actions. Existing navigation and all later stages remain available.

Independent review identified a stale-generation cleanup race. Busy cleanup is now request/workspace-gated; regression test proves canceled A cannot clear newer B or overwrite its draft. All customer tests, static build, exact-SHA production proof and authenticated visual acceptance must pass before completion. Production evidence follows on a documentation branch.

## Verified release

PR448 shipped the focused layout; PR449 polished compact navigation, context-based subject previews and Improve readiness. Final production main: `1968c13b6b32d36333a6605f3d3d81ba10db7b7d`. Vercel deployment `dpl_HwAbjfNdpyR74bB8rBZSgwUswky7` READY. Exact-main Customer V2 CI `37515271227` success. Release integrity PROVEN: 39 smoke checks plus manifest and backend health. See companion production proof JSON.

All 1,835 customer tests passed with test concurrency 4; static build passed. An unrestricted parallel run encountered an existing Discovery timeout test failure under load; the isolated file passed 71/71 before the bounded full run passed. Independent review found no remaining Important issues.

Authenticated desktop acceptance verified recipient Joakim Winsa at LKAB, visible saved email draft, five style cards, protected masters, personal templates, collapsed settings/references/research, active-context subject previews and correct generation/approval gates. Sender Calendly remains https://calendly.com/edgars-7go/strategy-call. Three references remain empty. The two new Profile inputs were completed from the user's already approved delivery and meeting-value wording; all 12 inputs confirmed, existing profile and strategy approval restored through UI, saved selected-company/buyer workflow resumed to Messages. No AI generation or outreach was sent during this final walkthrough. Existing draft is preserved and requires fresh generation before approval because context changed.

Responsive layout is implemented and covered by structural checks; physical mobile browser acceptance was not performed. Screenshot saved from final production signed-in page.
