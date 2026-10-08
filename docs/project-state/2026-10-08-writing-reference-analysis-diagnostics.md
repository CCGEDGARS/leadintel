# Writing-reference analysis failure investigation

Observed authenticated source: The_Cold_Email_Manifesto_-_Alex_Berman.pdf. Server extraction succeeded (112/113 readable pages). Source subsequently Failed. Existing runner discarded every exception and displayed a generic connection/quota message, so the original cause cannot be recovered from that saved error.

This change records allowlisted actionable diagnostics: confirmed billing quota, rate limiting, authentication, request/model rejection, timeout, invalid technique output, unavailable extracted source, and unexpected failure. Raw provider messages, credentials and source text are never persisted or displayed. AI generation preserves timeout classification instead of converting it to HTTP 502. Completed chunks and the original upload remain intact for retry.

Validation: runner regressions cover quota versus rate limit, timeout, malformed output and secret suppression; all existing chunk-resumption and lease/deletion tests remain applicable. A production retry is required to establish the cause of this customer's analysis failure. Do not claim it was a quota failure, timeout, or a repaired catalogue before that evidence exists.
