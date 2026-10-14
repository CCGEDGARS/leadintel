# Profile research recovery

The Profile research panel previously instructed every customer to repair AI provider settings after any unsuccessful synthesis. A 60-second timeout, network failure, and temporary provider failure do not establish a configuration problem. The generic instruction also obscured saved evidence and did not explain the five source coverage areas.

The panel now classifies saved failure reasons conservatively, including legacy metadata. Timeouts offer a retry using saved evidence. Configuration, authentication, and billing failures expose the existing Settings action. Other transient failures offer retry without configuration advice. The original failure reason remains available under More research options.

Source coverage names missing categories separately from actual unanswered profile fields. Unanswered fields have keyboard-accessible navigation buttons. Review saved sources expands a list of safe source links and saved extract previews, including uploaded documents. Refresh research is secondary and explains that it collects sources again. AI completion remains subject to the existing profile review and approval rules. Manual completion remains available.

No provider timeout, account credentials, evidence confidence, approval requirements, or sending permissions were changed. This fixes recovery guidance and usability; it does not establish why a particular provider request timed out.

Regression coverage includes timeout and temporary-error guidance, configuration routing, saved-evidence retry without web research, preservation of customer-confirmed answers, stale account/evidence/document responses, safe links, field navigation, and successful-AI states. Customer dependencies and the production build are checked before release; exact-SHA release proof is required to claim production completion.

Spacing adjustment: the retry action group has 16px above and 18px below, preserving separation from missing-source guidance on desktop and mobile. CSS and loader versions are updated together.
