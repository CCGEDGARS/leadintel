---
name: systematic-debugging
description: Diagnose bugs, failed tests, builds, runtime errors, bad deployments, and unexpected behavior using reproduction, evidence, hypotheses, isolation, and regression verification.
---

# Systematic Debugging

Do not guess-and-patch.
1. Capture exact symptom, expected behavior, actual behavior, environment, and reproduction path.
2. Reproduce reliably and identify where it occurs.
3. Gather evidence from logs, stack traces, console, network, data state, configuration presence, recent diffs, and deployment logs.
4. Localize the failing layer.
5. Rank hypotheses by evidence and test the cheapest discriminating hypothesis first.
6. Fix the root cause with minimal unrelated change.
7. Add regression protection when practical.
8. Re-run the original reproduction and adjacent flows.
If a prior fix failed, stop stacking patches and reassess the hypothesis.
Report root cause, evidence, fix, regression protection, and verified result.
