# Universal monitoring inbox and reviewed automatic messages

## Outcome

The owner approved implementing the shared monitoring proposal and added automatic message formatting/delivery. Retain the existing JavaScript/Cloudflare/D1 stack. One workspace configuration supports a selected purpose, multiple public sources and the existing four/twelve-operation budget. Do not silently change Ercon's enabled legacy monitor or send real outreach during acceptance. The owner opted out of routine questions; implementation choices below are engineering decisions under that delegation.

## Shared workflow

Sources → observed events → explicitly identified subjects → relevance/review → Monitoring inbox → company research, person/case review, procurement task or formatted message. A person is never stored as a fake company. Public-source involvement is evidence of the event, not evidence of purchase intent or a need for representation.

Supported purpose templates: existing buying signals (backward compatible), Hiring, Court cases, Procurement and Custom events. New templates support indexed discovery or direct public page reads. Source-specific labelled metadata is parsed conservatively; missing employer, party type, dates or contact information stay missing and require review. Restricted/login-only content is an access gap, not a verified finding. Unknown websites do not acquire a claim of tested source compatibility. No restricted scraping, private-person enrichment or paid contact confirmation is introduced.

Every finding retains source URL, source excerpt, event/reference key, dates, subjects and roles, explicit relevance reasons and gaps, content fingerprint, revision, observed time and state. Changes to the same event/URL create a retained version and an inbox update; unchanged re-reads remain quiet. Hiring uses skill/role terms instead of forcing the seller's service phrase into a vacancy query. Court and procurement templates recognize case/notice references, roles and labelled hearing/deadline dates. Criteria/exclusions are workspace settings, never customer defaults. Relevance is separate from verified company fit, outsourcing intent, eligibility and contact readiness.

## Storage and compatibility

Extend the existing configuration with versioned workflow JSON. Existing rows normalize to legacy buying-signals behavior, alert-only delivery, and no automatic migration of sources or thresholds. Add workspace-owned findings, immutable event versions, independent subjects and message records in migration 0071, with revision/ownership guards and storage accounting. Existing monitoring evidence/alerts and Messages' alert loading remain available.

Reuse the current registered monitoring scheduler, saved Strategy gates, native Firecrawl credentials, run budgets, leases, membership checks and query cursors. New direct-page reads count toward the same budget. Recoverable source failures preserve other useful checks; authorization/context failures stop writes. All writes must verify the current workspace/configuration/source version. Rollback preserves old alerts/configuration and ignores added data; additive tables are not dropped.

## Interface and routing

A global Monitoring button with an unread count opens the shared inbox. The Profile monitoring card links to the same inbox. Filters distinguish New/Reviewed/Dismissed and finding type. Cards show event, subject, date/deadline, relevance and uncertainty, source and next action. A detail view supports subject/name/role/official website review, source confirmation, permitted contact details and person-specific publication/contact review. Organizations can be passed into existing target-company/Companies research without fabricating qualification; individuals remain independent reviewed subject records.

Settings expose purpose, read mode, matching/exclusion terms, next action and message mode. Message modes are Alerts only (default), Prepare saved format, and Automatic delivery of approved messages. Existing monitors keep Alerts only. The inbox includes message preview and delivery status; paid contact actions and manual approval boundaries remain separate.

## Message and delivery contract

Use deliberately selected saved personal templates, preserving their literal format. Protected system/core templates are untouched. Render only supported placeholders from reviewed sender/subject fields and source-backed event facts; unknown fields block preparation rather than inventing a value. No model may follow instructions embedded in a source page.

Automatic delivery is an optional capability, not a live-send authorization from this implementation request. A message must bind the reviewed subject identity and email, event revision, saved-template fingerprint, monitor revision and approving workspace owner. Private individuals require explicit per-record identity, publication/contact permission and message review; no automatic enrichment or first-contact send from a court mention alone. Unsupported or potentially sensitive case contexts remain held.

Reuse native Gmail connection/token and delivery acceptance/idempotency helpers. Delivery obeys deployment-level automatic-mail mode, workspace automatic mode, emergency stop/pause, sending windows and shared daily limits, suppression and recipient freshness. Reserve durably before dispatch, record provider acceptance separately from local synchronization, and never retry an ambiguous submission as a fresh message. Monitor pause, deletion, changed source/template/recipient, revoked membership and replied/suppressed contacts stop pending sends. No follow-up sequence is invented. Scheduled delivery must run without an open browser through the registered application scheduler.

## Alternatives and chosen boundary

Adding customer-specific branches to the existing score was rejected because it would keep company-only records and incorrect URL-only updates. A separate app per vertical was rejected because it duplicates scheduling, evidence and delivery controls. The selected approach adds a shared event/inbox layer with explicit template extraction and actions while preserving the existing workspace-level monitor and native delivery infrastructure. Multiple independently scheduled configurations per workspace and authenticated-site connectors are outside this bounded release; the UI must not imply them.

## Acceptance

Use synthetic hiring, civil-court and procurement sources plus an unfamiliar custom source. Prove real authenticated HTTP/SQL, updates at the same URL, deduplication, unknowns/restrictions, workspace isolation, revision races, pause/reopen, organization intake, independent person review and exact message-template preservation. Prove blocked/unapproved/suppressed/stale/duplicate/ambiguous sends and one controlled accepted automatic send through the registered scheduler. Preserve the existing full monitoring journeys and customer/backend suites. Obtain exact-SHA CI/manifest/health/smoke proof separately. Real Ercon settings can be read/reopened within the owner's explicit Firecrawl authorization; new court/tender source compatibility and actual live sends remain unproven unless separately observed.
