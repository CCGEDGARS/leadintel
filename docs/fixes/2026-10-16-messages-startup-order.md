# Messages reopening: initialization order and repeated rendering

## Reproduced cause

An authenticated workspace saved at stage 6 started Messages immediately from
`initialStage()`, bypassing the account verification gate already used by the
main app and Discovery. Messages initialized before Discovery published its
shared selection API. Repeated context reads therefore repeatedly reconstructed
saved Discovery data. The closed Writing Assistant also rebuilt its controls
and rechecked readiness separately for each action. InMail and channel rendering
re-read the same expensive adapter context several times per synchronous render.

Browser timing on the affected saved workspace showed about 54 seconds before
session completion and about 79 seconds before verified UI completion. Messages
initialization alone took 31.9 seconds. Local storage decoding was about 0.2
seconds total; native reads and writes did not explain the delay. Clearing RAM
or browser storage is not the repair and risks losing unsynced work.

## Changes

- Restore the initial Messages stage only after account verification, so shared
  Discovery initialization completes before the asynchronous Messages module.
- Read readiness once per assistant render and context once per channel/InMail
  render. These snapshots end synchronously; the next render/action sees fresh
  workspace data. Existing async race and send guards remain authoritative.
- Defer the closed assistant's optional rendering until it opens. Controller
  state is preserved and opening renders the latest state.
- Remove temporary diagnostic wrappers used to attribute the delay.
- Retain the separately reproduced bounded asset-token scan repair.

No approved wording, source evidence, working drafts, workspace keys or storage
records are intentionally removed. No outreach is sent.

## Evidence and limits

After the ordering fix, the same browser reached verified UI completion in
5.37 seconds instead of approximately 79 seconds. With per-render reuse this
was 5.97 seconds and Messages initialization fell from 12.26 to 5.28 seconds.
The final closed-assistant deferral is covered by a mounted UI regression test.
Focused startup/render tests cover delayed initialization, reopened drafts,
channel/contact isolation, fresh readiness and preserved assistant state.

The browser also reports a saved-version conflict with unavailable baseline.
Both versions remain preserved; this repair does not automatically choose one.
The repository CI was already failing before this work. A successful build or
browser timing does not satisfy the required exact-SHA release proof. Production
status remains unproven unless the complete release-integrity gate passes.
