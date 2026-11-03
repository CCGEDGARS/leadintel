# Four confirmed Buyers contacts — 3 November 2026

Owner outcome: show the four most relevant qualified contacts with confirmed contact data. Keep everyone else collapsed. In response to the explicit channel question, the owner chose option 2: confirmed work email, phone **or** LinkedIn is sufficient for each place.

## Root cause and implementation boundary

The prior Refresh repair preserved contacts but expanded all saved people when role review left no priority group. That recovery fallback violated the newly clarified display requirement. The research ranking also reserved role places before considering usable contact data, while quality/outcome reporting still used the older two-email target. The result could disagree across list, summary and readiness.

Use one read-only confirmed shortlist in the shared discovery engine. Keep research ranking and all retained evidence separate. Filter qualified, conflict-free people by actual confirmed channels, then take the four most relevant. Never promote unknown contacts merely to fill places. Report N/4 and keep every other person under the closed Show other contacts disclosure. An incomplete broad research run does not erase independently confirmed channels or fabricate whole-step completion.

Contact evidence keeps its existing owner: exact-person source attribution or accepted CRM records, scope-bound to the active workspace/company. The UI, default durable-job quality assessment and outcome report share the same selection. LinkedIn aliases must agree; current matching dated evidence can supersede an older automatic timestamp. Preserve explicit manual-review semantics. Email, phone and LinkedIn counts remain independent. A confirmed phone/profile does not enable email Proceed or sending.

## Evidence and limits

Regression coverage includes zero to four results, more than four confirmed people, relevance ranking, stale/guessed/conflicting data, mixed channel acceptance, cross-workspace/company records, provider phone binding, and read-only state preservation. Mandatory authenticated Chromium journeys exercise actual SQL/API ownership, Refresh and role recovery, real controlled official source reads, save, fresh browser reopen, four main/six collapsed contacts, narrow/mobile widths, and no paid lookup or outbound activity. A separate mixed-channel fixture starts with retained named phone evidence and manual profile review, then refreshes official evidence and verifies persistence. These fixtures are controlled acceptance evidence, not proof that four usable contacts were obtained in the private customer workspace.

Release requires full customer/backend suites, build, mandatory browser CI and the exact main-SHA release-integrity verdict PROVEN. Preserve PR829's task resumption, complete receipt reuse, roster/context guards and contact preservation. No unrelated dirty files, outreach masters, paid consent or automatic send settings belong in this change.
