# Qualification preparation blocked the workspace UI

The authenticated startup trace hydrated the workspace by 4.2 seconds, mounted
the app by 4.6 seconds, and completed verified UI dispatch at 27.1 seconds.
Navigation and save feedback also refresh the journey/Companies presentation.

`qualificationAssessment` reparsed the entire saved main state and rebuilt the
same seller/reference context for every company and every repeated card/status
assessment. `getActiveModels` additionally called the editing helper
`ensurePortfolio`, which deep-cloned the entire workspace, including unrelated
scraped pages, even when there were no active reference lists. This synchronous
work blocks clicks and delays timers and save feedback on the browser thread.

The read now normalizes only the saved reference portfolio. Qualification
preparation reuses one context while serialized state, workspace/user scope and
dependency functions remain identical. Saved edits, switches and lazy-loaded
reference providers invalidate it. Candidate assessments are **not** cached:
evidence freshness, rules and CRM lifecycle gates execute on every call.

Regression coverage forbids reads of unrelated workspace sections, verifies
independent returned models, immediate reference deactivation, one preparation
for 200 assessments, and invalidation on edits/scope/provider changes. A local
8.4 MB synthetic workspace benchmark reduced 200 empty-portfolio reads from
4,222 ms to 0.52 ms. This isolates the copying cost; it is not an end-to-end
customer timing claim. Live opening/navigation/save acceptance remains a
separate release check.

No saved workspace data, scoring policy or research evidence is removed.

## Follow-up from authenticated acceptance

The first release still spent 21.3 seconds between app mount and verified UI
completion. Context preparation alone was insufficient. Repeated presentation
assessments also need deduplication: Companies status, candidate cards, review
rows and journey progress ask for the same assessment in one synchronous update.
A bounded presentation-only map now shares results within the current event-loop
turn, then clears them. Candidate content, current rules, CRM lifecycle and
context changes invalidate entries. Action calls remain fresh, and returned
presentation values are detached from cached results. Optional startup tracing
reports restore/context boundaries and Companies render duration so acceptance
can distinguish scoring from persistence costs.
