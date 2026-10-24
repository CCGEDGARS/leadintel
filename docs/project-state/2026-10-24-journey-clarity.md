# Journey progress and navigation clarity — 24 October 2026

## Root cause and resulting behavior

The journey used `status: current` to represent the selected destination before checking whether its required outcomes were complete. Consequently, opening a finished Messages stage changed its displayed state to “In progress · 6/6”. Completion checked required substeps, while every progress counter included optional substeps, producing “Complete · 2/3” for Setup with optional evidence absent. The next-action hint could then suggest an optional improvement without identifying it as optional.

The journey model now exposes selection as `active`, independently of completion status. Status is `complete`, `in-progress`, `not-started` or `locked`; required counts determine completion and the progress bar. Existing `completed` and `total` counts remain available as total substep metadata, while `requiredComplete`, `optionalCompleted`, and `optionalTotal` describe the separate outcomes explicitly. A stage can be both active and complete.

The sidebar, guide, process dots’ accessible labels, and journey total report required progress. The guide shows optional improvements in their own section and count. Its next action is a button linked to the existing stage/substep route. Incomplete required work takes priority; a completed stage points to a later available stage with required work remaining. Completion without another available required destination displays “Required steps complete”. Optional activity never reopens required completion.

Website completion uses the activation result supplied by the existing process-map caller, rather than the presence of a typed or saved URL. `website-activation.js` already recovers legacy activation proof from a same-company profile and readable saved website evidence; a regression verifies that this recovery still completes Setup without new activation/research.

## Preserved behavior

- Existing module IDs and Companies/Buyers focus routes remain unchanged. Availability and future-stage access checks retain their existing authority.
- Buyers still requires both identified people and an explicitly passed current buyer-quality assessment. Names, research completion, and optional improvements cannot satisfy that gate.
- Journey assessment and navigation add no persisted state, save operation, research execution, message generation, sending, approval, or provider action. Existing draft and selected-recipient data remain the route owners’ responsibility.
- Stage buttons retain `aria-current` for selection; completion has its own class and label. Buttons retain native keyboard behavior. A status refresh restores focused guide, sidebar and channel controls without scrolling the page. The quality action navigates and focuses its existing panel without starting research.

## Validation evidence

The initial eight regression cases in `customer/test/journey-clarity.test.js` failed against the previous implementation, demonstrating the required/optional, active/completion, activation, presentation and focus defects. Those eight cases pass after implementation. Three further cases cover actual next-action event routing, quality-panel navigation without execution, and keyboard stage/substep isolation.

Focused journey, retained-selection, sidebar and message-channel suite: **47 tests passed**.

```sh
node --test customer/test/journey-progress.test.js customer/test/journey-clarity.test.js customer/test/sidebar-saved-work.test.js customer/test/message-channel-navigation.test.js customer/test/company-selection-handoff.test.js
```

Related activation, Profile research, Companies controls, startup verification, Buyers quality supervisor and page-quality suite: **48 tests passed**.

```sh
node --test customer/test/website-activation.test.js customer/test/profile-market-research.test.js customer/test/companies-step-controls.test.js customer/test/startup-verification-gate.test.js customer/test/buyer-quality-supervisor.test.js customer/test/page-quality.test.js
```

`node --check` passed for `journey-progress.js` and `process-map.js`. These are implementation/regression results. No browser/customer mutations, deployment, production proof, or authenticated customer acceptance was performed in this delegated work.

The existing website-activation recovery and race suite also passed: **9 tests**, covering saved legacy proof, matching sources, preserved inputs, and late account/website-change responses.

## Integration and version edges

`journey-progress.js` and `process-map.js` form one runtime contract: the latter now selects `stage.active` and displays required counts. They must receive the same journey-clarity cache revision in the customer shell. `premium.css` needs the corresponding revision for the optional section and actionable guide button. Update the shell’s initial overall and Setup counter text to required counts, so static first paint agrees with the runtime.

`attention-centre.js` passes the journey model indirectly to `attention-centre-model.js`. The reliability workstream updated that consumer to select `active` first (with a legacy `current` fallback) and ignore missing optional steps. Its regressions cover active unfinished work, completed required work with optional gaps, and conflicting old markers. Attention changes and cache revisions are owned outside this workstream.
