# Buyer decision priority and research recommendation gate

## Root causes
The prior model gives all director/chef titles maximum inferred authority, making project delivery leads indistinguishable from purchasing department heads when their other evidence is equal. Recommendations depend on identity/role fit but omit per-person contact research completion. A company-level completed public check also skips individual buyers that have never been searched. Rendering truncates people before ranking, so a later leadership candidate cannot enter the visible shortlist.

## Changes
Model v3 retains the 25 role / 25 authority / 15 identity / 15 employer / 10 source / 10 freshness contract. Relevant department heads and purchasing leadership receive 25 inferred authority points; other directors get 22 and project delivery leadership gets 20, deputies 16, managers 12 and support roles 4. Actual budget, purchase decision and responsibility for the specific opportunity remain explicitly unconfirmed. Purchasing, project delivery, technical and operational decision roles are visible outside the score disclosure. Legacy v1/v2 scores remain readable.

Only buyers with a dated, completed public contact research attempt within 30 days, positive search count and zero failed searches can be highlighted. Known stale/future identity evidence also requires review. Failed, missing and old research remains visible as potential buyers with a reason. Contact availability and verified company-email readiness remain separate; successful searches can find no email, and verified emails cannot override identity/scope restrictions. Equal evidence may still produce equal scores and is explained without fabricated distinctions.

Rank all saved identities before the ten-card cap. Reserve buying-function coverage independently from contact readiness so unresearched project titles cannot crowd out engineering or purchasing. Company-level completion cannot conceal never-searched individuals; schedule one bounded public follow-up, retaining existing no-repeat and failed-provider controls. Partial phone searches are labelled incomplete, and contact values are displayed once rather than repeated under the information rows.

## Prevention and validation
Meaningful regressions cover cross-industry authority ordering, unknown purchasing authority, unresearched/partial/zero-query/stale/future recommendation exclusion, larger-pool coverage, late-card ranking, per-person automatic follow-up, and normalization/CRM persistence. Verify the exact merged release separately, then inspect authenticated LKAB scores, research state, CRM save and reload. No paid Apollo contact enrichment, Hunter or outreach is authorized by this repair.

Authenticated validation exposed an additional ordering error: automatic checks could reserve their once-per-visit marker while Companies was open, then the timer was canceled by stage visibility. Restrict scheduling to the active Buyers stage so its later visit still starts the missing research. The runtime regression now opens Companies first, proves no request/marker consumption, then opens Buyers and proves one completed follow-up.

The fresh LKAB run exposed Chief Procurement Officer as a partial director match. Functional chief/officer aliases now match the same requested director function across industries. Purchasing leadership keeps 25 inferred authority points versus project delivery leadership 20, so direct purchase responsibility has material weight beyond the four-point official/profile source-quality difference. Public contact matching no longer replaces an existing role identity source with a name/email-only page; role-supporting identity pages carry their actual publication date. Contact evidence URLs stay separate, and known stale dates remain review gates.

Final dated-source recheck found historical role evidence for Tomas, Thomas, Björn and Mari. Known stale/future identity evidence now invalidates qualification and the Messages email gate, so an accepted email cannot rescue an outdated role. Recommended buyers are sorted by total priority after reserving function coverage. Historical contacts/evidence remain saved for review. These observed handoff and ordering failures have meaningful regression coverage.

Blocked controls now display the actual qualification hold beside Save & proceed and in its tooltip, rather than asking for another email confirmation when employment evidence is the blocker. A runtime card regression verifies the visible stale-role reason and disabled handoff.


## Saved research recovery after the 22:40 customer screenshot

The customer still saw the old 14-candidate/four-name record, with no individual contact attempts. Deployment freshness does not establish workspace data freshness. Two startup paths could preserve that state: automatic public checks consumed their per-visit slot before the authenticated workspace was ready, and CRM refresh read durable contacts but never restored a newer durable buyer research snapshot.

Buyers now waits for authentication and CRM refresh. It restores a strictly newer same-company research snapshot, retains local kept/flow/LinkedIn/source confirmations for matching identities, recalculates qualification, and saves the recovered workflow state. It never replaces an active research run or uses a future-dated, older, or other-company snapshot. Missing individual attempts can recover from a legacy error; actual attempted failures remain bounded. Existing incomplete-research and stale-role holds remain visible. CRM snapshot v2 carries the buyer fields and provider diagnostics needed for faithful reopening; v1 snapshots remain readable. No paid contact enrichment or outreach is enabled.

Regression coverage exercises delayed authentication, one bounded follow-up, same-company snapshot recovery, evidence/confirmation retention, and rejection of older, other-company or active-run replacement. Production proof and authenticated reload evidence must be recorded separately before completion.

Authenticated reload also exposed a navigation gap: discovery initialization always reopened Companies, overwriting the saved Buyers focus before scheduling checks. Startup now restores the persisted Companies/Buyers focus.
