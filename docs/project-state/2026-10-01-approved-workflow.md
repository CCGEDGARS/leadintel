# Approved automatic workflow

User decision: configure and review each stage manually; final approval enables automatic execution within those rules. Users can pause, stop or take over manually. No outreach was sent during implementation.

## Implementation

- New **Workflow automation** control in the customer sidebar opens a same-page review dialog. Existing manual stage controls remain available.
- Eight approval snapshots: company profile, market strategy, company discovery, buyer selection, buying signals, message template, CRM persistence, delivery/follow-up. Profile and strategy must first be approved in the normal journey. Owner-only final approval; other members can view.
- Step 2 confirmed answers, selected markets and activated reference models feed the same targeting/qualification engine used by manual discovery. No customer name or industry fixture becomes a runtime default.
- Configuration and source-context fingerprints invalidate approvals after changes. Changed template settings retain valid upstream approvals. Stale revisions return a conflict.
- Durable workspace-scoped D1 workflow and run records; unique active run, atomic execution lease, stage checkpoints, explicit blocked/error states. Expired leases require review/retry instead of replaying ambiguous provider work automatically.
- Hourly server scheduler runs approved daily/weekly cycles, independently of the browser. Market research uses Firecrawl search plus extracted page text and company-level follow-up. It reuses the customer engine’s exclusions, market/offer fit and active signal checks. Missing source dates cannot qualify automatically.
- Buyers use role-matched verified CRM work emails, optionally Apollo company search and one enrichment per qualified company. Personal emails, waterfall enrichment and phone lookup are off.
- Messages insert verified values into the user's exact approved template. This version does not generate new AI wording or translate templates autonomously. Unknown placeholder values block the run.
- CRM stores companies, contacts, evidence, scores and message snapshots compatible with the manual Scripts restore path. Existing customers, archived/suppressed companies and already contacted recipients do not receive new initial outreach.
- Delivery reuses the existing exactly-once Gmail queue, windows, limits, reply stopping and suppression engine. Workflow queues are linked to the specific run/revision and cannot send until that run is completed and its approval is still valid. Delivery-setting edits invalidate final approval.
- The scoped `APPROVED_WORKFLOW_DELIVERY_MODE=enabled` capability allows only workflow-linked approved messages; legacy standalone automatic Gmail remains `manual_only`. Merely deploying does not approve or activate a workspace.
- Default reviewed limits: 3 companies, 4 market queries, score ≥70, dated evidence ≤90 days, 5 emails daily, weekday 09:00–17:00 UTC, 8–18 minute spacing. Optional single follow-up after 3 business days. Research/qualification may produce zero matches; that is reported, never filled with invented companies.

## Control behavior

Pause/manual takeover prevents subsequent automatic actions; completed data remains. A provider call already in flight may finish, and sent mail cannot be recalled. A stage interrupted with uncertain provider usage blocks and requires an explicit retry after resume. Stop cancels linked active sequences and running/blocked workflow runs. Manual generation/approval does not itself activate automatic delivery.

Run now executes the same server controller. Scheduled execution is independent of the browser; an interrupted manual request is protected by the durable lease/checkpoint rules. Current scheduler checks hourly; activation is not a promise of immediate sending.

## Verification boundaries

Meaningful SQLite integration tests cover approval order, final approval, invalidation, stale revisions, isolation, pause/manual takeover, retries, expiry, revoked ownership, cadence and native research → verified buyer → template → CRM → scoped queue → exactly-once send with mocked providers. Provider mocks are not evidence of real customer Firecrawl, Apollo, OpenAI or Gmail success. Authenticated customer provider verification remains the final acceptance step, per the user's instruction.

Release is subject to exact-SHA CI, production migration/deploy and release-integrity proof. No production claim is made by this document alone.

## Local validation

384 backend tests and 1,355 customer tests passed. Customer static build and Wrangler Worker dry-run build passed. The native end-to-end test uses mocked external providers; no real email was sent. Additional regression coverage verifies that renewed approval after a source-context change creates a new revision, stops the old run and cannot reuse old stage results. Delivery UI delegates to the shared workflow controls rather than displaying a contradictory standalone sending state.

A client isolation regression also verifies that controls loaded in one workspace cannot mutate a newly selected workspace, and late responses cannot render another workspace’s data.
