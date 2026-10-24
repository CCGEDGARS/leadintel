# Delivery spacing implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the five reported Delivery areas adequate space and consistent controls.

**Architecture:** Scoped CSS in delivery.css and outreach-automation.css with semantic labels/wrappers in delivery-ui.js. Keep runtime action logic untouched. Refresh the existing lazy loader chain to fetch revised assets.

**Tech Stack:** Existing vanilla JavaScript, CSS, Node customer tests and Vercel/Worker release verification.

**Spec:** docs/superpowers/specs/2026-10-24-delivery-spacing-design.md

## Global constraints

- Preserve IDs, approval, recipient selection, sent history, CRM and activation state.
- No actual send, contact blocking, automation activation or paid calls during verification.
- Keep edits scoped to the reported Delivery panels.

## Review focus

- Long recipient addresses and history options fit their grid track.
- Narrow screens stack actions and fields without horizontal overflow.
- Hidden provider actions stay hidden after styling.
- Reply/outcome locks and history selection keep their existing behavior.
- Old cached loader edges fetch the revised Delivery assets.

## Task 1: Consistent Delivery fields and spacing

- [ ] Add an accessibility regression for associated history/reply labels and descriptions; observe failure before markup changes.
- [ ] Add semantic wrappers and explicit labels, keeping IDs and listeners.
- [ ] Apply scoped section gaps, 48px controls, full-width history picker, larger reply area, separated reply footer, and responsive suppression/mailbox spacing.
- [ ] Version revised CSS and its parent loader edges.
- [ ] Run focused and complete customer tests, build and diff checks. Review the branch.
- [ ] Publish, inspect authenticated production layout, and require exact-SHA PROVEN release evidence.
