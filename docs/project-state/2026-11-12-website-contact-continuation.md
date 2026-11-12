# Website contact research: bounded continuation and honest coverage

The reported screen had eleven discovered people, three completed coverage checks, four pending people, a thirty-minute pause, and identity/source warnings. The four people requiring review were counted by the API but omitted from the visible summary. Finished research checks did not establish confirmed email/phone ownership.

Two controlled scheduler regressions reproduced execution problems before repair:

- Every wake selected the first person without a terminal coverage status. An interrupted first person prevented later people from being processed.
- A slow source reached the invocation timeout. Its attempt was refunded as interrupted work, so the same page was retried on every wake. Six controlled wakes read the same failed page six times instead of respecting the two-attempt limit.

The worker now checkpoints a rotating contact cursor within the existing ten-person batch. Partial receipts remain on the original person. Each source operation receives its own cancellation signal and deadline with time reserved for saving the checkpoint. A source timeout consumes a bounded attempt; an actual invocation interruption remains resumable. Other pages and people continue. Late responses cannot install source evidence after their operation expires. Shared public search accepts an optional per-query signal without replacing its existing credential/provider cache.

The UI includes the review count, separates completed research coverage from channel confirmation, distinguishes unsearched/incomplete/missing channels, links identity conflicts to their source records, explains disabled paid actions, and exposes affected source URLs with saved attempt counts. It does not infer missing contact details or erase real identity conflicts.

Compatibility and scope:

- Existing job/task/source records and consent settings remain authoritative. The cursor and public failure projections are additive; no database migration is required.
- Existing thirty-minute run, operation, roster and batch bounds remain effective. Resume starts the existing bounded continuation; it does not purchase contact data or send outreach.
- Changes are independent of seller Profile and company industry. Fixtures use synthetic company/person data.
- Rollback can ignore the added cursor/projection fields; saved identities, receipts and contact data remain readable.

Acceptance uses actual authenticated HTTP, the registered `app.scheduled` wrapper, real SQL storage, controlled providers, desktop/mobile browser controls, Stop/Resume and fresh reopen. Negative cases preserve identity holds, paid-channel authorization, source attribution and late-result guards. These checks do not establish the private customer's actual source quality or live provider latency. Exact production release proof is a separate gate.
