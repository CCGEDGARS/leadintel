# Buyer role and research continuity

The owner requested correction of the recurring workflow rather than another claim that a passing build proves all buyer outcomes. Current customer evidence establishes: Emma's Treg email is visible and usable; Robert is retained but held by a dossier role conflict; some other channels still display Not checked. Current authenticated dossier inputs are unavailable. No claim that a particular conflicting title caused Robert's hold is justified yet.

## Reproduced cause across state transitions

Dossier reconciliation already recognizes selected role aliases, while research receipt ownership uses literal role text. Swedish procurement titles were absent from the alias list. An English/Swedish pair could produce a false dossier conflict; even existing English aliases could invalidate all completed channel receipts after save/reload, making research appear undone. Both failures are reproduced in tests before the correction.

Qualification and receipt continuity now use the same established role equivalence. Add exact Swedish procurement-head/director aliases, not fuzzy title matching. Only the title component of a complete six-part identity key may vary; company domain/name, person name, employer and LinkedIn identity remain exact. Query text, actual completion receipts, policy version and freshness still govern whether each check passed. Resume executes missing queries rather than clearing completed sibling checks. Retained receipt recovery follows the same rule and refuses ambiguous current identities.

Existing dossier reconciliation removes an obsolete equivalent-title hold only with fresh source-backed multi-provider consensus. Real different roles, departures, future appointments, employer changes and conflicting evidence remain held. Original quotes/sources are preserved.

## Evidence and remaining acceptance

New tests cover bilingual literal sources, obsolete hold recovery through serialization, preserved channel checks, four-buyer missing-Gmail continuation, saved receipt restoration, and negative identity changes. Existing timeline and research-resume tests remain required, alongside CI's authenticated HTTP/scheduler/browser/persistence journeys. No live paid lookup or outreach is authorized or executed by these tests.

Emma's paid-email customer outcome is confirmed by the later screenshot. The overall four-buyer acceptance remains open until the current authenticated saved dossier and per-person coverage are inspected; a release proof is not that acceptance. Never fill the fourth card by suppressing genuine qualification holds or label unexecuted research as complete.

## Read-only customer evidence

Research details now offers Download research report for the selected company. Its allowlisted projection includes buyer identities, per-channel execution counts/status, role holds and conflicting dossier titles/source locations. It excludes API/provider settings, contact addresses/numbers, drafts, raw source bodies and URL queries/fragments. Downloading it does not save, refresh, spend, send or alter research. This enables current-state diagnosis when authenticated remote access is absent, without using broad workspace exports or repeated screenshots. The report's privacy and no-mutation behavior are covered by tests.
