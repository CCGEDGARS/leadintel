---
name: test-driven-development
description: Implement new behavior and bug fixes with a test-first or test-anchored workflow. Use for business logic, APIs, state transitions, regressions, and reproducible bugs.
---

# Test-Driven Development

Preferred loop:
1. Define one observable behavior.
2. Add or identify a test demonstrating the desired result.
3. Confirm it fails for the expected reason when feasible.
4. Make the smallest implementation change.
5. Run the focused test.
6. Refactor without changing behavior.
7. Run the broader relevant suite.

For bugs, reproduce first and add regression protection when practical.
Do not delete valid tests, weaken assertions without justification, hide failures with snapshots, or mock away the behavior under test.
At completion report tests added/changed, commands run, results, and manual verification still required.
