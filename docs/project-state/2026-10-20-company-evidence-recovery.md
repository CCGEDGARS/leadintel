# Companies evidence and results correction — 20 October 2026

## Acceptance contract

Company discovery and qualification is the primary workflow priority. The requested count is a target for genuinely researched, relevant companies. Positive researched scores may differ; automatic company qualification remains 80+. Do not manufacture scores, buyer relevance, evidence or counts to fill a list. Incomplete research remains reviewable outside the qualified results.

The Companies page orders search controls, up to the requested number of ranked qualified company cards, Review next N companies, collapsed other companies, optional event context, and Continue to Buyers. Supporting research opens on click. Existing buyer selections and CRM records survive rechecks and list rotation.

## Root cause

Page normalization previously flattened and truncated the raw prefix before selecting operating evidence, and purchasing assessment used the first 2,500 characters. Long menus and consent text could displace real content further down the page. Exact-quote validation rejected financial disclaimers but accepted cookie text. Manual qualification equated completion with positive buyer relevance, so an exact-quoted zero assessment could appear as a checked top result. Some assessment requests also exceeded their bounded provider deadline.

The event form shared the container used to redraw the last-run status; later renders could replace the form itself.

## Changes and prevention

- Select substantive prose from the complete supplied page before truncation, across industries. Exclude cookie/consent and navigation while preserving short dated announcements and actual food businesses that manufacture cookies. Preserve source URLs and validate quotes against their exact original source and selected content.
- Require usable official operating evidence for purchasing assessment. Explicit insufficient evidence stays unscored. Evidenced zero-fit and non-buyer relationships cannot enter the relevant shortlist. Preserve lower positive manual scores and the fixed 80+ automatic gate.
- When home content is unusable, recover using first-party internal URLs actually returned by search. Do not invent paths, repeat a blocked homepage, retry billing/auth failures, or exceed the existing call budget. A terminal per-page billing/auth error stops remaining seeds immediately and preserves its status; prior successful pages remain available. Cancellation and workspace guards remain in place.
- Request the already-supported low reasoning setting for bounded company tasks; preserve configured providers, fallbacks and exact evidence.
- Keep result cards compact, research details collapsed, review-next below results and other companies collapsed. Put last-run diagnostics in Search options and give the optional bottom event form its own stable container.
- Prevent zero/incomplete/stale company records from marking company research/review complete in journey progress.

## Verification

Regression coverage includes long navigation prefixes in manufacturing and healthcare, cookie-only exact quotes, zero and non-buyer exclusion, discovered-page recovery, UI order, preserved next-batch ranking/selections, provider deadline settings and progress state. Full customer/backend suites and the production build must pass on the final revision. Backend SQLite fixtures run in UTC, matching CI; the host's America/Los_Angeles timezone otherwise makes fresh SQLite UTC timestamps appear to be in the future.

Production verification must use the repository's exact-SHA release proof. Automated tests and release proof alone do not establish the customer's actual five-company result; run and inspect the authenticated search separately before claiming that outcome.

Local release candidate validation: 3,120 customer tests and 720 backend tests passed, with zero failures. Production build and syntax checks passed. Independent review found no remaining P1/P2 issues after the regression fixes. Authenticated search and exact-SHA deployment verification remain required after merge.

Authenticated acceptance uncovered a separate startup crash before any provider calls: `renderCompanyReviewBatch` compared two absent review IDs, treated `undefined === undefined` as an active batch, and then dereferenced the absent batch's domains. Require a non-empty batch ID before matching it to the current run. Regression mounts the real pending-review panel with no previous batch, renders the running state and verifies ordinary discovery reaches a provider query. This was absent from the old runner fixtures because most normal-search fixtures did not mount the batch panel.

## Recovery-file investigation and Step 4 acceptance follow-up

The supplied recovery export showed identical local/server business data. The only competing values were profile generation clocks and two canonical field update clocks; persistence metadata was the other non-business difference. Profile normalization rebuilt these clocks on ordinary reload. Preserve clocks for semantically unchanged fields/profiles, and merge valid generation clocks without treating them as business edits. Real competing values, deletion/edit conflicts, and recipient/evidence conflicts retain their review gate. Replay of the recovery export merges safely and preserves all company research, outreach and delivery objects. Do not commit the private recovery export or user payloads.

The progress model had accepted old stored eligibility flags, although the visible cards recomputed qualification against current seller context and exact operating quotes. Reuse the current card assessor, require an explicit positive qualified score, and require the requested company count before completing the discovery substep. The assessor must also work before Companies mounts: pass the saved research timestamp, and avoid dereferencing an uninitialized discovery workspace on Profile/Strategy reload.

Saved research also contained binary image URLs selected as operating pages. Exclude modern image/font assets in both internal-link selection and supplied recovery seeds, preserving the existing website-page and provider-budget rules. Regression cases reproduce the timestamp conflict, repeat normalization, retained legacy completion, requested-count shortfall, current assessment parity, pre-mount assessment and binary-asset waste. Automated and release checks still do not establish the live five-company outcome; authenticated search, save/reload, review-next and Buyers handoff must be inspected separately.

Manual research and automatic approval must not share the same corroboration threshold. A fresh official operating source, exact purchasing-application quote, relevant buyer relationship, verified identity/market and clear exclusions can support a positive manual result with Medium confidence. The second independent source remains mandatory for automatic company flow, alongside the fixed 80+ requirement. Independent commentary alone, boilerplate, missing application or a zero/non-buyer result still fails manual qualification. The recovery replay exposed a researched positive buyer blocked solely by the inherited automatic two-source rule; regression verifies manual availability and unchanged automatic rejection on the same evidence.
