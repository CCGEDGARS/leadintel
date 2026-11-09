# Company-search results and continuation contract

Owner report: the Companies page displayed 25 identified companies, nine websites checked, two "qualified" cards (81 and 69), and 22 awaiting review after a request for five. The page called a three-pass stop an exhausted research budget.

Confirmed causes reproduced against the real browser runner:

- The manual evidence-check result `eligible` was displayed as "qualified", although it intentionally retains checked companies at every fit score. Automatic readiness uses separate evidence gates and an 80-point minimum.
- Automatic broadening reopened general searches before the saved evidence-review queue. A controlled test with a known unfinished domain confirmed the first paid query was a new market search.
- The UI used `autonomousDiscovery.exhausted` to claim the call budget was spent. That flag also covered the independent search-pass limit.

The exact private run's provider receipts were unavailable: automatic approval review rejected detailed workspace export through the remote browser. Nine checks, three passes and a shortfall do not establish a particular failed provider, actual credit use, or a Denmark-wide lack of prospects. A US page in the screenshot does not by itself prove that all saved country-attribution evidence is invalid. Preserve the existing target-market evidence gate; do not repair the count by relaxing it or inventing a purchasing need.

Required behavior:

1. Keep checked companies, strong fit (80+), automatic readiness, purchasing application and confirmed buying intent separate. A manual result below 80 remains available and is visibly marked for manual review.
2. If the checked-company target is unmet, process saved unfinished companies before purchasing new broad discovery. Reuse the original request budget and scope/cancellation guards. Attempt each queued domain at most once per automatic request; a deliberate later review may retry it.
3. Preserve successful queued checks through subsequent searches, partial batches, save/reload and downstream selection. Never overwrite saved buyers or CRM data merely to improve the list.
4. Report measured call exhaustion, insufficient allowance for another bounded check, pass limit, provider failure, cancellation and a reached target separately. A stopped shortfall is not a full-success progress bar. Do not imply that a target guarantees sufficient qualified prospects.
5. Guard the contract with executable tests: queue-before-market ordering, shared call cap, queued success without another market wave, mixed 81/69 score rendering, genuine versus false exhaustion, and authenticated persisted browser reload. Source-marker checks alone do not prove this contract.

Acceptance must record code checks, exact-release proof and authenticated UI evidence separately. Use controlled provider fixtures for regression work. Do not spend another paid research run solely to repeat deterministic tests or export private workspace detail to prove a label change.
