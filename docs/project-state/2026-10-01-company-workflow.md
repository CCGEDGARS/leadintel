# Company workflow — 1 October 2026

## Approved workflow

Step 2 contains optional Reference Companies (examples used for similarity only while Lookalike ICP is active) and Target Companies (specific known prospects, independent of Lookalike). Manual input and reviewed CSV/Excel/text-PDF import belong here. Adding a target does not qualify it or add it to Pipeline.

Step 4 alone owns company search and quantity. Find more searches for additional companies and merges canonical domains. Recheck existing researches the known shortlist, with a maximum of 30 company checks per run. Search never silently redirects to Strategy. Strategy review and company-input management are separate controls. Previous search scope, amount, timestamp and changed settings are visible; diagnostic counts are collapsed.

Known targets and found companies show their origins. Fit, evidence gaps and confirmed buying signals remain distinct. Select companies, then Continue to Buyers. CRM record saving and Pipeline entry are separate. Selected companies remain eligible for Buyers and Scripts without Pipeline entry.

## Root causes addressed

- Two company-search surfaces implied competing lists and quantities: removed search controls from Step 2.
- Search button redirected to Strategy on some zero-result states: search and review now have distinct actions.
- Earlier bounded Saving Mode results looked like current normal-search results: legacy run context is identified and normal searches use current settings.
- New research could replace the visible shortlist and discard reviewed prospects on interrupted reload: preserve prior results and checked domains during and after a run, merge by canonical domain, retain buyers.
- Existing CRM records were incorrectly labelled as selected and disabled selection: distinguish CRM existence from explicit Buyers selection.
- Qualified selections were normalized as unconfirmed prospects: retain qualification, buyer roles and contact research on reload.
- Pipeline-only readers blocked the optional Pipeline path in progress, Buyers continuation and Scripts: include explicit selections in each downstream reader.
- Concurrent imports could publish an older file preview: generation guard and workspace/seller checks reject stale completions. Imports require review before mutation; failed sync exposes retry and retains local targets.
- Parent loaders could serve old UI/CSS after changing child files: invalidate the complete owning import chain.

## Validation boundaries

The customer suite passed 1,307 tests before publication, including new runtime regression tests for merge/preservation, paused Lookalike, selected-company normalization, reviewed import, failed synchronization, stale import and Pipeline-independent continuation.

Production requires the repository exact-SHA CI/manifest/health/smoke proof. This document does not assert production release success. Browser verification uses a separate local-only Ercon/Sweden review workspace; it is not the customer's authenticated workspace and must not be reported as authenticated customer acceptance.

## Deferred to final update by the customer

Complete remaining reference evidence gaps (including manufacturing evidence for AMAZONE/Dinolift and supported commercial connection to Ercon), plus the other outstanding final-pass items. Preserve current references and activation; do not force another complete analysis or restart the customer's data to proceed with structure.
