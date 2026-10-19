# Company verification recovery — 19 October 2026

The signed-in Ercon / Sweden search at 20:03 Riga found 15 company names and checked six websites, then reported zero qualified companies after two source failures. It had used 52/200 Firecrawl calls. LKAB remained in review with only “Refresh company verification”. This was not a confirmed absence of suitable companies.

## Reproduced causes

1. `buildPotentialCompanyCandidates` kept the first instance of a URL. A resolution snippet appeared before the freshly scraped homepage, discarding the full page and its `verifiedAt` timestamp. Commercial assessment could succeed while freshness still failed. Use the newer verified version, as the main candidate merge already does. Canonical URL deduplication also prefers the newest verified page across tracking-query and trailing-slash variants, in either arrival order.
2. The website retry rebuilt retained candidate evidence without `verifiedAt`, dropping freshness again. Carry verification and publication metadata through that boundary.
3. `firstPassSucceeded` required every source to succeed before allowing the adaptive follow-up. Isolated source failures stopped useful discovery despite healthy evidence and remaining budget. Allow the bounded follow-up from usable market evidence, retain source warnings, and still stop when all market searches fail. No qualification threshold or evidence gate changes.
4. Every row’s Recheck action invoked the bulk recheck. Pass the review identity and filter the target pool before calculating requested count, cost budget and queries. Recheck all retains the bulk behavior.

## Verification

Regression tests first failed for discarded timestamps (including the website retry), skipped follow-up and bulk row rechecks. The integrated pipeline test now qualifies a company found in the follow-up while preserving the unrelated 502 warning. Engine coverage also verifies timestamp preservation through save/reload. Full customer suite: 3,009/3,009 passed. Build and source checks passed. Independent code review: no remaining critical/important findings. Exact-SHA release proof and authenticated Sweden outcome remain separate acceptance gates.

## Prevention

Any snippet → page merge must prefer freshly verified evidence; any reconstruction of retained evidence must preserve verification metadata. A single failed source must remain a local gap rather than veto healthy companies. A row action must use the row identity all the way through queries and the paid-call budget.
