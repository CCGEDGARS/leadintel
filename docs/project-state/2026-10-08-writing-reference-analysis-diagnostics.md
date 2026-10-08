# Writing-reference analysis failure investigation

Observed authenticated source: The_Cold_Email_Manifesto_-_Alex_Berman.pdf. Server extraction succeeded (112/113 readable pages). Source subsequently Failed. Existing runner discarded every exception and displayed a generic connection/quota message, so the original cause cannot be recovered from that saved error.

This change records allowlisted actionable diagnostics: confirmed billing quota, rate limiting, authentication, request/model rejection, timeout, invalid technique output, unavailable extracted source, and unexpected failure. Raw provider messages, credentials and source text are never persisted or displayed. AI generation preserves timeout classification instead of converting it to HTTP 502. Completed chunks and the original upload remain intact for retry.

Validation: runner regressions cover quota versus rate limit, timeout, malformed output and secret suppression; all existing chunk-resumption and lease/deletion tests remain applicable. A production retry is required to establish the cause of this customer's analysis failure. Do not claim it was a quota failure, timeout, or a repaired catalogue before that evidence exists.

## Confirmed production cause and repair
The authenticated retry after diagnostic deployment returned `Analysis timed out`. This establishes a timeout, not exhausted credits. Each request previously allowed only 12 seconds. Reference analysis now requests low reasoning for supported OpenAI models and permits 60 seconds; the two-chunk job lease is extended to 150 seconds so another scheduled worker cannot steal its lease mid-request. The minute scheduler owns analysis; upload/retry HTTP responses only enqueue, avoiding Cloudflare's 30-second post-response background limit. Source snapshots show completed/total chunks so long books no longer appear silently stuck. Normal message generation retains its existing reasoning configuration.

Partial coverage has an explicit recovery action after successful analysis: `Use readable pages` acknowledges the disclosed coverage and makes the learned source Ready, without automatically activating it. Failed or Processing sources cannot acknowledge partial coverage, and unreadable-page counts remain visible. This closes the previous dead end where a single textless page prevented all use of a successfully analysed book.

Cloudflare reference: https://developers.cloudflare.com/workers/platform/limits/ confirms 30-second post-response waitUntil and 15-minute scheduled wall time.
