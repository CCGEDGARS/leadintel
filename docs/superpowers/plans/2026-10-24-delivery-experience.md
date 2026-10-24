# Delivery experience implementation plan

> Native execution in this session, under the repository's autonomous-completion rules.

**Goal:** Make Delivery readable, actionable and connected to confirmed sends.
**Architecture:** Keep delivery-ui, conversation-ui and outreach-automation-ui ownership. Correct legacy automation CSS, add honest status/recovery, compact empty learning and navigation actions.
**Tech stack:** Existing vanilla JS/CSS, Node test runner, jsdom, Vercel/Worker.
**Spec:** docs/superpowers/specs/2026-10-24-delivery-experience-design.md

## Constraints

- Preserve send confirmation, suppression and workspace isolation.
- No actual outreach or automation activation during checks.
- Cache-bust every changed runtime boundary.
- Release proof must be PROVEN for the exact merged SHA before completion claims.

## Review focus

- No approved package: navigation leads to Messages without sending.
- Confirmed send: UI reloads persisted state and conversations without resetting edits.
- Disconnected Gmail: no claim that monitoring is active.
- Failed policy/suppression fetch: show unknown/error, preserve workspace boundaries.
- Mobile and keyboard users: readable contrast, focus and no horizontal overflow.

## Tasks

- [ ] Add failing runtime regressions for navigation, learning, conversation send-refresh, mailbox state and policy/suppression recovery.
- [ ] Implement light automation cards and delivery hierarchy, status navigation, compact learning and confirmed-send refresh.
- [ ] Run focused regressions, full customer suite, backend suite and static build. Inspect desktop/mobile UI.
- [ ] Document root causes/checks, publish branch/PR, require CI, merge and prove exact-SHA production.
