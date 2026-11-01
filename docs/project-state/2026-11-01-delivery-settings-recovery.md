# Delivery settings startup recovery — 1 November 2026

The owner reported Setup's Automatic plan remaining disabled at “Loading delivery settings…” and asked whether paid contact permissions should reset on browser refresh.

## Observed and reproduced

Using Retry delivery settings restored both Manual and Automatic plan controls in the authenticated workspace. Both paid research permissions were OFF. No sending or paid permission was activated.

Delivery UI includes Gmail connection state in its account/operation authority. An asynchronous mailbox-status update invalidates the pending policy load, or invalidates an already loaded policy when next rendered. The UI was not listening for `leadintel:gmail-status`, so it never initiated the replacement read and could stay loading indefinitely. Tests reproduce both before/after-policy-load orderings on the old implementation.

## Correction and scope

Refresh delivery preferences on mailbox-status changes through the existing context-guarded read path. Keep stale-response rejection, owner checks, workspace/user isolation, and sending activation gates. Bust the lazy-loaded UI cache.

A browser refresh must restore saved preferences. It must not restore defaults or enable paid research. The existing explicit paid toggles persist independently to the server; no paid-permission defaults, reset semantics, policy settings or delivery mode are changed by this correction.

## Validation

120 focused tests passed, including the new mailbox-order regressions, delivery permissions and authority, account/workspace isolation, and independent paid email/phone save/reload without paid lookup or sending. `npm run build` passed. Production CI, release proof and authenticated reload acceptance are separate release gates.
