# Research preview themes fix

Root cause: the review UI hard-coded sales-team hiring and generic themes independently of the actual plan. All modes now derive displayed themes from the exact planned query categories and signal names. Commercial plan metadata carries the selected signal name; the app transfers this metadata to the preview. Missing plan metadata yields no fabricated themes. Guard markup updates to avoid a self-triggering mutation-observer refresh loop.

Regression checks verify Ercon industrial projects, production-facility expansion and investment across all three modes, and retain genuine sales signals for sales sellers. All 1,316 customer tests pass, plus focused checks and static build. Cache identifiers updated for plan engine, app and review module. Saved reference/company data is preserved. No paid research was triggered during verification.
