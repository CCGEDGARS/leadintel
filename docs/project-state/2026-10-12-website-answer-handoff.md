# Website → Commercial Brief answer handoff

## Root cause
Website activation saves readable evidence but does not synthesize questionnaire answers. Continue to Profile previously opened Step 2 directly, leaving a new user's answer fields empty until they separately discovered and ran Start company research.

## Correction
The first Continue / Profile navigation now starts the existing bounded company research pipeline before opening the questionnaire. It uses the authenticated workspace AI provider, writes drafts and provenance to the existing state, persists evidence, and opens Step 2. A late-loading support module also prepares a fresh Profile already opened by the customer. Completed research is reused. Failed research retains its explicit retry action. Existing confirmed answers remain protected by mergeDraft.

Unsupported facts remain empty; proposed benefits remain unaccepted hypotheses. AI/provider errors retain saved sources and the existing Settings / Synthesize saved evidence recovery actions. Activation and target-market validation remain prerequisites. No credentials are copied between workspaces.

## Verification
Runtime regression coverage: initial Continue fills commercial fields; confirmed answers survive; completed research incurs no repeat provider calls; activation/market prerequisites; double-click deduplication; provider failure preserves evidence and reason; delayed support loading. Existing synthesis, research, handoff and full customer tests are release gates. Actual authenticated customer-provider output is separate from simulated provider regression coverage.
