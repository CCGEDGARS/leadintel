# Custom Market Browser-Restoration Hotfix — 2026-09-03

## Problem
Production Chrome still visibly restores the company website into the transient `custom-target-market` field after the v3 value-cleanup guard is deployed.

## Root-cause hypothesis
The browser's restored/autofill rendering is attached to the original DOM control. Mutating attributes and assigning `.value = ""` is insufficient in the affected browser session.

## Fix
Replace the original custom-market control once after startup with a newly-created empty input using explicit market/search semantics. Keep URL/domain rejection and restore Enter-to-add through delegated key handling. Cache-bust the guard to v4.

## Verification
Use RED→GREEN Customer V2 CI, JavaScript syntax checks, exact-SHA Vercel production proof, and live asset inspection before reporting completion.
