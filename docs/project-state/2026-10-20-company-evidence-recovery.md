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
