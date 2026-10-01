# Step 2 downstream context repair

## Root cause
The editable commercial answers and generated profile were separate copies. Input saved answers without synchronizing the profile used by market research, buyer lookup and scripts. Targeting confirmation updated only four fields. Standard script templates did not consume approved proof or stated objections.

## Result
- All ten edited answers synchronize the corresponding profile fields and existing canonical field records. Explicit clearing is supported.
- Profile and strategy approval are revoked after an edit. Core ICP descriptions, offers, buyer roles and exclusions update without overwriting custom segments.
- User-entered buying outcomes are marked user confirmed so Company Brain hydration does not replace them with inferred pain points.
- Trigger edits regenerate signal recommendations. Discovery fingerprints include all answers; previous results and CRM/pipeline records remain available for review and rechecking.
- Existing script packages lose approval and cannot be reapproved until regenerated. The same-tab workflow reloads the changed package state. The recipient-send path reads approved packages from storage.
- Standard email drafts consume the value proposition, differentiation and proof; objection replies ask about supplied concerns conditionally rather than asserting a prospect has them. Commercial context persists through script normalization and CRM snapshots.

## Answer use
| Input | Downstream purpose |
|---|---|
| Priority offers | Core ICP, company queries, matching, campaign offer |
| Ideal customer | Core ICP, company queries and fit scoring |
| Buyer roles | Core ICP roles and buyer searches |
| Exclusions | Query verification context and candidate qualification |
| Buying outcomes | Pain context for search and dossier hypotheses |
| Buying triggers | Signal recommendations and event research |
| Value proposition | Campaign and email context |
| Differentiation | Dossier hypothesis and email positioning |
| Proof | Seller credibility in email, retained script context |
| Objections | Conditional clarification response |

## Exclusion verification scope
Exclusions support exact prohibited domains and textual negative-fit evidence. ISO requirements use explicit certification evidence. Euro-denominated minimum project/contract/deal values use contextual project-value evidence; annual company revenue cannot substitute for project value. Unknown hard requirements remain qualification gaps and appear in the review shortlist, not automatically qualified company results. Verification queries include exclusion context. This is a conservative deterministic check, not a semantic verifier for arbitrary multilingual restrictions. Complex logistics, capacity, geography and certification rules can require additional evidence or human review. No unsupported compliance pass is invented.

## Verification
Regression coverage includes all-answer propagation, clearing and reload, Company Brain hydration, core ICP synchronization, cross-industry/name invariance, stale approval blocking, same-tab persistence, preservation of company/pipeline records, credential/value evidence and retained CRM script context. Run the full customer suite and static build on the final revision. Production and authenticated customer acceptance require separate exact-SHA evidence.

## Continuing control
Any new questionnaire field must declare its profile mapping, downstream consumer and invalidation behavior. Do not add UI questions that only save text without affecting a relevant decision or output.
