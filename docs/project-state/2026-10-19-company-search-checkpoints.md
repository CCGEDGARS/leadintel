# Completed company-search batches survive interruption

Authenticated testing of 05c5728808a5734f86a3c39880d973764b38fe57 produced BoMill AB, Sweden, company fit 84/100, with five evidence pages and three source families. The search continued into adaptive follow-up. Closing the test tab before the run finished and reopening the workspace restored the earlier zero-result state: the accepted batch existed only in memory.

`researchPool.onProgress` updated the visible shortlist and funnel without calling `saveDiscovery`. The existing end-of-run save never ran when the page closed. Each completed fit batch now commits its qualified candidates, current research timestamp, count and retained-result state through the normal workspace save before rendering. Workspace/account scope is checked before the checkpoint. No evidence, score or identity gate changes.

The regression captures persisted storage inside the real fit progress callback, before the overall run can finish, then uses the production interrupted-run recovery normalizer. It failed before the fix (recovered error with no candidate) and passes after the fix (partial result, valid candidate and current timestamp). The existing final save/reload and no-duplicate-fit assertions remain.

This checkpoint covers normal discovery and individual/bulk rechecks, which share `runCompanyDiscovery`. Dedicated provider-retry paths retain their end-of-run saving behavior; no claim is made that these are background jobs or survive a browser closing before a batch is saved. A tab closing still interrupts outstanding research. Existing CRM records and selections are preserved.

Release and authenticated acceptance of this new revision must be verified separately before calling it PROVEN PRODUCTION.
