# ERCON Strategy QA — 2026-10-12

Scope: screenshots of Stage 3 Strategy following confirmed saved ERCON profile. All findings are visual observations, not automatically verified defects.

## Decisions
- Website monitoring must be **collapsed by default on each page opening**, without toggling enabled state, deleting input or interrupting active schedules. Header always shows actual On/Off status. Expand to edit URLs, frequency, depth, alert score and history.
- Any other monitoring or preferred-sources surfaces should avoid duplicate full controls. Keep one editor and optional navigation shortcut.
- Preserve all approved ERCON evidence, saved reports, signals and current settings. No paid research call or outbound action as part of QA.

## Findings
| ID | Priority | Observation | Acceptance |
| --- | --- | --- | --- |
| STR-01 | P2 | Monitoring large expanded panel distracts from Strategy | Collapsed by default; status visible; open/close retains state and data |
| STR-02 | P2 | Monitoring controls visible as a large panel and again in 'Optional preferred sources and website monitoring' | One canonical editor, no conflicting copies |
| STR-03 | P2 | Four active buying signals each High / weight 9 | Provide meaningful differentiation guidance, keep user overrides |
| STR-04 | P2 | Core ICP commercial value field blank despite otherwise complete strategy | Nonblocking informative validation |
| STR-05 | P3 | ICP variants repeat market, offers, roles and exclusions in full | Compact inherited-field display preserving editability |
| STR-06 | P2 | Strategy 4/4 steps complete while stage says 'In progress' | Make the status and progress meaning explicit |
| STR-07 | P3 | Tender-exclusion warning repeated across profile and strategy | Single contextual alert per stage, no hidden qualification |
| STR-08 | P2 | Horizontal scrollbar visible in screenshot | Verify viewport responsiveness and any overflowing child |
| STR-09 | P2 | Sweden priority score 79/100 with Medium confidence may be conflated | Explain scoring and evidence confidence separately |

## Positive observations
- ERCON context, Sweden, 4 signals, saved market research reports (2), active Core and Trigger-led ICP appear carried across.
- Website monitoring shown Off, frequency Weekly, depth Deep, minimum score 70. Do not interpret these defaults as a live scheduled job.
- Customer profiling variants have distinct purpose and toggle states; no underlying scoring defect proven.

## Verification plan
1. Identify the canonical monitoring DOM node and its initialization, persistence and teardown.
2. Add deterministic UI test: hidden/collapsed by default, status remains accurate, expanded settings persist, disabling only through explicit toggle.
3. Check duplicate control surfaces, progress labels and horizontal overflow.
4. Run customer regression suite and preview acceptance; do not merge/deploy without tests.

## Final UX decision — 2026-10-12
- **One Lookalike Customers card only.** Merge the customer-facing 'Lookalike ICP' and 'Lookalike-led/Past Customer Context' descriptions into one understandable capability. Maintain reference-company evidence, legacy state compatibility, and existing scoring/Discovery behavior; do not simply remove backend logic.
- **Preferred Sources and Website Monitoring are separate capabilities, not two full editors.** Preferred Sources stores selected URLs and their source intelligence; monitoring schedules checks and alerts. Existing `customer/intelligence-sources-ui.js` has an authenticated workspace API, source list, monitoringEnabled and settings UI. Verify actual live status and exact monitoring handler before declaring end-to-end activation.
- Strategy navigation should have compact expandable 'Sources & Monitoring' with separate subcontrols and clear On/Off states, default collapsed; no duplicates and no auto paid research.
- Test preexisting active Epiroc reference: one Lookalike display should show the reference without silently changing targeting enabled choice.
