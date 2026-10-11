# Blank editor during explicit message preparation

The customer reported that selecting Professional displayed a preparing indicator but kept the saved Friendly body and style label visible. The renderer intentionally retained and highlighted the old canonical fields; this was safe for persistence but did not match the clarified blank-editor expectation.

Explicit generation now uses a presentation-only pair of empty read-only fields, hides the old subject/body and saved badge, and names the requested style as preparing. The underlying fields and persistent item are never emptied, so Save/sync and context fingerprints cannot persist the loading state. A successful validated result replaces the view; failure reveals the preserved draft and its actual error. Background preparation is identified separately and preserves the visible saved draft. Subject-only actions, translation, and flow work retain their current presentation.

Regressions exercise all four reference styles, AI failure, render during preparation, rapid style switching/old replies, saved reopening and subject-only updates. Existing original/Undo/CRM and validation suites remain applicable. The exact release must pass the new blank-view/runtime/bootstrap smoke gates before a production claim.
