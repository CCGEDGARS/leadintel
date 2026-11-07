# Find buyers: actionable retry and interaction feedback

The owner reported that the renamed Find buyers control did not act. The owner’s authenticated production session was unavailable; these are controlled reproductions, not a claimed inspection of that session.

Two client paths can make the control unusable: persisted loading flags disable it without a live observer, and a current selected qualified target can fail the automatic qualification gate even on a deliberate manual retry. Progress restoration also needs a final render after the observer releases its busy state.

The button now derives its busy state from a scoped active observer plus its initial command. Explicit clicks may re-research an already selected, current handoff as an unverified target; they cannot import CRM-only history or qualify the company. Automatic callers retain their qualification gate. Authentication, synchronization, buyer-role, backend job revision, channel permission and spending controls remain in place. Requests first reconcile the saved server job. Repeated clicks share the pending operation; failures release the button and show a local card explanation. Transient button state is non-enumerable and is never saved as research evidence.

Shared primary, secondary, text and danger buttons gain hover/pressed feedback, keyboard focus outlines and disabled cursors, with reduced-motion support. Find buyers is the primary action; saved evidence and all contact controls retain their existing policy.

Acceptance: focused client tests cover manual-vs-automatic qualification, stale loading, live observers, failed GETs, duplicate clicks and account changes. A controlled authenticated Chromium journey uses the real HTTP routes, SQLite persistence and scheduler with fixture providers: stale loading → injected 503 → retry → one durable job → terminal saved results → reload. It also checks hover, reduced motion and mobile overflow. This does not prove that external research providers will always return contacts or that the owner's earlier LKAB failure had this exact cause. Exact-release production proof is recorded separately.
