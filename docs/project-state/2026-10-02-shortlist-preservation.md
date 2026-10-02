# Company shortlist preservation and stage separation

Root cause: normalizeDiscoveryState deleted candidates, raw research, queries, potential matches, timestamps and funnel metadata when qualityVersion advanced. Selected prospects and CRM/pipeline records survived, producing a blank company list above a Polestar buyer card. Buyer controls were also rendered directly in company cards and the shared pipeline section irrespective of stage.

The normalizer now preserves research through scoring upgrades and repeated save/reload, marks retained qualified company cards needsRecheck, and prevents those stale companies from being newly selected or promoted. Existing selected prospects, kept contacts and CRM data remain preserved. Empty/failed new searches retain previous stale research; newly verified replacement records clear their stale marker. Invalid previously unqualified candidate records are still excluded from the qualified shortlist. Queries, evidence, potential matches, dates and funnel history remain available.

Companies renders company evidence and selection controls, with a stale-score notice. Buyer details live only in Buyers. Stage switching updates shared section visibility and clears rendered buyer content in Companies without mutating stored people. Empty-state copy distinguishes missing retained results from a request to recheck scores, avoiding duplicate messages.

Recovery limit: this patch preserves data still present; it cannot recreate rows already deleted from an authenticated saved workspace. No authenticated workspace backup was accessible in this execution. Do not claim the original five-company list has been restored. Selected company data is preserved, and existing-company rechecks remain available without implying restoration.

Validation covers migration preservation, stale action blocking, repeated normalization, Companies/Buyers rendering separation, kept-contact survival and the existing refresh and research suites. Release requires exact-SHA CI, deployment, health/smoke checks and live asset parity.
