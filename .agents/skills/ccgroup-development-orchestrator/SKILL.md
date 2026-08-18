---
name: ccgroup-development-orchestrator
description: Orchestrate substantial software work from inspection through specification, implementation, testing, security review, browser verification, and final evidence. Use for new features, non-trivial fixes, refactors, upgrades, or multi-file work.
---

# CCGROUP Development Orchestrator

Do not declare work complete because code was written. Completion requires evidence.

1. Inspect repository instructions, docs, config, tests, current behavior, branch, and environment before editing.
2. Define observable outcome and acceptance criteria; use `spec-driven-development` for non-trivial work.
3. Make the smallest coherent root-cause fix and preserve existing behavior unless explicitly changed.
4. Use `test-driven-development` for new behavior and regressions when practical.
5. Use `systematic-debugging` for unexpected behavior; reproduce before patching.
6. Use `architecture-review` for structural changes and `security-review` for sensitive changes.
7. Use `browser-ui-verification` for user-facing web changes.
8. Protect production: never promote, deploy, overwrite, or delete without explicit authorization.
9. Use `release-verification` before claiming completion.
10. Report what changed, checks run, evidence, environment affected, and anything unverified.
