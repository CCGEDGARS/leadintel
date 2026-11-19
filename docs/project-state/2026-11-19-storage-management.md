# Storage monitoring, file cleanup and optional report copies

The owner requested a storage monitoring bar, deletion of unnecessary files and an option to avoid automatically retaining unnecessary content. Pricing and free-capacity proposals remain separate: this change does not activate Stripe, change prices or change allowances.

Settings → Storage retains the server-authoritative data/file meters and adds percentages, amber 80% and red 95% meter states. Manage files & saving lists company materials and books, largest first, with accounted sizes, download links and explicit owner-only deletion. Files still being processed cannot be deleted from this panel. Deletion reuses the existing source endpoints, revision guards, durable cleanup and R2 quota accounting. The confirmation states the effects; saved derived skills remain independent of book deletion. This inventory is not an exhaustive list of every storage object or CRM record.

A workspace-owned preference controls optional automatic research report snapshots. Existing behavior is preserved by default. Turning it off preserves existing reports, current source evidence, diagnostics, monitoring findings, saved workflows and versions. Explicit Save current report remains available. Identical report copies and empty automatic snapshots are skipped. Opening the research panel no longer persists a migrated copy simply by viewing it. Missing/failed preference checks skip only the optional copy and explain recovery. Preference updates require owner authentication, an allowed origin and optimistic revision matching, and remain available at storage capacity.

Existing identical-company-file upload deduplication and abandoned-book-upload recovery remain in place. No AI classification deletes content as “garbage”, and no broad age-based cleanup of useful source evidence is introduced.

Migration 0079 adds two small preference columns without changing stored content or quota limits. Old workers ignore these columns; UI/backend rollout is compatible. Rollback leaves data and preference intact, though older clients do not honor manual-only report copies. No cleanup is performed on real customer files by deployment.

Validation includes SQLite quota/authentication/CAS tests; customer cancellation, stale-workspace and save/reload tests; actual Workers migration/status checks; and an authenticated Chromium → real HTTP routes → SQLite/R2-fixture journey, including mobile layout and metered deletion. Live customer-file deletion is intentionally not an acceptance step.
