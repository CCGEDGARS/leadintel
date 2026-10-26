# Storyselling implementation

Source: docs/policies/storyselling-source-v1.md, supplied and authorized by the user.

Architecture: separate workspace-owned approved story bank, fourteen routing types, server-owned generator rules, deterministic truth/length checks plus independent AI critic. Integrate into Writing Assistant as an explicit working alternative; preserve four canonical templates and Save/approval/send separation.

- [ ] Add schema, card validation, authenticated versioned CRUD, matching and no-repeat reservations based on reviewed draft usage; test isolation, stale revisions, source attribution and all truth classes.
- [ ] Connect server request preparation, approved-card selection, grounded reason, channel limits, literal hard points and second-pass critic (>=16/20, first four all 2). Fail closed with actionable gaps. Test malformed/unsafe output.
- [ ] Add Storyselling controls and card form in assistant, source analysis import with missing fields left blank, explicit approval and deletion. Preserve drafts and context guards. Test with jsdom.
- [ ] Run backend/customer suites and build, document scope/limits; push reviewed feature, merge and verify exact-SHA production chain.

Decisions: user has authorized implementation of the supplied specification; no additional design approval needed. Storyselling is a distinct assistant style, not an alteration of protected templates. Full automatic cadence remains governed by existing explicit flow/send approvals; no new outreach is sent. Source examples never seed factual cards. Translation uses existing source rules and requires native review; hypothetical framing must be language-aware.

Review rulings and fixes: preview consumption is stricter than send-only repeat protection and is explicitly labelled; a server-issued workspace/recipient receipt permits editing the same preview. Automated sending is outside this bounded style integration. Four review findings fixed with regressions: native Cyrillic framing, preserving the entered objection in both passes, objection-aware matching, stable buyer ID before email. Initial unbounded full-suite run exhausted resources and caused timing/Worker failures; rerun bounded to four test files at a time.
