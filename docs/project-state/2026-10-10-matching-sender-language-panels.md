# Matching Sender and Language panels — 10 October 2026

The user requested matching size and colour for Sender & settings and Languages & translations, as shown in their screenshot. Both panels now share the existing Languages background (#fafcfb), border, corner radius, full width, padding and summary typography. A short Sender description gives both collapsed headers the same two-line structure and height at desktop widths. On narrow screens descriptions wrap naturally; expanded contents keep their natural height.

Only presentation and the related cache boundaries change. Canonical inputs, event handlers, settings save, language controls and saved drafts are preserved. No outreach is sent.

Verification: all 2,091 customer tests and the static build passed. Publication requires exact-SHA production release proof. Isolated Chromium rendering was unavailable because the local Playwright browser executable is absent. The signed-in LKAB tab was not reloaded; actual authenticated visual verification remains unconfirmed.
