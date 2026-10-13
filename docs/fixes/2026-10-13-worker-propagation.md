# Deployment verification propagation race

Two deployments successfully published the legacy proxy, then immediately failed the single health request because a global edge still returned the previous release SHA. A later request returned the intended SHA and customer-only billing.

The deployment workflow now uses a bounded verifier: up to 12 attempts, two seconds between attempts, a five-second per-request timeout, and an uncached URL per attempt. It succeeds only when health is OK, billing is customer_only, and the release SHA exactly matches the intended commit. Stale releases, shared billing and unreachable health still fail closed after the bounded retry window. This removes the need for manual deployment reruns without relaxing provenance or billing checks.

Tests cover eventual propagation, permanent stale release, incorrect billing, temporary HTTP failure, invalid SHA and actual workflow wiring.
