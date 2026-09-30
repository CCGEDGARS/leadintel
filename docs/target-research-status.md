# Target research outcomes

The Target Companies modal and Companies cards use the same `targetResearchSummary` helper. Completed research is distinct from a qualified opportunity.

Completed target runs retain per-domain outcomes in Discovery metadata: completion time, qualification result, recorded gaps and evidence. This metadata uses the existing workspace persistence bundle. Legacy `lastTargetResearchNames` is recovered without repeating research, and migrated into the outcome history before a later run replaces the current results.

Research details show recorded qualification gaps and available evidence. Where an older run did not retain specific gaps, the UI says that not all opportunity requirements were confirmed; it does not invent reasons. Viewing results opens Companies without starting a new search.

Verification: customer suite passed 1,231 tests, including legacy recovery, unrelated-target pending status, and retained outcomes after researching another target.
