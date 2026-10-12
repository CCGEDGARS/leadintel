# LeadIntel UX and Commercial Simplicity QA Standard — 2026-10-12

Approved by product owner during ERCON seven-stage walkthrough.

Evaluate every screen as (1) software architect, (2) UX designer, (3) paying customer. Audit reliability, data persistence/isolation, AI/evidence quality, accessibility, unnecessary distraction, duplication, avoidable clicks, commercial usefulness, performance and provider costs.

## Every component receives an action
- KEEP: necessary, clear, effective.
- SIMPLIFY: useful but complex.
- MERGE: redundant or overlapping features.
- HIDE: advanced or contextual, collapsed by default.
- REMOVE: no demonstrated user value, after dependency/data impact analysis and approval for destructive changes.

## Operating principles
- Progressive disclosure by default: main task visually dominant; advanced features hidden but discoverable.
- One canonical field/control for one conceptual feature. Single Lookalike Customers field; preserve activated references, lookalike matching, and legacy saved state.
- Preferred Sources and Website Monitoring remain logically distinct; one compact collapsed Sources & Monitoring entry, no duplicate full panels.
- Do not automatically pay for research, enable monitoring, delete user data or change outreach approvals.
- Evaluate if an element is needed *here*, not merely whether it can be built.
- For each change record expected improvement, impact on existing data, regression risk and objective acceptance tests.
- Treat live ERCON walkthrough screenshots as observations; confirm bugs with tests where feasible.
- Prioritize P0 stability and buyer-ready demo over feature expansion or cosmetic refinements.

## Workflow
Capture screen -> mark KEEP/SIMPLIFY/MERGE/HIDE/REMOVE -> record severity and evidence -> identify dependency -> implement on rescue branch -> test -> preview -> merge only when verified.
