# Profile market research ownership — 1 October 2026

Approved flow: Profile holds customer examples and market research; Strategy reviews evidence and chooses ICPs, buying signals and opportunities; Companies finds prospects and optionally accepts known company lists.

## Delivered structure

- Rename the Profile customer card to Customers & Market Intelligence with separate Reference Companies and Market Research explanations and Explore customers & market action.
- The manager exposes Reference Companies and Market Research. Transfer the original research workbench into its market panel, preserving one instance of each existing mode, preview, settings, custom websites, progress and errors. No new engine or duplicate controls.
- Quick Overview, Market Research and Deep Analysis retain their existing limits, evidence gates, confirmation preview and authentication requirements.
- Show a prerequisite and Profile action when no company profile exists. Opening the panel never starts research.
- Strategy retains research findings, opportunities, ICP/signal choices and activation; Update market research returns to Profile. Review findings returns to Strategy.
- Move research progress and its navigation into Profile. Strategy's guide now describes decisions rather than research setup.
- Remove Target Companies from default Profile tabs. Preserve all target-company data and import/editor logic, reachable from Add or import known companies in Companies.
- Preserve reference publishing, activation, similarity models and existing discovery integration. References remain examples, never automatically become prospects.

## Lessons and regression protection

The previous UI separated customer context from the market research that explains a new market, and implied that users needed an existing prospect list before entering Companies. The fix changes ownership and navigation together, instead of only renaming a button. Cache identifiers travel with owning loaders. Reopening the manager reuses the same DOM controls so app handlers, preview and progress survive.

Tests cover actual node reuse, prerequisite visibility, navigation without starting research, singleton event installation, one owner for the three controls, preserved findings/activation, and the location of checklist research. Existing persistence, activation, target import, discovery and handoff checks remain in the full suite.

## Verification boundary

Required before completion: full customer test suite, static artifact build, CI for exact published SHA and production release-integrity PROVEN verdict. Browser checks cover visible tabs, prerequisite, navigation and layout using the separate browser fixture. They do not certify the user's authenticated workspace or a new paid research run. Previously deferred evidence gaps remain deferred to final review; no provider/research-engine expansion in this interface change.
