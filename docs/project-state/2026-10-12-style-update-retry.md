# Style selection and Update retry — 12 October 2026

Keep automatic preparation on explicit style selection, including reselecting the same style. Update message is the manual retry and refresh action. Opening a recipient or a saved message remains governed by the existing non-destructive preparation rules.

Two failure causes were reproduced: failure handlers restored the previously applied style, so Update could retry that style rather than the requested style; failed field preparation also immediately started subject research and disabled Update while that unrelated request ran.

Failure now preserves the requested selection and the previous subject/body/original, reports the difference between selected and applied styles, and points to Update message. Failed field preparation does not launch follow-on subject research. Successful preparation keeps that research path. Existing timeout, stale response, workspace/recipient ownership, editing, synchronization and approval guards remain intact. Save, flow and send are separate actions.

Regression: provider failure followed by the actual Update message click for all four core styles and AI Generated, including a second failed attempt with no loop/data loss; successful NLP retry; existing interruption and changed-facts tests. The five new cases failed before the fix and passed afterward.
