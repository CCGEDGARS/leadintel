# Buyers selection starts research

## Root cause

The Companies selection actions saved the company and handed it to Buyers but never called identity discovery. The three-action toolbar renamed the initial action to Refresh. The quality panel rendered 0/4 confirmed emails before any research and its quality action called contact research even with no identities. Atlas Copco reproduced this in the authenticated customer workspace.

## Corrected contract

- An explicitly selected fresh company starts the existing bounded identity and public-contact workflow and opens Buyers. This uses the existing provider permissions; it grants no Apollo/Hunter reveal permission and sends no outreach.
- Rendering, reloading and reselecting saved, attempted or populated research do not automatically spend another research run. Refresh remains the explicit retry/update control.
- With no retained full identities, the quality action starts/retries buyer discovery. The panel distinguishes unstarted research, active research and an attempted search with no retained identities. An unstarted run is not a zero-email outcome.
- Preflight rejection or an unexpected start failure remains a visible, retryable error. Completed evidence and CRM history remain protected.
- Refresh and Save stay disabled through public contact research, and the identity handler rejects overlapping requests. Progress stays visible while contacts are checked.

## Verification

Regression coverage: new selection invokes the real handoff, duplicate selection, retained/attempted runs, missing authentication, synchronization conflict, removed selection, rejected/failed start, no-identity quality routing and overlapping contact checks. Existing company actions, workspace normalization and CRM evidence retention remain covered.

Authenticated reproduction: the original idle Atlas Copco card began research after Refresh and displayed four priority buyers plus a potential buyer. This proves the earlier blank card was an unstarted workflow. Names displayed do not prove geographic suitability, buying authority, published email availability or completion of the mandatory research/AI checks. Contact results must be reported separately from release tests.
