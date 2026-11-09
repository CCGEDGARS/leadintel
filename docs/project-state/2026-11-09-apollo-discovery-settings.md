# Apollo discovery and Settings restoration

The customer Apollo key was connected and the free People API Search endpoint worked, but Settings filtered Apollo out and the durable Buyers worker omitted the directory stage. A connection badge therefore did not establish that directory discovery ran.

Company-wide Buyers research now calls the same customer-key, identity-only adapter as the existing HTTP endpoint. Each bounded domain/company-name attempt has a durable task receipt; applied receipt IDs are checkpointed with the candidate and accountability counters. Continuation reuses completed work. Existing queued contacts/review jobs can acquire the missing identities; new identities receive contact research before downstream review. Per-person Recheck retains its scope.

The shared adapter rechecks workspace authority and cancellation around dispatch and response handling. It uses only `/mixed_people/api_search`, never platform fallback credentials or paid contact reveals. Results retain employer/full-identity/role evidence gates and merge with saved official identities. Failures remain visible while public research continues. Apollo directory receipts do not displace source-read evidence or consume contact-phase task capacity. No schema migration is required.

Settings → Data sources now includes Apollo, its blank password input and owner-only connection controls, and a visible free-discovery switch. Paid email/phone permissions and limits remain separate. Opening or saving Settings starts no people search or contact lookup. Existing customer permissions are preserved.

Acceptance covers the actual HTTP start and minute scheduler wrapper, encrypted customer credentials, disabled/unavailable providers, cancellation, bounded attempts, existing identities, continuation and fresh-browser restore. A mandatory Chromium journey clicks account Settings, saves the switch off/on, checks mobile layout, starts Buyers research and verifies exactly one free directory call with zero paid endpoints. Existing Ercon data, research reports and approved English outreach are outside this change.

Rollback is a source rollback: existing task kinds and candidate fields remain compatible. No customer records or saved credentials are migrated or deleted. Production completion still requires exact-SHA CI, deployment and release-integrity proof plus authenticated Settings acceptance.
