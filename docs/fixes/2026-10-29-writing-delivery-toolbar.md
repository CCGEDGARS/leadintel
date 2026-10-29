# Writing Assistant toolbar and delivery return

Approved on 29 October 2026. Top controls: Load script, secondary Save draft, More. More contains Save as template, Restore original, Clear draft, and Copy for general writing. Direct editing replaces Edit. One Undo/Redo pair in the rich editor covers typing, formatting, subject edits and AI revisions, preserving provenance.

The fixed footer saves before closing, then scrolls/highlights the existing main delivery button without activating it. General/manual channels save and close. Confirmed CRM persistence is required: false, local-only and failed saves keep the window open. Session/scope/draft and independent customer-context guards reject late completions; incoming conflicts and unusable contexts keep the editor available for review. Own-save source reconciliation remains allowed.

Review found and regression tests reproduced two issues before release: same-scope upstream changes could still close the window, and replacing the editor history with the workbench history reduced undo to five inputs. Both were fixed: post-save context/conflict checks and forty in-memory history steps, while persisted recovery remains bounded to five. Read-only review used the requesting-code-review skill; author verified fixes via failing-then-passing behavioral tests.

Validation: 4,054 customer tests passed, including ten toolbar/handoff cases and the actual Messages adapter. Static build and JavaScript syntax checks passed. Asset cache tokens traverse the HTML, lazy outreach loader, assistant modules and CSS, and rich editor. Tests cover no sending/approval/flow activation, exact text/HTML, disabled delivery readiness focus, retries, close/reopen/customer/draft races, context conflicts, and revision/provenance recovery.

Release acceptance still requires exact-main-SHA CI and release-proof.json verdict PROVEN. Browser customer-account acceptance is separate from deterministic tests and release freshness; do not claim an authenticated customer save without observing one.

Rendered-browser QA at 390 × 844 found More wrapping onto a new toolbar line and right-aligning its popup outside the left edge. Its narrow-screen popup now anchors to the left of its trigger. The fixed footer was fully within the viewport (top 759.68, bottom 803.68). Customer-account layout was observed; sync/recipient checks blocked a real customer save, so no send/approval gate was bypassed.
