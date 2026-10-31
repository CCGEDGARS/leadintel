# Delivery local release contract

This is local artifact verification only. No commit, CI/deployment mutation, production proof or live-send acceptance was performed. Buyers remains OPEN; authenticated/customer-business acceptance remains BLOCKED.

`release-integrity.config.json` now contains **558 mandatory smoke checks**. Twelve new checks cover eleven frontend Delivery artifacts/controls (source authority, provider request/receipt validation, local submission recovery, uncertain holds, manual recording, queue activation, exact handoff, diagnostics tracing, canonical package selection, cache entry and explicit takeover) and anonymous operations diagnostics rejection. The diagnostics check requests `/api/operations/diagnostics?workspace_id=audit-unauth` and requires HTTP 401 plus the existing authentication error marker. These source assertions supplement behavioral tests.

Backend health requires `delivery_integrity_version:20261031-delivery-v1` and `operational_diagnostics_version:20261031-operations-v1`; the root owner added those markers. The earlier companies/buyers/messages trace artifact gates now require the actual shared trace version `20261031-delivery-v1`; historical service health markers remain unchanged.

`delivery-reliability=20261031-v1` is present on changed browser URLs and recursive parents, including the late changed `email-campaign-ui.js`, the Delivery lazy asset helper, `discovery-ui.js`, `outreach-ui.js`, both automation loaders/parents and HTML entry points. CommonJS `require` paths remain literal module paths without cache queries. Dedicated cache regressions examine browser references and prohibit such query tokens in CommonJS resolution.

The backend's transitive customer module graph includes **36 shared modules**. Newly imported `brand-identity.js`, `content-language.js` and `outreach-engine.js` were absent from both Backend CI path sections and the release workflow's backend-change selector. Original dynamic dependency tests failed before the fix (`work/delivery-release-dependency-red.txt`). Both path sections and the actual jq selector now cover those modules; existing graph traversal tests prevent future omissions and retain frontend-only exclusions.

Final verification:

| Check | Evidence |
|---|---|
| Release/proof/dependency/cache regressions | **56/56 PASS**, zero skips — `work/delivery-release-gates-final.txt` |
| Every local static text gate | **530 artifacts / 1,802 required/forbidden text assertions PASS**, zero failures — `work/delivery-release-local-assertions.txt` |
| Static deployment assertions | PASS — `work/delivery-local-artifact-assertions.txt` |
| Complete static build | PASS — `work/delivery-static-build.txt` |
| Dedicated takeover + adjacent automation UI | **17/17 PASS** — `work/delivery-queue-takeover-ui-green.txt` |
| Owned backend automation + source | **88/88 PASS** — `work/delivery-queue-final-owned.txt` |
| Owned syntax and whitespace | PASS |

Release config frozen SHA-256: `83b20992abd33508f8b1703d033124889c81ee6f05c2b4902addb27cee2a50b5`.

An actual release still requires the exact intended Git SHA, required same-SHA CI, matching live manifest, backend health, all mandatory smoke checks and `release-proof.json` verdict PROVEN. Local build success and controlled proof fixtures do not establish those gates.
