# Strategy signal deletion and source placement

User report: recommended buying signals could be added but not removed; a redundant Optional preferred-sources/monitoring section remained on Strategy.

Root cause: removeSignal spliced the current list, then renderMarketStrategy called ensureMarketStrategySeeded. normalizeSignals unconditionally merged the profile's recommendations back into the list. Deletion was undone in the same render and after reload.

Fix: workspace-local deletedSignalIds persist through market normalization, localization, profile reapproval, context edits, and explicit recommendation refresh. All four reseeding callers honor them. Deleting clears strategy approval, preserves research evidence, and records the latest removed signal for an Undo action that also survives reload. Other active/off choices and custom edits are preserved. The twenty-signal limit now reports a real failure rather than silently truncating a successful addition.

Preferred Sources remains available with its existing controls and listeners, inside Website Scanning > Monitor websites. It waits for that host rather than creating a duplicate Strategy section during startup. Scanner mounting also mounts source controls, independent of module arrival order. No saved sources are deleted.

The black arrow with blue glow in the supplied screenshots follows browser cursor movement and has no app DOM overlay or custom cursor asset; it is the browser automation cursor highlight, not a LeadIntel control. Park it outside content when completing browser checks.

Regression coverage: recommended/custom removal, empty list reseeding, reload/localization, undo, workspace isolation, invalid IDs, twenty-signal capacity, actual Strategy renderer, source placement/idempotence, and delayed host creation. Full suite, build, exact-SHA public release proof and signed-in browser checks are required before reporting completion.
