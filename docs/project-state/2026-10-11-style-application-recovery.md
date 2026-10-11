# Writing-style application recovery — 11 October 2026

## Reproduced causes

The assembled customer page selected a different core style and began asynchronous factual-field preparation. `writing-references-loader.js` dispatches `leadintel:writing-references-changed` on its first response as well as revisions. The outreach listener incremented the shared generation request counter for every style, cleared busy state, and rendered the studio. The valid in-flight core preparation was therefore rejected as stale, even though core templates do not consume writing-reference guidance. The existing body stayed unchanged.

Separately, studio rendering replaced a preparation error with the previous draft's status or the generic ready text. Completion of background subject research called automatic preparation again. For a saved/manual draft that automatic path proposes a template update instead of applying the explicitly selected style. This hid the failed explicit operation behind further activity while retaining the old body.

## Fix and boundaries

Reference revisions invalidate only AI Original generation for the active channel and workspace. Core preparation retains its request ownership across unrelated reference hydration and refresh. All existing workspace, recipient, source, style and working-draft freshness checks remain required.

Controlled preparation status survives background renders. Failed generation prevents automatic template preparation until the user explicitly retries; successful application clears the error. A result rejected because facts or the working draft changed explains that Update message must be retried. Moving to another recipient/channel/workspace clears the previous controlled preparation status.

Explicit core application retains the replaced subject/body in persistent Undo, requires Save, and preserves the protected master and first tailored original. This change neither saves messages automatically nor approves, sends, or activates flows.

## Verification

Full-page jsdom regressions exercise real handlers, preparation, renderers, browser-storage reopening, and CRM snapshot serialization. Before the fix the tests reproduced reference hydration cancelling all four core styles, render erasure of provider failures, background research starting a hidden automatic retry, and silent changed-source rejection. Additional coverage keeps AI Original reference invalidation, rapid selection/research cancellation, manual text protection and explicit retry behavior.

Local build, complete customer suite, exact-SHA release proof, and authenticated customer checks are separate gates. Record their actual results in the task response; neither a static smoke marker nor successful compilation is customer acceptance.
