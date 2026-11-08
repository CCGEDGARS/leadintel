# Unchanged assistant text still needs current-context review

The real Continue action revealed an optimization outside the apply adapter: it skipped the save whenever text/provenance matched an earlier CRM acknowledgement, even if meeting settings or a pending proposal had changed. The correctly repaired apply adapter was therefore not invoked for unchanged text.

An assistant copy counts as already saved only when text/provenance, current settings, reviewed business context and absence of a pending proposal agree. Otherwise explicit Continue uses the existing validated save path. A second Continue for the same reviewed version remains idempotent. General writing, phone and InMail keep their separate ownership paths; approval and sending remain separate.

The regression fails on the stale unchanged-text case before the fix and covers the acknowledged current version, changed context and pending proposal. Remaining acceptance: exact CI/proof and actual unchanged Continue → approval/Delivery without sending.
