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

## Authenticated acceptance pass and second repair

The signed-in customer journey on the first repair (main `5c3fb13d03466fcafd5894cde65c0543f1f19b4f`) reproduced two additional defects:

- A saved Professional subject category survived switching to NLP. Update selected was disabled and Update all five failed with `Unknown subject choice`. The subject editor now resolves the category from the displayed subject, confines stored IDs to ready choices in the current style, and gives a pending category authority only during active manual editing. Two mounted regressions failed before the repair and pass afterward.
- AI Generated rejected a link while preserving the previous working draft. A deterministic test reproduced the validation gap using the same evidence-qualified official project URL accepted by protected templates: generation/parse allowed only explicit Profile proof URLs. Both now share a bounded list containing that verified reference. Unrelated domains, failed/unextracted pages, weak evidence and instruction injection remain rejected. The exact rejected live model URL was not observed and is not asserted here.

Five additional mandatory smoke checks cover these contracts and their browser cache chains. Approved master literals are untouched.

### Redacted customer evidence

| Check | Observed result on the first repair |
|---|---|
| Professional, NLP, Friendly, Brutal Honesty | All four generated complete bodies and five ready subjects; NLP 193 words/13 paragraphs, Friendly 179/11, Brutal 191/12 |
| Manual subject Save/reload | Edited subject and its category persisted; email body unchanged |
| Manual body Save/reload | Exact edited working body persisted in CRM |
| Shorten and Create variation | Distinct working text, retained meeting and links; Reset restored the exact first Friendly body |
| Latvian translation | Two-stage generation/editorial review completed; 11 paragraphs, protected names/numbers/links retained; exact translated Save/reload and English-source recovery passed |
| Rejected AI generation | Prior body, style and five-subject catalog restored together |
| Second buyer / LinkedIn | Existing confirmed profile reached review; a long delay preceded successful opening. Separate LinkedIn draft Save/reload passed; returning to the first buyer restored the exact saved English email. Handoff latency remains an observation, not a diagnosed failure |
| Templates/defaults/flow | Regression coverage available; authenticated preparation still requires evidence; no outreach activation or sending performed |

Local validation after the second repair: `npm run check:step6` 339/339; full customer suite 2367/2367; production build and diff check passed. Exact release proof and authenticated retries must be recorded separately after publication. Browser outage, account-credit exhaustion and sync-conflict injection are automated failure coverage, not claimed live outages.

### Exact wording approval hold

The protected Brutal Honesty original contains `A research brought me to`. Proposed replacement: `My research brought me to`. Repository AGENTS requires explicit approval for changes to approved wording; broad engineering authority is not approval of this exact literal. No master edit was made.

## Recovery snapshot quota repair

Release `8caac4849c48be8d05bf861ed63a8ef3438f7f51` has exact-SHA Customer CI, Backend CI/Deploy, matching production manifest, health and 119/119 smoke checks; GitHub Release Integrity proof verdict `PROVEN`. Authenticated final retries exposed a separate reload failure: `QuotaExceededError` writing `leadintel_customer_v2_workspace_saved_snapshot_v1`, making the account verification gate show workspace recovery. Retrying did not cure it. Saved CRM round trips had passed before this reload.

The snapshot duplicated decoded local records and acknowledged server payload without using the existing lossless compression codec. Compress both cloud and browser-only recovery snapshots, read legacy plain snapshots, memoize decoding for repeated status checks, and keep all quota/decode errors fail-closed. Exact snapshot restoration clears its transient dirty flag. No active customer record or archive is deleted. Unrelated uncommitted account-archive/IndexedDB work in the original checkout remains untouched.

Three quota regressions failed before repair; they cover two seller industries and local-only unsynced text, exact cloud merge bases, reload and subsequent edits. This repair needs full CI/build, a new exact release proof, then authenticated workspace loading and both subject/generation retries. Templates remain visibly channel-specific, defaults unchanged, and Add to flow is disabled for saved but unapproved text. Successful flow activation/sending is outside this acceptance run.

## Full-quota durable backup boundary

Compression release `429e8f4fe58c73f981f17cefed78e20a03e6398e` passed exact CI, manifest, health and 123 smoke checks, but the authenticated reload still raised the same quota error. It is not accepted as resolving the full customer failure.

Integrate the existing account archive/IndexedDB work into this isolated branch, leaving its original checkout untouched. Account transitions now await committed backups before detaching local state. Same-account startup also migrates legacy duplicate archives after commit. When even compressed recovery snapshots cannot fit, preserve the full snapshot in IndexedDB and replace only the snapshot value with a small workspace-scoped pointer. Startup awaits and validates that snapshot before hydration. Snapshots use distinct keys, and late older acknowledgements cannot replace a newer baseline. Backup abort/failure keeps existing records and the recovery gate closed; edits during asynchronous storage remain unsaved. No customer business record is removed. Existing archives retain their recovery references.

New mounted regressions reproduce same-account legacy quota accumulation and completely full active storage; they verify exact cloud baseline, fresh reopening, subsequent edits and failed commits. The integrated archive tests additionally cover native Storage, transaction abort, account change during backup, HTTP 401, sign-out, provider/workspace switching and no cross-account leakage. Full validation and authenticated retry are mandatory before claiming recovery succeeded.
