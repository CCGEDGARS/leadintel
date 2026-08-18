---
name: context-engineering
description: Control what project information an agent reads, retains, summarizes, and uses. Use for large repositories, long-running projects, repeated workflows, or multi-agent work.
---

# Context Engineering

Relevant context beats maximum context.
- Load authority first: user instruction, AGENTS.md, repo docs, package/config files, schemas, nearby implementation, tests, deployment config.
- Track goal, constraints, architecture, key files, APIs, data model, environment, decisions, assumptions, and risks.
- Avoid unrelated directories and stale artifacts.
- Re-read files whose state changed rather than relying on memory.
- Preserve durable decisions in repository documentation or project-specific skills.
- For long tasks keep a compact status: objective, completed changes, next verification, blockers, production-safety state.
- When delegating, give each subtask only needed context and prevent overlapping writes unless coordinated.
