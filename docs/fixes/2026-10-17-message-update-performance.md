# Message Update responsiveness — 17 October 2026

The customer reported slow Update message/style switching and Chrome's Page Unresponsive warning. The supplied screenshots show completed factual text, followed by the browser warning. This is distinct from the earlier missing-fact issue.

## Findings and changes

The editor repeatedly obtains its scope during rendering and readiness checks. Each scope previously recalculated seller evidence, all five subjects and their technical comparisons. The same subject audit also ran separately for each option. With six saved research pages, 11 identical audits parsed 1,067 URLs rather than reusing the first result. Optional meeting-date formatting ran even with no dates entered.

Content-keyed, bounded in-memory caches now reuse subject audits, seller facts, editor scopes, field-preparation requirements and word budgets. Inputs include the actual source content, sender/buyer context and selected style. Editor scopes include the workspace. Changed facts invalidate the cache; returned objects are copied to prevent caller mutations affecting subsequent checks. Date-dependent subject eligibility bypasses the cache when optional meeting dates are supplied; year-dependent field budgets include the year. No source evidence is deleted or altered.

Only one prepared English field set was retained previously. Switching styles could replace it and cause another AI preparation call on return. Each customer draft now retains validated field sets for the four approved styles. Every reuse still validates the exact source fingerprint and six-field schema. Existing single-entry caches remain compatible. No master wording or approval/send rule changes.

The authenticated browser also showed a synchronization conflict whose recovery control remained inert. Explicit recovery previously returned immediately when its in-memory conflict snapshot was absent. It now fetches the current server snapshot before the existing preserve/merge/save flow. A regression test verifies the local answer and recovery copy survive this path.

## Verification

Regression tests cover repeated source scans, changed evidence and workspace isolation, returned-object mutation, optional date formatting, and Update reusing stored prepared fields without an AI generation request. Existing core-template, source-voice, asynchronous race and save/reopen tests remain required.

Run `node scripts/benchmark-message-facts.cjs` to compare against pre-fix commit `c9ca00bbf59fab315645704dc02e511fbdc3ae3c`. The deterministic workload is 20 editor-state checks plus 10 subject audits over six saved research pages. On the development runtime, the first measured median fell from 219.70 ms to 3.17 ms (69.3×). This measures repeated fact-check CPU work only, not an end-to-end browser update or provider latency. Do not present this as a universal 69× or 10× latency guarantee.

Production verification requires exact-SHA CI, manifest, backend health and all configured smoke checks. Authenticated customer acceptance is separate: the visible message must retain populated facts, controls must remain responsive, and workspace synchronization must be healthy. A deployment proof alone does not prove that a customer's open tab has recovered.
