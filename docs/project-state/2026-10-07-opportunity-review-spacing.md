# Opportunity review spacing — 7 October 2026

User asked for more space around the opportunity review sentence in the LinkedIn match dialog.

Scoped CSS adds 24px above the reason label, a 12px label-to-field gap, a 112px minimum field height with 14px padding, and 16px before the hold button. The field remains vertically resizable. The Discovery asset query revision is updated in both runtime and shell so cached styles cannot hide the change.

Production build and five deployment tests passed. Full suite, exact release proof and signed-in visual verification are recorded below after completion.

All 1,848 customer tests passed. PROVEN PRODUCTION: `22365691b8ae266aaa76aef6e310ad136696c329`; exact-SHA CI run `37631564130` success, manifest matched, backend health and all 39 mandatory smokes passed.

Authenticated visual verification confirmed 112px textarea height, 12px label gap, 24px label top margin, 14px field padding and 16px before the hold button. Screenshot saved. No review decision or outreach performed.
