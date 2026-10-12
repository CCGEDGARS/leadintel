# Implementation plan

1. Add complete-schema migration and deterministic content/file usage triggers; backfill existing logical bytes without removing records.
2. Implement workspace usage policy, object reservations/reconciliation, generic quota error mapping and private bucket wrapping.
3. Implement owner-only Stripe Checkout/portal and signed canonical webhook lifecycle, with disabled-until-configured production defaults.
4. Mount Storage card in existing Settings; refresh per-workspace usage and attention drawer, protect stale replies and shared links.
5. Test all quota/payment/isolation boundaries using real SQLite and signed Stripe fixtures, run complete suites/build.
6. Publish exact-source branch/PR, require both CI suites, deploy migration/Worker/customer, require production proof. Verify authenticated meters and safe checkout setup status. Document secure activation with exact merchant/price/webhook and provider automatic billing.

Execution: sequential in isolated feature/workspace-storage-billing checkout. Preserve original checkout. No real checkout/payment is completed during acceptance.
