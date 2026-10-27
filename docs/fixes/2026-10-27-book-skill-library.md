# Book-derived Skill Library

## Behavior
Content Library has Books and Skills tabs. Upload limits remain three books, each up to 20 MiB. A Ready analysed book with a summary exposes Turn to skill. The confirmation names the skill, explains exact readable coverage, processing/provider usage and automatic enablement. Generation uses all readable extracted sections and the full analysis catalogue, never just the preview summary. Unreadable pages remain explicitly excluded.

Thirty saved skills per workspace, including disabled/processing/failed records. Atomic server enforcement and source-hash deduplication prevent duplicate work and overflow. Workspace owners manage skills; authenticated members may view and download workspace skills. Skill state and private files are workspace scoped and quota metered.

Each durable conversion snapshots the extracted source and analysis independently. The minute scheduler processes bounded chunks with a lease and saves completed method files. Invalid output cannot become Ready; retry resumes saved sections. Book replacement/deletion cannot remove a skill or its generation input. After successful publication temporary full-book text is deleted with retryable cleanup. Skill output retains original-word methods, procedures, diagnostic questions, quality checklists, hypothetical examples, cautions and source locations. It is a practical synthesis, not a lossless copy of every fact in the book.

Skills have View, Download ZIP, Available to AI toggle, Delete, and Retry creation after failure. ZIP contains SKILL.md, manifest.json and a reference file for every processed section. It excludes the original book and any app credentials. SKILL.md is portable Markdown; other projects may need format-specific import adjustments. Downloads do not install skills into other products.

Ask LeadIntel selects zero to three enabled skills semantically through the customer's provider, then selects relevant method sections across the full saved method index. Non-English questions are supported by the model. Only validated supplied IDs can be reported under Skills used. The final response rechecks enabled state/revisions. Skill selection errors are disclosed; ordinary answers remain available. Skills supplement existing instructions; they cannot override approved masters or authorize operational actions. The underlying model is not retrained.

Writing Assistant lets users select up to three enabled Ready skills for the current session. Selection resets with book selections, scopes to the workspace, participates in draft/history fingerprints and carries revision provenance. Generation, applying previews and saved historical attribution all retain the existing protections. Historical skill references remain metadata after a skill is removed and cannot reactivate it.

## Verification and limitations
Tests cover source analysis gate, full-source snapshot, source deletion, all-chunk output, retry, late responses after deletion, leases, duplicate clicks at capacity, cross-workspace isolation, quota metering, export files, semantic/non-English routing, later-chapter retrieval, no-relevance selection, disabling during inference, explicit writer selection, save/reopen attribution, safe DOM rendering and confirmation cancellation.

The existing browser connection was unavailable during implementation. Do not describe signed-in customer UI or real customer-book model quality as verified solely from the controlled tests. AI generation quality remains dependent on the connected provider and readable source. No existing customer book is automatically converted by this release; the user controls conversion through the dedicated button.

## Independent review corrections
A fresh read-only review reproduced three important defects before release. All were corrected with failing-then-passing regressions: generated private objects now have durable cleanup reservations before R2 writes (quota-rejected publication → retry → delete leaves no objects); explicit Writing Assistant choices still use semantic method selection, including Russian/English paraphrases and late chapters; and missing/corrupt/rejected automatic skill storage reads produce a disclosed ordinary-answer fallback. Publication storage exhaustion is identified as workspace storage, not an AI-credit error. No separate minor findings were raised.
