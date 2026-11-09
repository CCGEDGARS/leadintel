# Opportunity-led activates after useful research completes

Owner instruction, 9 November: automatically switch Opportunity-led on when research is done. This supersedes the previous requirement to enable the optional profile manually after a completed run.

Completion now enables the profile when the current research run has finished with new sources, a passing evidence-quality gate and a selected evidence-backed opportunity. Complete and partial-with-useful-evidence runs are eligible; source warnings stay visible. Failed, cancelled, stale, empty or quality-failed runs do not activate it. The unchanged per-company evidence and qualification gates still apply.

The run releases its cancellation/context guard before changing the derived profile selection. The completion callback checks account/workspace/Strategy scope and the exact saved execution ID, then saves the selection and updates the research fingerprint for that derived change. Strategy is still awaiting review; no automatic strategy approval, sending, provider lookup or monitoring activation is added.

A completed-run marker belongs to the core market-state schema, so it survives cold loading before the optional ICP UI extension loads. It prevents a replay of the same completion from undoing a subsequent manual Off. Another successful research run enables the profile again. Existing names, definitions, markets, buyer roles, exclusions, offers and unknown commercial values are retained.

Regression coverage includes lifecycle guards, cancellation, stale scope, empty/failed/low-quality research, normalization before the optional module loads, manual Off/replay/new-run behavior, and different seller contexts. Authenticated SQLite/HTTP browser cases verify automatic On, a non-stale research context, cloud saving, failed cloud-save recovery and fresh-browser restoration. The controlled positive research fixture includes publication dates and distinct source categories so it passes the actual evidence-quality gate; no thresholds are weakened.
