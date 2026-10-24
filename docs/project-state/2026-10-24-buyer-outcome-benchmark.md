# Buyer outcome benchmark — 24 October 2026

## Acceptance scope

Step 5 remains the commercial priority. Completed source checks, an AI review, a passing build and successful synthetic tests are separate from obtaining usable buyer recipients. This change does not establish live customer email yield, mailbox availability, delivery, paid execution, or production deployment.

`customer/buyer-outcome-benchmark.js` is a read-only projection of existing retained research and saved contact records. It uses the shared discovery ranking/quality assessment and `contact-confirmation-policy.js`; it does not create an alternative qualification system or authorize research, credits, automatic recipient selection or sending.

## API and compact integration

Load the new script after `discovery-engine.js` and `contact-confirmation-policy.js`. Browser API is `LeadIntelBuyerOutcomes.evaluate(candidate, options)`; Node exports the same `evaluate` function.

```js
const report = LeadIntelBuyerOutcomes.evaluate(candidate, {
  ranked,
  confirmationLevel: acceptedBuyerConfirmationLevel(),
  contactForPerson: person =>
    enrichmentResults.get(personKey(candidate, person))?.contact || {}
});
```

Pass the already computed `ranked` result when rendering the existing Buyers quality summary. Do not start provider calls to generate a report. A missing saved contact is an unknown usable-recipient outcome, even if a public source-confirmation receipt exists. `now` accepts a timestamp or ISO date for evidence/contact freshness evaluation; priority ranking follows the shared runtime ranking implementation.

Useful compact fields:

| Field | Meaning |
| --- | --- |
| `status` | Research not started, needs attention, or existing requirements met |
| `outcomes.usablePriorityEmails` / `emailTarget` | Priority buyer records with a contact accepted at the active confirmation level / existing target of two |
| `outcomes.uniquePriorityEmailAddresses` | Distinct accepted priority addresses; avoids describing two records sharing one address as two addresses |
| `outcomes.sourceConfirmedPriorityEmails` | Fresh official-source confirmations, separate from active recipient acceptance |
| `outcomes.priorityBuyers` / `priorityTarget` | Relevant ranked committee / existing target of four |
| `outcomes.usableOtherEmails` | Previously returned accepted contacts outside the priority four |
| `coverage.researchPassed` | Existing mandatory research coverage predicate |
| `coverage.mandatoryPeopleChecked` | People with current fresh individual mandatory checks; does not imply aggregate or deep-wave acceptance |
| `coverage.supervisorStatus` | Existing AI signature, freshness and person-coverage assessment |
| `coverage.tools` | Retained actual attempted/succeeded/failed/skipped/result counters |
| `execution.publicResearchElapsedMs` | Only the valid saved public-research start/completion interval, otherwise null |
| `execution.recordedPaidCostMicro` | Sum of available bound `contactData` receipts, otherwise null |
| `blockers` | Existing unmet requirements, with next actions |

The public-source count does not claim mailbox verification. Provider verification uses the existing Apollo/Hunter/Treg acceptance rule. Gmail possible matches, name patterns, generic/shared inboxes rejected by the policy, wrong-domain addresses, provider-listed phones, conflicting identities, and contact records bound to another person cannot become accepted work-email outcomes. Existing per-buyer manual eligibility and separate paid consents remain unchanged.

Time and cost are deliberately scoped: receipt cost is USD in micro-units and excludes public research, AI, other provider charges and subscriptions. `totalCostKnown` remains false. Cost requires a safe positive integer and nonempty retained call IDs: zero/default cost and missing IDs remain unknown. Exact duplicate receipt groups count once. Partially overlapping or conflicting aggregate receipt groups remain unknown because their per-call charges cannot be allocated. No provider is credited with execution merely because it is configured. Distinct call IDs are reported only from retained structured receipts bound to the current company/person/identity; free-text provider messages are not parsed into invented spend totals.

## Reproduced defect and fix

Both mandatory execution and coverage acceptance previously treated the first four retained full names as the deep-wave priority. Retained roster order can differ from the ranked committee. An eight-person fixture with four project managers first and the actual leadership/procurement/engineering committee last reproduced three failures:

1. Missing deep research for a true priority buyer passed aggregate coverage.
2. Missing deep research for a nonpriority person incorrectly failed completed priority coverage.
3. Execution spent all four deep-wave places on nonpriority people.

`mandatoryBuyerResearchPriorities` now shares the existing ranked selection between execution and coverage and maps the selected IDs back to the original person objects. Execution fills unused escalation places from relevant retained full identities when a supported committee is not yet available, so research can acquire the evidence needed for qualification. This fallback does not establish final buyer eligibility: coverage still checks actual ranked priority targets and quality still requires the qualified committee. Unresolved/legacy fallback remains the existing `topFourResearchCandidates` behavior. All retained identities still require mandatory checks; this only corrects which four receive the deeper escalation. No thresholds or paid gates changed.

## Verification and limitations

The benchmark uses the existing independent factory/retail/legal role matrix and the separately retained Wernedal official contact fixture. It covers successful research with zero usable emails, active confirmation levels, wrong-person/company/domain contacts, stale and partial receipts, conflicts, stale/partial supervision, previous contacts outside the four, exact-domain policy rejection, unknown time/cost, actual zero-result tool receipts, save/reload/CRM preservation, roster-order invariance and real mandatory-run deep selection.

- Initial focused run: 59 passed.
- Final buyer regression run: 383 passed, zero failed.
- Final benchmark after two extra preservation/distinct-address cases: 16 passed, zero failed.
- Follow-up correction reproduced an unsupported public executive pool receiving zero escalations, then restored four research places without manufacturing a qualified committee. The previously failing automatic-backend case passed. Focused customer verification, including three new public-pool/cost regressions: 45 passed. The benchmark now contains 19 cases. No full-suite rerun was performed for this correction.
- Commands: `node --test customer/test/buyer-outcome-benchmark.test.js`; broader buyer selection includes `customer/test/buyer*.test.js`, contact-confirmation policy, ranked shortlist, company/buyer stage contract, employer evidence and qualified handoff gates.

These are deterministic fixture and implementation checks. An authenticated current customer result must be inspected separately and must retain its actual identities, exact accepted work addresses, gaps, execution receipts and evidence timestamps. No live customer mutation, paid request, browser research, commit or push was performed for this work. Root owns full-suite/build checks and any exact-SHA release proof.
