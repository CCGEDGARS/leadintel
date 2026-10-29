# Step 6: final action, tools position and consistent language field

User correction: the earlier released sync fix did not fulfill the agreed Step 6 layout. The existing Delivery footer was nested inside the draft while Tools was appended after the entire draft container, so the continuation button was not the final control. Optional Edit, Save draft, history, template, copy and test controls still occupied the draft header. The language field used different dimensions and a wider parent.

The email now follows message → Meeting options → Tools → the single primary Continue to Delivery action. Existing action nodes and handlers move into Tools; Save draft is secondary. Later-mounted test-email and LinkedIn copy controls reuse the same action host. Native disclosure open/close never changes or sends the draft. The saved-draft, recipient, conflict and approval gates on continuation remain intact.

Language, meeting and Tools fields share the same parent width, border, radius, padding and collapsed height. Language remains above the email and retains its translation shortcut, saved preferences and listeners. Sender settings use the matching disclosure style. Mobile styles retain wrapping and fit the viewport.

Step 6's own conflict controls now open the existing Workspace status review rather than scrolling to or relocating the old header controls. A legacy fallback remains when the attention module is unavailable. Opening review never chooses a version.

Prevention: test the mounted sibling order and final child, optional action containment, exact draft preservation, equal computed field styles and sync review routing. Browser fixture checks at 1440px and 390px measured all three fields at equal width, with 14px corners and 16px padding. Desktop collapsed height is 82px; on phones the Swedish shortcut wraps onto its own row so the language field grows without clipping. Tools controls remained reachable and the footer followed Tools. This does not prove an authenticated customer save/reload. Release smoke checks enforce the new runtime arrangement and language styles.

Validation: final customer suite 4,066 passed, zero failures; focused release/layout suite 53 passed; static build, changed-file syntax and whitespace checks passed. No outreach or customer-data mutation was performed during verification.
