# Readable Creator template fields

Owner-requested square-bracket personalization was not implemented by the renderer: it only replaced curly fields. Thus a correctly loaded Creator master still displayed [First name], [Your name] and [Company], while readiness ignored most bracket gaps.

The shared Email/LinkedIn/Phone renderer now fills an explicit vocabulary of readable bracket slots from the current recipient and sender context. Unknown slots stay verbatim and are reported as missing information. Lowercase [company] inside a reference story is deliberately not mapped to the sender's Company. Story dates, outcomes and reference claims are never inferred. Only source-verified or reviewed selected developments fill the verified-development slot. Rich text replacements escape values and preserve emphasis. No master literal is rewritten.

Opening Messages upgrades only an unsaved raw library copy whose subject/body exactly match its current master. Saved copies and manual additions are preserved. Explicit style selection uses the updated renderer. Undo remains available. Remaining bracket slots block final use but do not prevent saving a draft.

Validation includes shared all-channel substitution, cross-buyer isolation, unknown evidence, markup safety, mounted raw-copy reopening/manual protection, and the authenticated browser/SQL journey through library fetch, style selection, exact CRM save and fresh-browser reopen. Tests use synthetic fixtures and send no outreach.
