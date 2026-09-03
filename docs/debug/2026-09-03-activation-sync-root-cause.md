# LeadIntel activation + sync conflict root cause — 2026-09-03

Observed production screenshot:
- `Sync conflict · local changes preserved`
- stale AJ Produkti workspace visible
- Activate Website appears to do nothing

Evidence:
1. Production frontend is main SHA `16db1bd6fa495c190545df9ec95d248efcf25c8d`; Vercel production READY.
2. Backend Deploy and Release Integrity for that SHA are green.
3. `/api/integrations/services/firecrawl/scrape` exists in the live backend.
4. `https://www.ajprodukti.lv` returns readable Firecrawl content now.
5. PR #50 (`fix/explicit-workspace-save`) is still open and unmerged. Its stated purpose is the remaining AJ Produkti reappearance caused by unsaved browser workspace persistence. It is 16 commits behind main, so its behavior must be transplanted/retested rather than merged blindly.
6. `customer/website-activation.js` catch sets `Activation failed · …`, but its unconditional `finally { running=false; render(); }` immediately overwrites that error with the idle status. This makes a real activation failure look like a dead button.
7. Authenticated Firecrawl calls are rewritten through the workspace backend. The compatibility router currently does not preserve the managed proxy fallback on retryable backend/network failure.

Fix direction:
- fresh production-main bugfix branch;
- RED test for persistence boundary against current main;
- transplant/reconcile explicit-save persistence helper from PR #50;
- RED test that activation failures remain visible;
- make activation render preserve error state;
- retain managed Firecrawl proxy fallback only for network/429/5xx failures, never 400/401/403;
- full customer tests + CI + production exact-SHA proof before completion.
