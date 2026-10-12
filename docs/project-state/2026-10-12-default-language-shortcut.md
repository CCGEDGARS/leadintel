# Default-language translation shortcut

The outside translation shortcut previously followed targetLanguage (the language selected for preview). It now follows defaultLanguage from the working flow settings. When the default matches the original, the outside shortcut is hidden and the selected-language action stays inside the language panel. When the default differs, the outside action translates that default; a separate panel action translates a different preview selection. Both retain existing busy, edit, approval and synchronization guards.

No preferences, originals or messages are changed by rendering. Existing Set as default persistence remains unchanged. Removing the default returns the shortcut to the existing English fallback. The legacy no-preference renderer remains compatible until preferences migrate. Cache invalidation covers translation UI → outreach UI → discovery loader → HTML entry.

Regression reproduces English default with Latvian preview, then Swedish default with Latvian preview; asserts correct click targets, serialized preference reload, default removal and original preservation. Existing rendering guards and flow persistence tests also run.
