# Step 6 stabilization and acceptance plan

## Decision

Stabilize the complete Messages journey before adding more features or changing the provider/model. The authenticated settings page on 11 October showed OpenAI `gpt-6.1-sol` active. A stronger coding/review model can help diagnose complex issues, but an application model upgrade must earn its place on the same failure examples with measured correctness, latency and cost. No model or billing settings were changed.

The existing test count and release smoke checks establish useful technical coverage, not complete customer acceptance. The 11 October blank-editor release proved one explicit generation interaction; it did not establish that all of Step 6 was repaired.

## Reproduced causes and first repair

1. Email handoff had no equivalent of LinkedIn's durable CRM message recovery. If local message state was absent, reopening constructed an empty draft even when the CRM contained a saved email.
2. Explicit CRM reopening selected the latest company package without matching recipient and channel. Unrelated snapshots also stopped pagination before the correct older package.
3. Explicit recovery guarded company/workspace only. A late response could overwrite a new working edit and did not refresh the full visible editor.
4. Failed generation preserved the body but left the selected style and subject catalog on the unsuccessful choice. Cached reopening could likewise retain another selection's style.

The repair shares recipient/channel-scoped CRM lookup, paginates until the matching message, preserves newer local drafts, fails visibly when history cannot load, checks the captured displayed draft before applying explicit recovery, refreshes the entire view and restores the applied style on failure/reopen. Source masters are unchanged. Saved drafting, approval, flow membership and sending remain distinct.

Ten mounted journey regressions cover the failures plus local precedence, delayed competing handoffs, cache reopening and research/control exclusion. Five originally failed with product behavior mismatches; two existing safeguards passed before repair; three additional recovery boundaries were checked after implementation.

## Acceptance matrix and ordered work

| Order | Outcome required | Evidence / next action |
|---|---|---|
| 1 | Preserve buyer, company, channel and workspace through opening/recovery | New mounted regressions plus existing handoff and isolation tests; verify exact release, then authenticated reopening |
| 2 | Every style uses its approved body and five correct subjects | Existing verbatim, field, category and mounted generation checks; run all styles in the authenticated journey and record failures individually |
| 3 | Explicit click shows blank fields, validated success applies once, failure restores a coherent view | Mounted preparation and recovery regressions; success shown for Professional/Friendly before this repair; other live/failure cases require evidence |
| 4 | Edit, subject edit, Shorten, Create variation, Undo and Reset have clear authority | Existing controller/category/inline tests; verify manual edits across Save/reload with real CRM |
| 5 | Save acknowledges only exact stored text; reopening never replaces newer work | Existing save/flow regressions plus new CRM recovery tests; authenticated CRM round trip is a required customer gate |
| 6 | Translation preserves facts, paragraphs, quantities, names and links | Existing translation/flow tests; require one actual translated save/reopen; model correctness cannot be inferred from mocked responses |
| 7 | Missing evidence, invalid output, timeout, credit failure and sync conflict leave recoverable text and actionable status | Existing failure guards plus mounted tests; build a redacted failure ledger from reproducible cases, without keys or raw account payloads |
| 8 | Email/LinkedIn, buyer switching, saved templates and defaults stay separate | Existing channel/default/library tests plus recipient-safe recovery; verify switching between two buyers and both channels |
| 9 | Flow preparation uses only saved/reviewed text and respects downstream guards | Existing save/flow/default/backend guards; inspect preparation without sending or activating outreach |
| 10 | Simplify the visible workflow after correctness is established | Keep recipient + trigger + style + one editor as the primary journey. Tools/settings remain secondary. No further visual redesign is accepted solely from a screenshot |

Use `npm run check:step6` for the focused acceptance regression set. Full customer CI remains mandatory. Failed assertions are defects, not checklist items to waive. Each additional issue needs reproduction, cause, smallest safe repair, regression and a recorded result. Do not claim the complete step accepted until the real customer gates above are demonstrated.

## Production and customer evidence

The intended repair needs exact-SHA Customer CI, matching live release manifest, backend health, all mandatory smoke checks and a `PROVEN` release proof. Three new recovery/cache-chain smoke checks enforce artifact presence; they do not execute authenticated workflows.

Record production SHA and authenticated observations in the completion report. A passing static release proof must never be substituted for actual message quality, CRM persistence or model-output acceptance. No outreach was authorized by this repair.
