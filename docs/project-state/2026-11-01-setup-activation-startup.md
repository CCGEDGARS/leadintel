# Setup activation startup recovery — 1 November 2026

## Observations and reproduced defects

The customer reported the company disappearing after Activate website during a fresh workspace run. In an authenticated separate browser tab, Ercon activation returned readable evidence and a successful save. The URL survived reload, but the activation label incorrectly remained at the empty-website instruction.

Two ordering defects were reproduced using the shipping document and actual app, activation and Setup simplification modules:

1. `website-input-sync.js` removes the retired Additional links panel. If it completes before verified app startup, `bind()` unconditionally accesses that removed node and throws. This aborts registration of the later website-activated listener and other journey controls. An activation can therefore write new evidence without the app adopting that state before later navigation/saves.
2. Activation can render before authenticated app initialization restores the URL input. Restoring inputs did not rerender activation, leaving a saved active website presented as an empty, inactive field state.

The customer's original tab was controlled by another browser session. Its exact event history was not observable; do not claim the original disappearance was reproduced in that tab.

## Change

Make the retired Additional links binding optional. After restoring app inputs, refresh the activation display through its read-only render method. Neither operation reruns research or resets saved workspace data.

## Verification

`customer/test/setup-activation-startup.test.js` fails on the original app and passes with the change. It exercises optional-module-before-verification startup, real activation, in-memory/storage/UI alignment, a subsequent target-market action, and authenticated reload of saved evidence. Related activation, reset, race, isolation and Profile DOM tests also pass (75 tests in the focused run).

Release and authenticated acceptance must be recorded separately from local regression results. No outreach or paid contact lookup is authorized by this fix.

Final local validation: all 5,074 customer tests passed, no skips or failures; `npm run build` passed. The publication attempt was rejected by automatic approval review as private source-code egress without explicit authorization. No production release proof was established for this correction. Publishing and deployment await explicit user approval.

The user subsequently explicitly authorized publishing and deploying this correction. Publication continues through the connected GitHub service because direct Git push has no available HTTPS credentials.
