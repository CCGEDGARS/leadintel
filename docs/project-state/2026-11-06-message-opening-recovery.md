# Message opening recovery

Observed customer state: page opening failed, recipient remained checking, editor disabled and raw readable fields visible. Earlier controlled tests did not establish customer acceptance.

Reproduced defects:
- A company-records refresh increments the handoff generation but left buyerHandoffPending true. The stale request finally block intentionally cannot clear a newer generation, leaving recovery blocked permanently.
- Page preparation exceeding the ten-second page-check deadline retained opening-failed even after its operation succeeded.

Changes release invalidated pending ownership and revalidate the saved selection after existing recovery work settles. A completed slow preparation refreshes actual current checks; it does not bypass identity, workspace, missing-fact or send gates. No master or saved draft is rewritten. Changed record notifications reset bounded recovery attempts; repeated autosave notifications do not.

Coverage includes a previously failing mounted recipient regression, delayed page completion with remaining failed gates, authenticated Chromium/HTTP/SQL records-refresh recovery, exact draft preservation and existing recipient isolation tests. The customer's specific browser trace remains unavailable; these reproductions explain failure mechanisms, not proof that every observed incident had this cause.
