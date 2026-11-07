# Retrospective UX audit: Setup, Profile, Strategy — 2026-10-12

Basis: ERCON walkthrough screenshots and previously recorded live QA. Findings are visual observations / recommendations unless explicitly verified by regression tests. All screen changes remain pending implementation.

## Stage 1 — Setup
| Element | Decision | Rationale / acceptance |
|---|---|---|
| Company website input, activation evidence | KEEP / SIMPLIFY | Required foundation. One clear status, verified source, last refreshed timestamp, no automatic paid re-scrape on navigation. |
| Target market selector and selected-market pills | KEEP / SIMPLIFY | Essential, but remove repeated explanations and redundant selection visuals; keep custom markets discoverable. |
| Sidebar expanded checklists and stage-progress summaries | HIDE / SIMPLIFY | Keep compact stage status; details expandable rather than continuously competing with core task. |
| Required labels and long supporting instructions | SIMPLIFY | Show brief contextual guidance, full explanation on demand. |

## Stage 2 — Profile
| Element | Decision | Rationale / acceptance |
|---|---|---|
| Core four targeting questions | KEEP | Preserve manually supplied answers and visible save state. |
| Multiple 'Enough to continue' + 'Saved' indicators per field | SIMPLIFY | Consolidate where state unambiguous; retain actionable validation and sync failure warnings. |
| Every card's 'Your input / customer-provided context preserved' repeat | SIMPLIFY / HIDE | One area-level provenance cue, per-field detail on demand. |
| 8/8 completion bar, 100% profile and 2/5 evidence coverage | SIMPLIFY | Distinguish completed input from verified evidence; no misleading certainty. |
| Repeated optional company research prompt despite saved evidence | SIMPLIFY / CONDITIONALLY HIDE | Identify existing saved research and avoid urging duplicate paid work. |
| Research-source sections | KEEP / HIDE | Show concise evidence summary, expanded details on demand. |
| Tender rule contradiction | KEEP / SIMPLIFY | One actionable alert; preserve purchasing filter; no silently changed targeting. |
| Reference companies and separate market research controls | MERGE navigation only | A single contextual route to advanced research, without removing independent underlying capabilities. |

## Stage 3 — Strategy
| Element | Decision | Rationale / acceptance |
|---|---|---|
| Two Lookalike cards / activation mismatch | MERGE | One Lookalike Customers field; explain existing Epiroc active reference vs optional ICP enabled state; preserve both records and scoring. |
| Preferred Sources and Website Monitoring | HIDE / SIMPLIFY | One collapsed Sources & Monitoring container; distinct subfeatures and status; no hidden state changes or paid actions. |
| Repeated full values on multiple ICP cards | SIMPLIFY | Inherited values summarized, editable when desired. |
| All buying signals High/9 | KEEP / SIMPLIFY | Retain user values, help discriminate importance without modifying scores. |
| Empty Commercial Value field in Core ICP | SIMPLIFY | Nonblocking completeness suggestion; no generated claim. |
| '4/4 complete' yet 'In progress' | SIMPLIFY / FIX | Make stage progress and approval status semantically consistent. |
| Horizontal scrollbar | FIX if reproduced | Identify overflowing component at screenshot viewport and add responsive regression test. |
| Detailed scoring panels | HIDE | Show key market priority and confidence; expose scoring explanation on demand. |
| Repeat tender warning | SIMPLIFY | One contextual alert with explanation rather than duplicates. |

## Release gates
- No destructive data migrations, disabling scheduled monitoring, or removing any protected messaging templates.
- Add visual/regression checks for stage navigation, saving and refreshing, sources, references, and user-owned billing.
- The proposed removals are interface-only until impact assessment proves there are no data or workflow dependencies.
- Record each change as a separate PR-testable acceptance outcome; do not deploy broad aesthetic rewrites without validation.
