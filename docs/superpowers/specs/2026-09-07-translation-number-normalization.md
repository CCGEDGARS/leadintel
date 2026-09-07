# Translation number-normalization regression

## Problem
Step 2 translation was discarded when AI translated locale-specific number formatting, e.g. `15,000` to `15 000`, because the validator compared raw numeric token strings.

## Required behavior
- Preserve numeric facts and reject actual changes (e.g. 24 -> 25, 15,000 -> 15,500).
- Accept locale-only separator changes (comma, dot, space, NBSP/narrow NBSP) when the digit sequence is unchanged.
- Continue rejecting incomplete translations and wrong-language output.
- Keep source content unchanged until a complete validated translation is available.

## Implementation
Compare numeric tokens semantically enough for translation safety:
1. Extract numeric tokens including locale separators.
2. Require the same number of numeric tokens.
3. Require identical digit sequences for corresponding tokens.
4. When one side has no separator and the other does, allow it only when the separated form is a conventional thousands-grouping pattern.
5. Otherwise reject.
