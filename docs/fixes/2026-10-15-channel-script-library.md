# Channel scripts and platform-owned masters

## Approved scope
Step 6 offers Email, LinkedIn and Phone call, four core style slots and AI Generated. Script Assistant is the shared optional workbench. Tools contains a channel-tabbed Script Library. Email retains guarded Add to flow; LinkedIn has Copy message in its header; phone has Make a call · Coming soon, which only opens a native dialog. No dialer, recording, automatic call, sending or enrollment was added.

## Authority and ownership
Core scripts are global platform content. Workspace owners are customers, not platform administrators. The script-library API compares the authenticated session user's email with the existing server-only ADMIN_EMAIL setting; no client role or workspace owner role grants core management. Missing configuration denies core writes. The legacy language-original write paths now apply the same platform restriction, including packed customer state and project state.

Existing English email masters and three LinkedIn masters are copied verbatim from their canonical source into the server registry seeds. The normal unchanged email renderer remains authoritative for its established field grammar, omissions, subject choices and evidence rules. Changed or newly approved masters use exact deterministic {{field}} substitution. Missing fields remain marked for review; no AI invents replacement master wording. Deleted records are tombstones and cannot silently fall back to bundled originals. Editing a master retains previous wording and uses expected-revision compare-and-swap.

The owner has not yet supplied four phone masters or a LinkedIn Brutal Honesty master. Their slots say Awaiting approved script. The platform owner can add them in Tools → Script Library → channel → style. Do not invent or label generated wording as owner-approved. AI Generated is an independent working alternative.

## Personal scripts and defaults
Personal scripts and primary preferences are keyed by workspace AND authenticated user. One primary per channel is selected explicitly. Primary applies on an empty new working draft; existing text survives and offers Use my primary. A user's primary takes precedence for their manual preparation, never changes platform content or silently modifies an existing automated flow. Existing flow-specific approved templates remain explicit flow configuration. Core defaults can be restored per channel. Personal scripts can be edited, removed and restored. Existing legacy templates remain available under Earlier saved templates; copies can be saved into the new library through Script Assistant.

## Phone persistence
Phone drafts live separately from existing email/LinkedIn state, keyed to canonical CRM company and contact plus user/workspace. Save uses revisions and records a script.saved CRM activity in the same SQLite transaction. It never sets Contacted, creates flow membership, or sends. Company/contact deletion cascades to phone drafts. Switching channels preserves unsaved phone working copies across refresh in the same browser session; durable CRM storage requires Save. AI responses are rejected after a recipient, workspace, channel, draft, source or evidence change. Phone AI uses the existing workspace-owned provider and active book retrieval. Factual validation and human review still apply.

## Storage and rollout
Migration 0037 creates the registry, personal templates, channel primaries and phone drafts. Record quota triggers include personal/phone payloads; existing CRM activity quota triggers account history. Core history is bounded to 30 previous versions, personal library to 60 records (removed records can be restored). Apply migration before new Worker deployment. The frontend keeps prior drafts when API access fails and reports the problem. Existing assets have new cache keys.

## Verification
Route tests cover owner-vs-platform authorization, cross-user/workspace isolation, channel-specific primaries, stale conflicts, deleted core fallback prevention, quota rollback, phone CRM binding and non-delivery. Mounted UI tests exercise channel switching, missing masters, stale AI responses, primaries, real outreach integration and exact master preservation. Full frontend/backend suites and production build are release gates. Live release status requires exact-SHA release proof; native visual verification is separate from DOM tests.
