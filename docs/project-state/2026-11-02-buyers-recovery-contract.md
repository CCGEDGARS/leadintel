# Buyers recovery: lessons, decision and acceptance

Recorded at the owner's request on 2 November 2026. This is a working recovery contract, not evidence that the redesign or customer journey has been completed. Existing research-depth, contact-button, quality-supervisor, shared-brief, workspace-isolation and release-integrity policies remain authoritative.

## What must change in the working method

The recurring failure was not a lack of written rules: the 30 September checkpoint already required connected-workflow acceptance. The enforcement failed. Individual defects were reproduced and fixed, but repeatedly shipping those fixes left the authenticated customer journey unverified. The owner supplied the next integration failure through screenshots. Further test totals and release proofs cannot substitute for that missing acceptance evidence.

Start each substantial task with its customer outcome and a testable acceptance plan. On recurrence, reassess the data and execution boundaries before another runtime patch. Track what is observed, what a controlled experiment proves, what remains a hypothesis and what cannot currently be inspected. Never promise that every future task will be error-free or that project notes retrain the underlying model.

Preserve useful existing tests, source validation, consent gates and backend infrastructure. Existing tests include meaningful integration coverage with production SQL and controlled provider responses. The gap is the reported authenticated saved-workspace lifecycle and failure combinations, not an assertion that all earlier tests were superficial.

## Evidence established in this case

- Production runtime logs showed a dossier POST terminated at the 300-second proxy boundary. Splitting bounded provider passes addressed that boundary; it did not establish complete Buyers execution.
- A later regression reproduction showed that an intermediate partial response could replace an older complete browser dossier before the next request failed. Checkpoints now preserve the complete dossier alongside partial attempt receipts. Tests cover workspace normalization, CRM snapshots, successful replacement and mismatched seller context.
- The required per-person plan has nine base queries: official (1), public (1), direct email (2), phone (1), LinkedIn (1) and Gmail (3). Ten retained identities therefore require 90 base queries, plus applicable deeper, independent and Buyer Agent checks. Company/dossier phases are additional. The mandatory person phase has a 180-second budget and concurrency of two. These are plan bounds, not measured production completion times.
- A controlled two-person reproduction read the official company page and executed 22 queries. Returning the same unreadable YouTube URL ahead of a valid source left every non-LinkedIn check partial and produced 0/2 fully researched. The run continued and stopped as checks_incomplete. This disproves the earlier simplified claim that the video failure necessarily stopped the whole batch.
- Some buyer-action tests stub bridge.saveNow as successful. Sync conflicts have separate coverage. Passing those tests separately does not prove the combined authenticated workflow with delayed providers and competing saved revisions.
- The customer's latest screenshot shows four priority cards, one accepted email, 0/10 fully researched and a workspace synchronization conflict. The exact conflicting fields, browser/server revisions and complete run trace were not obtained. A specific cause of that customer's conflict remains unproven.

## Architectural direction to validate

Use the existing D1 checkpoint and leased-workflow foundations to establish one durable Buyers execution path for manual and automatic callers. Avoid adding another platform simply to bypass an ownership problem.

1. The browser starts or resumes a scoped job and reads progress. Persist phase/task progress on the backend; reloads must not own the job's lifetime. Separate per-request timeouts, task deadlines, retry budgets and terminal job outcomes.
2. Define authoritative server records for buyer identity, immutable source evidence, accepted channels and recipient selection. Apply record-specific updates with revision checks. Research receipts must not compete with unrelated user edits in a broad workspace snapshot. Keep deliberate identity and same-record edit conflicts reviewable.
3. Separate search receipts, source-extraction receipts and validated findings. Prioritize relevant official named pages. A failed read must not skip other useful returned sources or be replayed across unrelated checks. An unread relevant source remains an explicit gap; unsupported optional media must not impersonate a completed mandatory check.
4. Provide one readiness decision consumed by the cards, paid-action gates, manual handoff and automatic workflow. Keep identity, opportunity qualification, email acceptance, research coverage, AI review and persistence distinct. Preserve the owner's stricter automatic requirements and independent paid-channel approvals.
5. Retain bounded diagnostics: job/task IDs, phase, attempt, duration, outcome, source URL, record revision and conflict path. Exclude credentials and private source bodies from diagnostic reports. Give errors a stable task and recovery action instead of relying on a generic caption.

This is a direction, not a proven guarantee. Establish ownership and API contracts and prove the smallest complete path before expanding the migration.

## Execution sequence

1. Preserve existing saved work. Establish a controlled authenticated test workspace and production-equivalent persistence. Obtain a safe reproduction of the reported conflict or explicitly retain that evidence gap.
2. Build the journey reproduction with current behavior before changing the architecture. Combine real persistence with controlled delayed/failed providers; verify that the test fails for the intended reason.
3. Implement one complete company-to-buyer-to-Messages path using the durable execution and record contracts. Retain the proven source-attribution and policy functions. Define backward compatibility and rollback before migrating saved data.
4. Run controlled failure scenarios first. Use source fixtures for repeated development rather than repeatedly purchasing research. Perform a bounded real-provider acceptance run under existing permissions, retaining actual outcome and cost evidence. Unknown costs remain unknown.
5. Expand to other companies/industries after the first path passes. Obtain exact-release production proof separately, then verify the authenticated acceptance result before closing the user outcome.

## Initial acceptance record (before implementation)

| Scenario | Required evidence |
| --- | --- |
| Official named contact | Read provenance supports the exact person, company, email and any attributed phone; patterns remain unconfirmed. |
| Provider/source failure | Other useful tasks continue; failed tasks retain receipts; completed work survives bounded retry without duplicate paid dispatch. |
| Reload or close/reopen | The saved job has an honest persisted state and resumes missing work; completed evidence remains available. |
| Concurrent tabs/revisions | Unrelated edits survive; a real same-record conflict identifies its affected record/fields and preserves both versions. |
| Buyers to Messages to CRM reopen | The exact accepted person/address and shared source-backed brief survive selection, save and reload; no message is sent. |
| Workspace/identity replacement | Late work cannot write into another workspace, company or replacement person. |
| Customer portability | The same path works with another company and industry without runtime fixture-specific routing. |
| Research quality | Report actual qualified-buyer count, accepted priority-email count, coverage and AI review. Four qualified priority buyers and two accepted priority work emails remain the quality target; unavailable evidence cannot be invented to satisfy it. |
| Release | Same-SHA CI, manifest, backend health and configured smoke checks produce a PROVEN release proof, separately from the customer outcome. |

No runtime architecture change, real customer conflict resolution, new contact import, paid lookup or outreach is performed by recording this contract.

## Implementation follow-up

See `2026-11-02-step5-durable-research-plan.md` for the implemented boundary, controlled authenticated browser/SQL acceptance, industry and failure scenarios, remaining live-customer evidence gap, and release verification. The initial OPEN table above records the starting point; it is not the current implementation status. The change does not claim that every architectural direction above has been fully migrated.
