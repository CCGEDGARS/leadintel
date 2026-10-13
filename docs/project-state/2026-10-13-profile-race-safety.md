# Website and profile research commit safety — 13 October 2026

## Reproduced causes

Website activation accepted an external scrape response even when the visible website or verified account/workspace changed while it was pending. Its commit then cleared derived discovery state and replaced the company context.

Company research compared only saved website and answers before spreading its original pre-request state into storage. Documents, markets and unrelated branding edits made during research could be lost. When the existing answer-change check rejected a response, the error handler still changed navigation and wrote research metadata. Saved-evidence AI synthesis checked only website equality and could publish a result against newly changed documents/evidence or another workspace using the same website.

## Changes

- Website activation checks the captured account context, workspace and visible URL before clearing or writing workspace data.
- Research and synthesis capture account/workspace plus their input evidence, answers, review state, profile approval, market strategy and research metadata. A changed input cancels publication and the error handler cannot mutate the new context.
- Research merges successful results into the latest state, preserving unrelated live settings such as branding.
- Existing cache restoration, saved website activation recovery and no-repeat-provider navigation behavior remain unchanged. No customer records, backend state or financial/provider credentials were modified.

## Evidence and limits

Regression tests reproduced five research failures and two activation failures before the changes. The tests now pass and include three additional synthesis races. Stable activation, initial website-answer preparation, AI fallback with explicit failure reasons and customer-confirmed answer preservation also pass.

The final combined account-isolation/server-bridge/sync-recovery/activation/company-research suite passed 162 tests, with zero failures (54.1 seconds). `git diff --check` passed for this change set. This is local runtime evidence, not authenticated customer acceptance or proof of a deployed release. The parent release owner must refresh entrypoint cache keys and run the exact-SHA release gates.
