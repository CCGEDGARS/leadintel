---
name: spec-driven-development
description: Turn a feature, integration, refactor, or ambiguous engineering request into a concise implementation contract before coding. Use for multi-file work or changes with meaningful product or technical ambiguity.
---

# Spec-Driven Development

Before substantial coding:
1. Inspect current implementation, tests, docs, schemas, and config.
2. Define goal, current behavior, desired observable behavior, in-scope and out-of-scope items.
3. Write testable acceptance criteria.
4. Map affected files, APIs, data, auth, UI states, migrations, and deployment implications.
5. Resolve ambiguity from repository evidence first; label necessary assumptions.
6. Define verification: tests, build/type/lint, browser flows, security, rollback if relevant.
7. Implement against the contract and do not silently expand scope.

Maintain: Goal; Current behavior; Desired behavior; Acceptance criteria; Constraints; Approach; Risks; Verification plan.
