# Checked company list and automatic company flow

## User requirement, 19 October 2026

The requested company amount is a ranked list of checked companies with different scores. A score below 80 does not remove a completed company from that list. The company-stage automatic-flow gate is company fit >= 80/100. Buyer identity, confirmed work email, reviewed messages, suppression, workspace scope and workflow approval remain required by their existing stages. No outreach activation or sending is authorized by this change.

## Root cause

Manual discovery used companyGaps containing both research/evidence failures and the 80/100 automatic threshold plus the 50/70 buyer-fit subscore. Thus checked 79/100 and 65/100 companies disappeared into Research review. Signals/Lookalike routing also became a hard manual-list gate. Server automatic flow separately used the 70+30 opportunity score, requiring a recent event even when company fit exceeded 80. These mixed two decisions: research completion/list membership and automatic advancement.

## Contract

- Completed official-source commercial assessment, current website verification, identity, market, two independent source families, exclusions, seller/reference exclusion and CRM lifecycle checks define a checked company.
- Checked companies stay ranked by company fit, including scores below 80, with a Manual review label. They remain selectable for Buyers and save/reload normally. Missing research stays in Research review. No score is invented to fill a count.
- Automatic company flow requires those same checks plus company fit >=80. A recent buying event is optional context rather than a prerequisite. The old opportunity assessment remains available for buying-signal analytics and does not determine manual-list membership.
- Requested amount caps the visible ranked list; other research and existing Buyers selections remain preserved.
- Previously checked low-score review rows are reassessed against the current profile and restored to the ranked list without provider calls. Stale verification and changed strategies cannot be promoted.
- Qualification contract version 4 invalidates old company/downstream automatic approvals. Existing automatic runs cannot silently acquire the changed rules.

A separate extraction defect joined a repeated company title and body name across a newline, inventing names such as Nordic Machines Nordic Machines. Fields are now extracted independently; regression demonstrates the original failure.

## Verification

Meaningful tests cover a five-company ranked list with scores94,82,79,68,55; exact80/79 automatic boundaries; retained lower scores through rendering/storage/reload; source/lifecycle/freshness failures; paid-call-free recovery of saved checked research; server CRM admission only at80+; and approval invalidation. Full suites, exact release proof and actual authenticated five-company acceptance are separate required gates and must be recorded before claiming completion.

Independent review found and verified fixes for unattended execution accepting old contract hashes (both default and saved flows now require all current stage approvals), and promotion removing overflow beyond the 50-company cap (only retained domains leave review). Generic sourced-fit messages can cite a currently verified official URL without a publication date; event-dependent core templates retain their separate event gate. Fresh/stale source and execution-level regressions demonstrate these boundaries without sending.

## Prevention lesson

Agree on the product outcome before debugging implementation details. List membership, score ranking, automatic company advancement and confirmed contact readiness are separate decisions. One successful company and green technical checks do not establish the requested company-count outcome.
