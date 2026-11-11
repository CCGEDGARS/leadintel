# Workspace categories and independent monitors

## Outcome
A workspace owner can choose an existing category or create a named category, save several independent monitors, test one public page before enabling a new monitor, and review all findings in the existing shared Monitoring inbox. Each monitor owns its websites, criteria, schedule, next action and saved personal message format. Existing Ercon configuration and legacy API remain compatible.

## Ownership and boundaries
- Existing `market_monitoring_configs` is the virtual `legacy` monitor. Preserve IDs, revisions, leases, evidence, schedules and message approvals. No migration recreates it.
- New `monitoring_categories` stores workspace-specific reusable criteria and base purpose. A name does not add a parser or promise support for an unknown site. Category definition changes pause linked monitors and hold pending approvals; rename alone is metadata.
- New `monitoring_monitors` uses the current monitoring configuration/runner contract. History and evidence carry monitor ownership. Event keys are namespaced per new monitor; immutable source versions remain retained.
- New `monitoring_previews` stores a bounded one-page extraction receipt. Preview is an explicit single Firecrawl read; no findings, schedules, contact enrichment or outreach. Enabling a new monitor requires a fresh matching preview. Unknown/restricted pages show gaps and cannot activate.
- One scheduler and runner cover legacy and new monitors, with bounded per-run operations, leases, membership/Strategy checks and atomic context guards. Source and schedule revisions cannot publish stale data.
- One shared inbox, with monitor/category origin and filters. Archived monitors retain history. Monitor-specific message authority resolves the originating monitor and current category definition. Gmail uses the existing global policy, mailbox locks, suppression and receipt recovery. No real outreach is authorized by implementation.
- Owner manages categories. Owner/researcher manages research-only monitors; only owner enables automatic messages. Workspace isolation and quota accounting apply to all additions.

## User interface
Dedicated monitor manager alongside the existing settings. List active/paused monitors and next due time; add/edit/pause/archive without overwriting another monitor. Purpose dropdown offers builtin categories, saved categories and “＋ Add category…”. Category editor asks name, what to find, base type, matching/exclusion words. New monitor starts paused. “Test on a page” previews evidence, extracted fields and unresolved facts; activation follows a successful current test. Saving closes safely; errors preserve edits. Existing global inbox remains the findings destination.

## Compatibility and rollback
Additive schema and optional normalized fields; legacy workflow encoding remains unchanged when omitted. Existing enabled monitor does not suddenly require a preview. New tables may be left paused on rollback; old runtime continues with legacy monitor. Archive rather than delete evidence. No customer-specific default sources or terms.

## Acceptance
Real SQL/HTTP tests cover two independent monitors, categories across workspaces, preview expiry/context revocation, optimistic revisions, category edits/archive, full-quota pause, legacy save/reload, fair registered scheduler, independent histories, inbox ownership, current message authority and shared delivery limits. Browser acceptance covers category creation, test, save/reopen, pause one monitor while another remains enabled, shared inbox and mobile layout. Production claims require exact-SHA canonical release proof. Authenticated Ercon review is read-only and records preserved settings separately.
