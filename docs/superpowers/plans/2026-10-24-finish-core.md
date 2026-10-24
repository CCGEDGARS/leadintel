# Finish the core implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to integrate and verify task-by-task. Independent domains may use the approved parallel-agent workflow.

**Goal:** Complete the approved seven-area product review with measurable, safe acceptance evidence.

**Architecture:** Repair existing persistence/transport and journey models; add small read-only buyer outcome, CRM priorities and measured cost modules; integrate through the existing lazy loaders and authenticated Worker routing. Use existing storage contracts.

**Tech stack:** Vanilla JavaScript/CSS, Node tests/JSDOM, Worker/D1, GitHub CI/Vercel release integrity.

**Spec:** docs/superpowers/specs/2026-10-24-finish-core-design.md

## Global constraints

- Preserve saved work, protected core text, exact recipient, approval and workspace isolation.
- No real send, paid lookup, automation activation or contact blocking as a release test.
- Unknown/missing data or cost is never zero or completed by assumption.
- Root owns index/loader wiring and app.js endpoint dispatch; independent agents own disjoint implementation modules.

## Review focus

- Transport or response body ignores AbortSignal, including already-aborted requests.
- Saved stale tasks/partial API results cannot create false recovery.
- Complete required work with incomplete optional work; active completed stage.
- Wrong company/person/receipt identity, duplicate billing receipts, unsupported cost currencies.
- Late asynchronous responses after a workspace or view switch; no send side effects from dashboard/metrics.

## Tasks

1. Reliability: reproduce timeout/retry defects; settle abort/deadline, restore durable retries, verify scoped recovery. Files attention-centre*, server-bridge.js and CRM refresh section discovery-ui.js; focused regression tests.
2. Journey clarity: required/optional counts, active/completion independence, actionable next step and route regressions. Files journey-progress.js, process-map.js and journey selectors premium.css.
3. Daily CRM: Today priorities using existing authenticated company/conversation APIs, safe bounded coverage and accessible actions. Files crm-priorities.js, crm-ui.js, crm.css and tests; stable #crm-insights-slot for cost mount.
4. Costs: GET /api/research/costs handler, authoritative receipt projection and mountable UI. Root mounts endpoint in app.js and client from CRM loader. Tests auth/isolation, period, dedupe, missing cost and races.
5. Buyer outcomes: pure evaluate(candidate,options) using existing ranked quality/contact policy; negative/stale/cross-industry benchmark and narrowly proven policy fixes. Root adds summary to Buyers without changing eligibility.
6. Shared presentation/journey integration: low-specificity field/section tokens, all loader edges versioned, mount costs only in CRM and buyer outcomes alongside existing quality. Verify hidden/actions and error/empty/recovery states.
7. Complete journey and release: controlled provider/DB integration tests, full suites/build, independent final review, authenticated no-send UI checks, exact-SHA PROVEN production proof. Document measured results and evidence limits.

## Progress ledger

- Baseline: main 74897e35bcb0c5cd7f055c8844b9d5053932f8d1; same-SHA Customer CI 40109809423 and Release Integrity 40110041459 succeeded.
- User authorization: explicit “take over and complete these tasks”, following the seven-area review and ownership response.
- Ruling: use the existing approved limits and simulated sends for verification. A live prospect send is outside this release's test authority.
- Ruling: bounded CRM lists/cost coverage must disclose incompleteness rather than pretending to scan the full workspace.
- Tasks 1–6 implemented and integrated. Focused regressions, independent review and corrected findings are documented in the per-domain project-state notes.
- Task 7 controlled journey and local verification passed: 3,722 customer + 905 backend tests under Node 22, build and diff checks. See docs/project-state/2026-10-24-finish-core-acceptance.md for exact evidence and browser/live-outcome limits.
- Production release verification remains the final gate; record its exact SHA and proof in the release PR.
