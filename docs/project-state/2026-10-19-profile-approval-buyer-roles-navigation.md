# Profile approval, buyer-role crash and navigation-triggered research — 19 October 2026

Observed (authenticated CCGROUP-style workspace, live `e7f5aa19`):

1. After accepting every AI draft in the Commercial message group, `Approve profile` failed with "Review and confirm the required Profile answers." on every attempt, including after a clean reload. `answerStatus` for Q07–Q12 stayed `draft` while the research review showed "6/6 reviewed".
2. `Find decision-makers` threw `TypeError: ((intermediate value) || candidate.buyerRoles).join is not a function`, left `peopleStatus: "loading"` persisted, and after reload the card showed a phantom "Researching decision-makers… 1/5" with no provider call; the stage guard then blocked buyer research for every other company.
3. Company research started from clicks on the stage-2 stepper circle and the sidebar "Show Profile steps" expander (`[data-step-marker="2"]`, `[data-process-step="2"]`), spending Firecrawl and AI calls without an explicit research action.

Root causes:

1. `customer/company-research-ui.js` `handleReviewAction` wrote only `meta.fields[id].reviewed`; `step2-brief-schema.js` `confirmationMissing()` and `page-quality-ui.js` read `answerStatus`.
2. `candidate.buyerRoles` is a `"; "`-joined string by design (`buyerRolesForTarget`, committee input handler) while `buyerDiscovery.opportunityRoles` is an array; three consumers called `.join` on whichever was present. The throw happened inside `persist()` right after `peopleStatus="loading"` was saved, outside the research `try`, and `loadDiscovery` only reset `publicContactStatus`.
3. `prepareProfileAnswers` matched navigation elements, not only `#to-questionnaire`.

Changes:

- Accept now also sets `answerStatus[id]='accepted'` (never for empty drafts, never downgrading `user`) and dispatches `leadintel:company-research-updated` so the app reloads state.
- `roleList()` / `candidateBuyerRoles()` normalise both shapes; the committee input, `buyerRoleCoverage`, `buyerQualificationHtml` and the error-path `opportunityRoles` use them. A persisted `peopleStatus: "loading"` is reset on load (`complete` when people exist, else `idle`), and a failure while persisting the loading state marks the search `error` instead of stranding it.
- Only `#to-questionnaire` starts initial company research.

Verification: `node --test customer/test/*.test.js` 2934/2934 (new: `research-accept-answer-status`, `buyer-roles-type-safety`, `company-research-navigation-guard`); backend suite unchanged 674/674. Live re-test to follow the deployment of this commit.

Prevention: any new consumer of buyer roles goes through `candidateBuyerRoles`; any new "start research" trigger must be an explicit button, never a navigation element; a status that is persisted as running must have a load-time recovery.
