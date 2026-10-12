# Adjust message actions

Approved labels: Shorten, Rewrite, Reset. Three equal columns in Adjust message, with hover explanations. Reset moves from the editor toolbar into this panel and retains its original recovery handler and protected snapshots. It is disabled during editing, preview, saving or other pending operations.

The editor controller exposes its active adjustment as busyAction. Shorten shows Shortening… only on Shorten; Rewrite shows Rewriting… only on Rewrite. The other actions disable without changing their labels. Update message retains its normal label and cannot run during an adjustment. Progress text names the actual action; body adjustments do not highlight the unchanged subject as updating. Existing validation, failure preservation, cancellation, stale response and Save requirements remain intact.

Mounted regressions cover the three labels, Reset placement/tooltips, each adjustment request's editor_action, button labels and blocking, subject preservation and failure release. The three new cases fail before the change. Existing reset/original tests retain recovery coverage.
