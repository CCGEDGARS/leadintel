# Reference list save stability — 1 October 2026

Customer screenshot shows an already saved, analyzed and active reference list labelled Unsaved changes. This is a reference draft comparison issue, separate from the workspace sync indicator.

Root cause: normalization rebuilds active DNA using a fresh builtAt timestamp. Draft comparison normalizes the editor and saved reference independently; clock differences create false edits. Previous comparisons could pass accidentally within the same millisecond.

Fix: normalization retains the original DNA timestamp (or recorded activation/analysis time), and draft comparison excludes only derived DNA build timestamps. Existing records with differing derived timestamps recover without discarding their references. Notes, rows, research facts, opportunity maps and activation changes still participate in comparison.

Regression covers analyzed active references, save/JSON reload, differing DNA timestamps, normalization idempotence, genuine notes/research edits and subsequent saves. Asset imports and shell cache boundaries are invalidated. No customer data is deleted or replaced.
