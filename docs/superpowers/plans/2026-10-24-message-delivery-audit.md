# Message and Delivery audit fixes

User authorization: “take ower and finish” after the four confirmed findings. Execute in this fresh checkout on `feature/message-delivery-audit-fixes`; retain template text and explicit sending approvals.

## Design

Extend the existing delivery model rather than replace the application or add a parallel delivery service. Identify an approved package by domain, buyer, channel and approval revision; identify a send by that package plus recipient. Preserve domain for company rollups and backwards compatibility. Legacy records match only the same recipient; ambiguous legacy reply operations fail closed. Retain all records and activity across normalization and workspace save/reload. Meeting intent advances to Replied; only recorded outcomes count as meetings. A provider-confirmed send stays successful if subsequent recording/saving fails, with synchronization pending clearly reported.

## Tasks

- [x] Add failing regressions for separate buyers/revisions, duplicate confirmation, legacy restore, >50 sends, reply attribution and meeting intent.
- [x] Implement delivery identity/retention and exact selection in Messages → Delivery, provider sending, manual replies/outcomes and automation handoff. Keep company-level pipeline rollups.
- [x] Add failing provider regressions for a confirmed Gmail/Microsoft send followed by failed workspace saving; preserve sent status and prohibit resending through the same approval.
- [x] Verify UI selection/save/reload, complete customer suite, syntax/build and review the diff. Record root causes and evidence.
- [ ] Publish via the repository’s existing release path and require exact-SHA CI, release manifest, backend health and release proof. Report authenticated customer testing separately.

## Review focus

Two approved buyers at one domain; old domain-only records; newly approved revision after an earlier send; delayed provider response after workspace switch; successful email with a failed local save. No real outreach is authorized by this implementation task.

## Verification and release state

Final customer suite: 3,637 passed, zero failures. Static build and changed JavaScript syntax checks pass. Independent review findings were covered by regressions and corrected. Publication to the public `CCGEDGARS/leadintel` repository was rejected by automatic approval review pending explicit destination approval. No branch, pull request or production deployment was published in this session.
