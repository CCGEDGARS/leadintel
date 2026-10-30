# Step 6: visible primary action while review is required

The customer screenshot shows the correctly positioned footer, but its disabled Continue button is extremely faint while a separate secondary Review message update action is available. Earlier layout validation covered position and shape, not this blocked-state presentation. The displayed reason comes from pendingSelections or missing generation provenance; the screenshot does not establish which underlying record condition applies.

Use one visible main-action slot. When a readiness issue has an existing resolution action, show that action as the primary footer button and hide disabled Continue. Once ready, hide the resolution action and show Continue. Keep the existing native resolution handlers: message-update review only opens/focuses Tools, sync opens the existing review surface, and explicit save retains its durable-save checks. No readiness or approval gate is relaxed, and reviewed text is never replaced automatically. Busy actions remain disabled with full opacity and legible colors. Mobile actions occupy the full footer width.

Writing Assistant's saved return selects the visible review action when Continue is hidden, focuses/highlights it, and never activates it. Existing disabled readiness focus and save-failure/context guards remain unchanged.

Prevention: reproduce the screenshot's blocked state, assert exactly one visible primary action, check opening review preserves the message and performs no request/approval, verify ready/busy/sync states, and exercise Writing Assistant return focus. Release smoke checks enforce the new source markers. Authenticated customer data and the actual provenance gap remain untouched.

Validation: 4,069 customer tests passed; focused message/return suite 368 passed; syntax, build and whitespace checks passed. Chromium fixtures at 1440px and 390px confirmed one visible footer action in review, ready and busy states, at least 48px high and within the viewport. Active text contrast measured 9.96:1; busy text 6.22:1, with opacity 1. No page errors were observed. These checks do not substitute for authenticated customer acceptance.
