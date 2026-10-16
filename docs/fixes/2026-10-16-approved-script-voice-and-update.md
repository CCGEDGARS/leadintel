# Approved script restoration and Update feedback

The saved October 15 originals were correct, but the factual renderer replaced entire declared spans with generic Profile prose. Tests of original records alone missed the visible email mismatch. Existing emitted-body expectations also accepted that generic prose.

The renderer now uses supported facts in the approved sentence frames. Regression tests compare emitted paragraphs against an independent October 15 source fixture, cover all four styles, and reject example facts for other sellers. Existing full-body comparisons, word ceilings, invalid AI responses, context races and save/reopen checks remain enforced. Investment quantities are retained when the source-specific milestone frame does not apply.

The reported inactive Update control executed, but rebuilt similar generic text and showed only a transient toast. Updates now leave a visible style-specific completion receipt beside the button. Readiness failures give feedback. Context assembly previously read and normalized the Profile eight or more times per call; it now uses one coherent snapshot. Guard, retry, recovery and persistence behavior are tested through the mounted page.

Production acceptance additionally requires exact-SHA CI, release manifest, backend health, all mandatory smokes, and an authenticated Update/Save/reload check of the actual working email. A correct Script Library is insufficient evidence of a correct working draft.

Authenticated acceptance exposed a later stylesheet override hiding the completion helper. Its display rule now keeps the receipt visible, and the mounted regression loads the actual composer stylesheet before asserting computed visibility. DOM text alone is insufficient for visible feedback.
