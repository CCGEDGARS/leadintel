---
name: browser-ui-verification
description: Verify a web application's real user experience after UI, routing, form, auth, responsive, or deployment changes. Use whenever the requested outcome is visible or interactive in a browser.
---

# Browser & UI Verification

Source inspection is not sufficient evidence.
1. Confirm target URL/environment, expected flow, test-account needs, and write permissions.
2. Load the exact route and confirm the correct interface.
3. Check visible errors, console, and critical network requests.
4. Exercise the changed interaction and relevant loading/success/empty/error states.
5. Refresh/revisit for persistence issues.
6. Test desktop and narrow/mobile viewports when relevant; inspect overflow, navigation, readability, forms, modals, touch targets, and focus.
7. For forms verify validation, loading/disabled state, duplicate-submission protection, success/error feedback, and persistence.
8. After deployment open the exact deployed URL and exercise the critical path.
Report environment, viewports, flows, console/network status, failures fixed, and anything not testable.
