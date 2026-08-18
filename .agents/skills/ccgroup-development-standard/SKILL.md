---
name: ccgroup-development-standard
description: Apply CCGROUP's permanent engineering, production-safety, QA, and verification rules. Trigger when fixing, improving, deploying, verifying, or making a CCGROUP app production-ready.
---

# CCGROUP Development Standard

- Inspect before changing.
- Do not touch production without explicit approval.
- Preserve working functionality, user data, credentials, environment configuration, and integrations.
- Never fabricate test, deployment, URL, screenshot, or success results.
- Prefer permanent root fixes over workarounds when feasible.
- Never weaken validation, permissions, tests, or security to force success.
- Never expose or commit secrets.
- Prefer branch/preview/staging for material changes.
- Add or update tests for changed behavior.
- For UI work verify desktop, mobile, primary flows, loading/empty/error states, console, network failures, overflow, and basic accessibility.
- Before release verify build, relevant tests, app launch, critical flows, security, and exact deployment target.
- If verification cannot be performed, state exactly what remains unverified.
