# LKAB Buyer failure: tracing and incomplete research

## Scope and evidence
User authorized fixing the live Buyer flow and production validation. The historical 10 identity results and original provider errors were not available in this checkout. Do not confuse regression fixtures with that actual run.

A direct check of the managed Firecrawl search endpoint returned HTTP 200 and five public LKAB-related results. This does not prove the customer-owned key or historical run succeeded. No quota failure was confirmed. Google sign-in succeeded in the test browser, but the browser returned ERR_BLOCKED_BY_CLIENT for the Cloudflare API session endpoint. The authenticated LKAB workspace could not be loaded; live customer acceptance remains unresolved.

## Causes identified in code
- Provider errors were replaced with generic messages; error body, HTTP status and query were lost.
- Local-language role aliases influenced queries but did not influence role matching.
- Parsing used opportunity-specific roles while pool merging used the original seller profile, silently losing relevant people.
- First-name-only Apollo identities were discarded by the full-name pool gate.
- Empty results and failed providers were still labeled research complete/no matching roles.
- A 25-second client deadline cut off grounded research; the global budget did not reserve enough time for all bounded query waves plus grounded and identity phases.
- Any mention of previous employment could reject an explicitly current target-company role.

## Changes
One opportunity research profile now governs parsing, merging and ranking. Swedish aliases participate in matching. Per-result traces preserve parsing, target-employer verification, role matching, identity status and rejection reasons. Exact employer verification rejects subsidiaries unless explicitly selected. Pending Apollo identities require stable IDs, verified target employer and relevant titles; they remain separate from confirmed recommendations and cannot authorize outreach. All ten fallback diagnostics survive normalization even when public traces reach their cap.

HTTP errors, provider failure payloads and timeout details persist. Grounded requests allow 60 seconds; the overall run budget is 350 seconds, keeping cancellation functional. Provider failures remain non-terminal when fallback can run. Incomplete providers or identities show Research incomplete across coverage, progress, toast and empty-state UI. Failed providers do not establish absence of buyers. Save/reload preserves provider diagnostics, pending identities and result decisions.

## Verification
Behavioral runtime regression executes the real searchDecisionMakers function with failed public providers, grounded AbortError and ten synthetic first-name-only identity records. It proves fallback execution, ten retained pending identities, exact failed request status and incomplete labeling. Another regression proves a Swedish opportunity procurement role survives ranking even when the seller profile lists CEO. Parser regressions cover current/former employment, employer mismatch, missing identity, local titles, source evidence and normalization.

Full customer suite and production build run locally. CI and exact-SHA release proof must be collected after commit. The historical raw LKAB results, customer-owned Firecrawl response, authenticated grounded call and resulting production candidates must still be inspected before claiming the LKAB incident resolved.

## Additional real-provider evidence
A subsequent managed Firecrawl query `"LKAB" "Inköpschef"` returned HTTP 200 and four source rows. The original parser rejected all four. The directory result for Robert Palo carried an explicit current LKAB procurement role but its title included `Email & Phone Number`, causing name parsing to fail. The corrected parser strips only recognized directory title adornments and removes the narrative introduction from the extracted role. Replaying the real response now yields Robert Palo as a sourced procurement suggestion; the other three news-page titles remain rejected because no full person name can be parsed. This is public-provider evidence, not the authenticated ten-result identity run or confirmation of current buying authority. Per-result replay evidence is in `2026-10-03-lkab-public-live-trace.json`.
