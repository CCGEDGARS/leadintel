---
name: architecture-review
description: Review structural quality and maintainability of a software change or codebase. Trigger for large features, refactors, duplicated logic, cross-cutting changes, data-model changes, or growing technical debt.
---

# Architecture Review

Review:
- responsibility and cohesion;
- boundaries between UI, domain, data, integrations, and infrastructure;
- dependency direction and circular coupling;
- duplicated behavior likely to diverge;
- state ownership and sources of truth;
- API contracts and failure modes;
- testability, observability, deployability, and rollback;
- avoidable network/database work and unbounded expensive paths.

Do not add abstractions merely to look clean. Prefer the simplest structure that expresses the domain, prevents known failures, supports current requirements, and leaves reasonable room for expected change.
Classify findings: Keep; Improve now; Improve later; Remove. Explain the concrete cost or failure prevented by every Improve now item.
