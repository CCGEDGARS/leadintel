# Storyselling style entry and verification

User authorization: add a Storyselling button next to Professional, NLP, Friendly and Brutal Honesty, connect the existing Storyselling implementation, and verify the process.

Design: reuse the existing approved-card generation/critic pipeline through Writing Assistant. Do not register Storyselling as a protected canonical template or silently replace the current draft. The fifth style opens the assistant, selects Storyselling, loads workspace cards and supplies a changeable generation instruction. The script-library capture handler must pass this button through. Existing Preview → Apply → Save boundaries, reference import, source revision checks, matching, quality checks and no-repeat receipts remain authoritative. Saved exact story drafts display their true style after reopen; selecting a core style restores its normal label.

The alternative of creating a fifth canonical master would bypass or duplicate the approved-card pipeline. A button that merely opens the assistant would leave the style unselected. Neither fits the requested connection.

- [x] Reproduce the missing button with a failing assembled-message regression.
- [x] Reproduce missing direct activation and source-label persistence with failing tests.
- [x] Connect the fifth button, library pass-through and existing assistant controls.
- [x] Add visible empty-bank guidance and preserve current drafts.
- [ ] Run targeted and full customer/backend tests plus the static build.
- [ ] Publish reviewed source, verify exact-SHA CI and production release proof.
- [ ] Exercise the authenticated customer button, card bank and preview states; preserve the saved customer message.

Acceptance limits: real customer examples require factual/sharing approval. An empty bank must explain this prerequisite and preserve the draft. A successful UI test or test-provider fixture is not proof of an actual AI preview using this customer's approved facts. No outreach is sent as part of verification.
