# Gemini-first book engine implementation plan

Spec: docs/superpowers/specs/2026-10-27-gemini-book-engine-design.md

## Global constraints
Preserve checkpoints, cached zero-call packaging, tenant isolation, original files, quality/coverage confirmations and active provider settings. No secret creation or paid benchmark without explicit execution. Existing model defaults are documented upstream. Existing native extraction bounds remain explicit; no full-book latency promise.

## Task 1: Route book and skill analysis through Gemini
Tests first: inactive connected Gemini wins over active OpenAI; workspace isolation; active fallback; missing credentials safe; errors cannot silently call another provider; real book/skill runners use shared selector; cached methods invoke none. Implement shared metadata selector/generator and library engine display. Expected: scoped backend and UI regressions pass.

## Task 2: Keep all three slots occupied
Tests first: a fast slot starts next section while a slow one remains outstanding; peak <=3; first failure stops scheduling and drains; deadline stops launches. Replace wave barrier while preserving public outcome contract. Expected: book, recovery, timeout and processing regressions pass.

## Task 3: Reproducible comparison and release
Build explicit opt-in three-provider comparison script; identical representative sections, structural validation, usage/elapsed metrics, no fake semantic scoring, safe errors and no runtime benchmark costs. Test offline transport fixtures. Document operation/limits and configured versus executed distinction. Update release capability flag and smoke. Expected: full backend/frontend suites and build pass, independent whole-branch review resolved, exact-SHA release proof PROVEN. Live comparison depends on authorized accessible provider credentials and a suitable book; disclose absent evidence.

## Review focus
Inspect shared credential query and errors, provider model preservation, scope isolation, worker stop/deadline races, cached no-AI paths, UI escaping/configuration attribution, benchmark billing honesty and secret handling. Tests cannot establish real provider speed or semantic completeness.
