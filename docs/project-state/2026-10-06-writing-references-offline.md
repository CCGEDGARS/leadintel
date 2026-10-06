# Writing References — storage-independent checkpoint

## Resumption and billing boundary — 6 October, 18:19 Europe/Riga

The user requested resuming Writing References and making it live, while deferring the broader customer-owned billing/storage/CRM integration task until the end. This does not rescind the requirement that other customers' paid usage must not silently use the owner's accounts. First-party storage setup may support the owner's workspace acceptance; do not infer authorization to open owner-funded document processing/storage to every workspace. Before general availability, enforce an explicit storage entitlement/connection boundary and workspace-owned AI credentials. Customer-owned Cloudflare/D1 and optional Google Drive connectors remain future work, not implemented capabilities.

The user completed R2 activation and bucket binding through the Cloudflare dashboard. The 18:33:44 screenshot shows the production leadintel-api Bindings table containing `WRITING_REFERENCES_BUCKET` linked to `leadintel-writing-reference` (singular). Local wrangler.toml now matches that observed bucket name. This is dashboard configuration evidence only; authenticated object operations and end-to-end feature release are not yet verified. The existing upload/extraction/UI implementation remains local and disconnected.

Branch: feature/writing-references-offline. Worktree: /workspace/scratch/5e95ab368a62/leadintel-writing-references. Product entry points are unchanged: the cards are not mounted in production and no generation routes use these modules yet.

Implemented locally:
- Pinned PDF.js 6.4.299 dependency and private-to-project static bundling, not an external CDN. Real text PDF extraction preserves page locations and reports empty/image-only/mixed coverage. Unicode TXT/Markdown preserve line locations. Enforce 20 MiB, 600 pages and 2 million extracted characters; reject invalid MIME/signatures/UTF-8 and password-protected PDF. Original bytes are copied for parsing, not modified.
- Server validation recomputes extracted text from original bytes rather than trusting client-provided guidance. Node execution is tested; Cloudflare Worker PDF compatibility is not proven and may require the private extraction worker allowed by the plan.
- Bounded overlapping chunking packs short sections to avoid one provider request per line, keeps original section locations in analysis input, validates structured technique responses and source locations, aggregates duplicate ideas and selects active Ready-source guidance inside a prompt budget.
- Generation-context boundary ignores protected and numbered styles, requires scoped server-owned records, rejects foreign-workspace records, and detects reference changes during generation. This is a tested storage-adapter contract, not a connected authenticated production endpoint.
- Three-card responsive UI component with upload/replace, explicit activation, optional instruction, summary/coverage, confirmation/cancellation of deletion, readiness gating, duplicate-mount protection and ignoring late responses after disposal. Tests use real jsdom DOM plus an API fixture; no actual uploads/deletes occurred.

Verification notes:
- Extraction/schema/context/UI regression tests were written before implementation; line-packing and multi-section provenance defects were reproduced with failing behavior tests before fixes.
- Full customer baseline: 1,804 passed. PDF bundling initially broke the existing bounded-deployment fixture; bundling is now conditional on the extractor being present and the full suite subsequently passed.
- A later parallel customer/backend run exposed the existing 500 ms Discovery provider-failure fixture's timing sensitivity: it reached the global timeout instead of the expected provider-failure status. No Discovery product code was changed. Re-run the customer suite without simultaneous backend load and record its final result before commit.
- Final independent full runs: 1,815/1,815 customer tests and 442/442 backend tests passed; build and diff checks passed. This adds 21 tests over the baseline. The timing-sensitive fixture passed when the customer suite ran without simultaneous backend load.

Not implemented/proven yet:
- R2 provisioning, private storage records/routes, database migrations, durable processing leases/retries/cleanup, real provider analysis, conflict-aware technique composition, authenticated message-route wiring/provenance and live card integration.
- Actual persistent deletion of originals and all derivatives. The current UI calls the storage adapter; only that interaction is tested.
- Production release, real upload/analysis/generation acceptance, mobile/desktop screenshot inspection and independent final feature review.

Next: connect authorized private storage, complete Tasks 2/3/4/5 end-to-end using the approved spec/plan, verify Worker/extraction service compatibility, then run the full release and authenticated acceptance gates. No conversation attachment was used as a writing source.
