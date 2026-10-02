# Research recovery and Profile navigation

## Root causes and fixes

- Strategy compared the active signal ID subset to all recommended IDs, repeatedly flagging valid research as belonging to another company. Research now records an exact context fingerprint (seller website, offers, ideal customer, active markets, buyer roles, exclusions and active signal keywords). Real changes still invalidate research. Legacy unrelated signals remain blocked.
- Market state normalization discarded start time, phase and retry progress during rendering. These now survive normalization/reload, so elapsed time remains meaningful.
- Timeout retries were explicitly disabled. OpenAI search now uses bounded two-attempt recovery; initial/adaptive retries reduce redundant query length. Timeout failure remains partial, never reported as successful discovery.
- A whole extraction batch had one page's deadline despite processing multiple pages with concurrency two. Its bounded budget now accounts for the number of page batches.
- Quality-ranked truncation could discard independent sources before the diversity gate. Selection preserves source classes and independent domains before filling the storage budget; extraction uses this order too. Source class is derived from actual URLs, not the search query category. Quick mode performs at most two diversification follow-ups when real results show insufficient diversity. Quality requirements remain enforced.
- Adaptive failures now contribute to provider status counters. Recovery reruns the current scope when quality/context needs repair; provider-only retries preserve results and retry failed queries when identifiable.
- Both Lookalike variants retain the reference-model activation gate.
- A stale-research handoff offers “Go to Profile and update research” and opens Profile research directly. Dismissal of an otherwise valid review still returns to Strategy.

## Presentation after functional verification

The Profile research workbench moved outside its former CSS parent, leaving its result summary unstyled. Stable-ID styles restore spacing, readable typography, responsive status/actions and explicit partial status. View report and Retry incomplete checks are direct actions. Technical failures stay available in expandable incomplete-check details.

## Validation and limits

Behavioral regressions cover ID subset false positives, genuine context changes, name invariance, normalized timer/retry reload, source classes, diverse storage, bounded follow-up, cross-industry queries, timeout recovery and Profile navigation. Entire customer suite, syntax, build and release integrity must pass before publication is reported as proven. Provider timeout recovery is verified with controlled failures; an authenticated real-provider run is still needed to establish this customer's research outcome. No messages are sent.
