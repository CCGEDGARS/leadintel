# Intelligence Sources Design

## Goal
Create a permanent workspace-level Source Intelligence layer for LeadIntel. Users can register specific websites, test real public access, see what LeadIntel can actually extract, map sources to buying signals, mark usable sources as mandatory, and include those sources in recurring Market Monitoring.

## Product model
The workflow is **Source Registry → Access Test → Extraction Audit → Trigger Mapping → Mandatory Monitoring → Source Health**.

The user-visible access states are **Full access**, **Partial access**, and **No access**. New sources use the internal/user-visible neutral state **Not tested** until a real audit executes.

A source profile stores: name, canonical URL/host, source type, geography, authentication mode, anonymous access status, authenticated access status, access method, extractable data types, coverage metrics, reliability/health, monitoring enabled, mandatory-source flag, cadence, mapped signal IDs, last access test, last successful extraction, status-change time, and consecutive failures.

## Access semantics
- **Full access** means the configured LeadIntel runtime successfully extracted meaningful public content sufficient for repeatable monitoring. It never means the entire site is downloadable.
- **Partial access** means useful content was retrieved but coverage is limited, sparse, login-walled, or otherwise incomplete.
- **No access** means the configured runtime could not retrieve useful content.
- **Not tested** means no real audit has run.

An audit must preserve actual runtime facts: method/provider used, timestamp, content size, discovered data categories, and failure/restriction reason. LeadIntel must not claim a provider was used unless it executed.

## Authentication
Authentication mode is metadata with allowed values: `public`, `google`, `username_password`, `api_key`, `subscription`, `manual_only`.

V1 audits public access only. It must clearly show authenticated access as `not_connected` unless a sanctioned site-specific API/connector exists. LeadIntel must never collect or store Google passwords or arbitrary third-party browser cookies. Future authenticated integrations must use authorized APIs/connectors or encrypted workspace integration credentials.

## Monitoring
A source can be marked `mandatory` only when its latest public audit is Full or Partial. Mandatory sources are checked in addition to diversified research sources; they never replace the broader source map.

Each mandatory source has its own signal IDs and cadence. The monitoring engine generates site-specific queries from the source host and mapped active signals, records attempted/failed checks rather than silently skipping them, and stores evidence using the existing Market Monitoring evidence/alert pipeline.

Supported V1 cadences are `daily`, `weekly`, and `monthly`, matching the existing scheduler. A later hourly cadence requires scheduler/product expansion and is intentionally not implied by this release.

## Source health
Every audit updates source health. Successful Full/Partial audits reset consecutive failures. Failed audits increment failures and can degrade health. Source audit history remains append-only so access degradation is visible.

## State model
Follow LeadIntel's **Known → Planned → Researched → Verified** discipline:
- Registered source = Known.
- Enabled source + signal mapping/cadence = Planned.
- Audit/monitoring fetch attempted = Researched.
- Extracted evidence with URL/content metadata = Verified.

## UI
Add a Step 4 **Intelligence Sources** panel before/near automatic monitoring. It shows counts for saved, mandatory, and access-tested sources and opens a dedicated modal.

The modal contains:
- Add Source form: URL, name, type, geography, authentication mode.
- Source cards with access badge, anonymous/authenticated access, extraction summary, source health, cadence, mandatory/monitoring state, last tested timestamp.
- Actions: Test Access, Configure Signals, Enable/disable monitoring, Mandatory source, Save changes, Delete.
- Active signal checkboxes are generated from the current Step 4 strategy.

The UI must explain that Google sign-in does not automatically give the LeadIntel backend access to a third-party authenticated session.

## Security
Only `http` and `https` URLs are accepted. Reject localhost, `.local`, link-local and private IP literals. Do not store raw third-party credentials in source records. Workspace membership and owner/researcher write permissions are mandatory.

## Release requirements
Backend and customer tests must cover schema, URL safety, grading, CRUD/audit access control, mandatory source query generation, and UI wiring. Production claims require the repository's release-integrity proof chain, not only deployment readiness.