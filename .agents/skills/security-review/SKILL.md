---
name: security-review
description: Perform a defensive security review of application changes or authorized codebases. Trigger for auth, permissions, user input, uploads, APIs, secrets, payments, personal data, databases, dependencies, infrastructure, integrations, or pre-production review.
---

# Security Review

Review authentication, authorization, tenant/object boundaries, injection, XSS, SSRF, path traversal, unsafe deserialization, uploads, output encoding, redirects, secrets, logs, CORS, sensitive data, dependencies, webhooks, rate limits, database access, and cloud permissions as relevant.

Method:
- Start with changed code and trust boundaries.
- Trace untrusted input to sensitive sinks.
- Confirm protections server-side, not only in UI.
- Separate confirmed vulnerability, plausible risk, and hardening suggestion.
- Rank by exploitability and impact.
- Prefer minimal safe remediation and add regression tests where practical.
Never print secrets, exfiltrate data, disable controls to pass tests, or claim vulnerabilities without evidence.
