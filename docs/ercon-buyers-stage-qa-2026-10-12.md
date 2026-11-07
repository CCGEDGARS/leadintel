# ERCON Buyers Stage 5 QA — 2026-10-12

Screenshot-based observations. Do not infer that personal email ownership or job titles are independently verified; screenshots represent application claims.

## P1 correctness and safety
- 1/1 stage complete conflicts with 'Research incomplete' and uncovered Engineering/Operations functions: label discovery coverage versus verification/readiness distinctly.
- 'Research complete' on buyer cards can be misconstrued as contact verified. Separate role identity, LinkedIn, email provenance, mailbox deliverability, sending eligibility.
- Generated/likely Gmail addresses or guessed corporate formats must NEVER be represented as verified or auto-sent. Keep explicit evidence requirements and human approval.
- LKAB is user-selected while opportunity unverified; preserve manual override and provenance, no claim of buyer intent.
- Selected Joakim contact is shown as publicly confirmed address with mailbox still unverified. Do not expose contact details in public QA docs.
- Resuming incomplete checks and refreshing buyers can invoke paid providers; disclose cost/usage and get explicit confirmation.

## P2 clarity and simplification
- Buyer cards repeat four evidence boxes, numerous action buttons and lengthy caveats. Compact default: name, role, fit score, confidence, readiness, one main select action; expandable evidence and individual confirmations.
- The 'Confirm email', 'Confirm phone', 'Confirm LinkedIn' controls should only operate when relevant; email mandatory for email outreach, phone optional, LinkedIn independently reviewed.
- Display 4 priority buyers; 6 optional candidates collapsed by default, with safe expand/research options.
- Collapse technical 'Research coverage' and 'Result decisions (189)' by default. Keep technical auditability.
- Differentiate '20 reviewed', '10 identified', '4 researched', '4 prioritized', '6 others', and '2+2 committee' with clear stage provenance.
- Remove repeated disclaimers in every card; keep single contextual alert and per-contact details if needed.
- UX state shows Stage 5 1/1 while 'In progress'. Harmonize statuses.

## Evidence and next gates
- Visual pass: LKAB selection, 4 priority buyer cards, 6 additional potential buyers and selected recipient persisted.
- Actual provider credential and verification status, live backend accuracy, cost, sending eligibility not independently tested.
- Do not trigger refresh, automated send, paid enrichment, or delete saved contacts during audit.
