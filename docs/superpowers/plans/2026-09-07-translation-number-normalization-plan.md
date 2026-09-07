# Translation number normalization implementation plan

1. Add a regression test reproducing `15,000` -> `15 000` translation rejection.
2. Replace raw numeric-string comparison with locale-aware numeric token comparison.
3. Keep hard rejection for actual changed facts.
4. Run full Customer V2 CI and JavaScript syntax verification.
5. Merge only after green CI and release integrity verification.
