# Research activation intent

A prerequisite action in Strategy previously opened Market Research without recording requestedActive. Research therefore made Opportunity-led ICP available but left it Off, requiring a second activation. The unavailable switch was disabled, so it could not record the initial On choice either.

Both the prerequisite button and switching On now call requestIcpActivation. The handler reads pending edits, records requestedActive=true, invalidates Strategy approval, saves and renders the pending state before opening the required research/reference workbench. The normal evidence gate continues to control effective active state. Existing research completion, normalization and Strategy rendering automatically restore effective On when qualifying evidence is available. Missing evidence stays blocked; explicitly switching Off cancels the pending request. No unrelated Off profiles are activated and no research or sending starts without the existing user action.

Pending-state copy explicitly promises automatic activation only when qualifying evidence is available. Tests cover the actual button and switch event handlers, save/reload, automatic activation, failed/no-evidence state, and deliberate cancellation. Existing profile-intent and evidence gates remain in force.
