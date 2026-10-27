# Single-pass book processing — 27 October 2026

## Approved result

New uploads prepare the summary, writing guidance and deep reusable methods in one analysis pass. Analysis processes all readable text using the stable 4k/200 child plan. Review/native extraction gates remain. Turn to skill still requires Ready analysis, summary and explicit confirmation; complete prepared methods are copied into an independent package without a second provider call. Cached conversion is handled by the existing minute scheduler and is not promised to be instantaneous.

Existing uploads keep the legacy 12k analysis plan and format. Existing skills retain every completed full-section and child checkpoint. Remaining work uses compact legacy hints and three parallel requests per workspace. A shared durable workspace lock prevents simultaneous upload/skill jobs from multiplying that concurrency. Per-section attempt counters stop failures after three attempts even when sibling sections succeed. Explicit Retry resets those counters atomically. Rate limits stop new waves, preserve successful in-flight work and delay retries.

The existing Worker runs consecutive waves up to24 units or a four-minute launch window, drains outstanding calls within the120-second request deadline, and reserves a seven-minute lease. Cron recovers interrupted work and continues bounded invocations. No new queue or provider permissions are required. There can still be a scheduler wait between invocations; it is not one wait after every four sections.

## Progress and interface

Both book analysis and skill conversion expose percentage, last saved time, observed speed and estimated remaining time. Old completed work is a baseline and never inflates the new throughput estimate. Estimates require at least three new sections and ten seconds of observations. A five-minute no-progress note distinguishes a possible wait/retry from confirmed failure. Polling preserves controls, editing and newer mutations, and reports refresh errors without inventing job status.

## Validation

Controlled integration: upload → summary → confirmation → independent skill → book deletion/export completes with zero second-pass AI calls. Coverage, malformed/incomplete caches, shared locks, parallel cancellation, mixed success/rate limits, bounded retry budgets, legacy source/skill resume, quota cleanup and multilingual routing bounds are covered. A valid prepared catalogue must match every planned unit ID and validate all method fields and supplied locations.

Controlled scheduling benchmark:24 simulated20ms requests took586ms with one worker and169ms with three workers in this workspace. This is a synthetic scheduling comparison, not a production provider speed promise. Actual provider speed, rate limits and semantic output quality still affect completion time. Initial upload analysis does more work than the earlier summary-only stage, while removing the later duplicate pass.

Full frontend initially3932/3932passed; two additional confirmation/race cases pass separately. Final backend/full CI counts and production proof are verified at release. One pre-existing context-concurrency test failed only its elapsed<60ms gate under competing suite CPU load; its >=8 concurrent I/O and context-output assertions remain, while the nondeterministic elapsed gate is removed.

Authenticated customer/provider verification is unavailable while the originating browser connection is absent. Do not claim the customer's book reached Ready or a measured production speed-up from synthetic fixtures. Exact-SHA status belongs to release-proof.json.
