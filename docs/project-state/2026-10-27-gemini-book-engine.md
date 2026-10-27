# Gemini-first book engine — 27 October 2026

## Behavior
Connected Google Gemini and its saved model are preferred for new and resumed book analysis and unfinished skill generation. This is independent of the globally active assistant/writing provider; no settings or saved work are mutated. When Gemini is absent, the existing active provider is used and the library labels that fallback. If Gemini rejects a request, fails billing or times out, existing bounded retries and safe diagnostics apply; there is no silent cross-provider paid failover. A prepared skill still packages without any AI connection.

Both Books and Skills show the configured next-batch engine/model. This is configuration metadata, not an execution receipt or a benchmark result. Processing that already holds a lease keeps its captured provider until the next invocation.

## Scheduling
Three worker slots now take the next section as soon as their previous section is saved. Unlike synchronized waves, fast sections do not wait for the slowest sibling. After the first observed error no new work launches; in-flight successes are checkpointed. Existing workspace lock, per-section attempt limits, cancellation guards and deadlines remain.

The invocation cap increases from24 to60 sections; a four-minute launch window and120-second request deadline still end an invocation below its seven-minute lease. More work per invocation reduces minute-scheduler round trips when the provider is fast. A controlled60-section skill batch stays under500D1 prepare calls; existing440-page resumability and quota-bound cleanup coverage remains. This relies on the existing paid Worker/D1 architecture, not the50-query Free tier (https://developers.cloudflare.com/d1/platform/limits/). No extra queue or paid priority tier was installed.

## Reproducible comparison
Operator tool: `backend/scripts/compare-book-providers.mjs`.

From backend, with OPENAI_API_KEY, ANTHROPIC_API_KEY and GEMINI_API_KEY supplied securely in the process environment:

    node scripts/compare-book-providers.mjs --book /private/book.pdf --out /private/comparison --confirm-cost

Optional OPENAI_BOOK_MODEL / ANTHROPIC_BOOK_MODEL / GEMINI_BOOK_MODEL preserve exact comparable model IDs. Defaults match LeadIntel: gpt-6.1-sol, claude-sonnet-5-5, gemini-3.8-flash. No credentials are read from production or written by this script. Missing credentials fail before any request. Only3 representative sections (beginning/middle/end, fewer for small books) are sent to each provider, with up to3global requests at once and identical prompts/output validation. This is not a concurrent three-per-provider throughput benchmark or a full-book timing promise.

The private0600JSON report records model, per-request elapsed time, available token usage, safe errors and generated methods for human review. Gemini reasoning tokens are recorded separately from visible output. Missing usage is unknown, not zero; failed requests can still be billed. Valid means structurally valid only. Judge omissions, unsupported claims, depth and usefulness against the source before choosing a winner. No invented quality score or fastest-provider badge. For fair production throughput, run repeated per-provider isolated trials at concurrency3 using the saved representative corpus, then a full-book trial; do not extrapolate solely from output tokens/sec.

## Retained boundaries
Text-readable PDF extraction remains local, preserving source locations and originals; native Gemini fallback is independently bounded at60pages/8MiB and does not make a long scanned book readable automatically. Raising that limit or enabling a full visual transcription can increase latency and cost and is not part of this speed optimization. PDF native upload limits are distinct from analysis-model context windows and app limits.

No paid live comparison or authenticated customer-book completion has been observed in this session. Production release proof establishes exact code/health/smoke gates, not semantic completeness, customer provider access, or a measured book speedup. Remaining existing jobs pick the preference up at their next lease; completed outputs are never regenerated.

## Validation
Gemini inactive preference, tenant isolation, active fallback, no silent error failover, actual book-runner integration, zero-call cached skill behavior, worker refill/failure/deadline,60-section boundedD1budget, engine display/escaping and controlled3provider comparison are covered by regressions. Full suite/build/review and exact-SHA release proof are final release gates.
