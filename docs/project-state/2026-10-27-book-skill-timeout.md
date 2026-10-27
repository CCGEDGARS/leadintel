# Book skill conversion timeout correction — 27 October 2026

## Customer evidence and cause

The customer screenshot at 14:45 Riga time shows The Copywriters Handbook,
440/446 pages readable, Processing, 0/65 sections saved, and
`AI_TIMEOUT · generate_section`. The earlier diagnostic release exposed the
failure but did not change the failing request. Conversion packed up to 12,000
source characters into requests permitting 6,500 output tokens, with the same
60-second deadline used by the much smaller book-analysis output. Retries
repeated the same work without a smaller conversion unit.

## Correction

- Preserve original 12k source indices and all previously saved full-section
  methods. Split unfinished sections into deterministic 4,000-character child
  sections with 200-character overlap; retain every readable source character.
- Persist each child method separately before starting another request. Progress,
  retry, cleanup, deletion and final assembly include both legacy and child
  checkpoints. Ready requires every planned unit, and export IDs stay unique.
- Ask for compact, actionable methods for each smaller section, targeting
  1,500–2,200 output tokens with a 4,000-token budget; retain validation and all
  substantive method fields. This is supplementary knowledge, never authority.
- Allow 120 seconds per provider request and reserve a lease covering the whole
  bounded batch (four requests plus a minute for storage). Prevent a second
  worker from claiming work still legitimately in progress.
- Migration 0058 gives existing Failed/AI_TIMEOUT jobs with retained snapshots
  one fresh bounded retry budget. Processing jobs continue automatically. Other
  terminal diagnostic categories remain owner-controlled.
- Preload saved child indices once per batch instead of querying every saved
  section again. Delete at most forty objects per pass, clearing each durable
  pointer only after successful physical deletion; process one deleting skill
  per scheduler call. This keeps large books below D1 invocation limits and
  makes deletion converge across interruptions.
- Backend health resilience version: `20261027-v2`.

## Validation and limits

Regression coverage demonstrates long-book completion with a transport that
rejects oversized sections, complete source coverage, partial checkpoint resume,
legacy checkpoint reuse, 440-page completion with bounded D1 work per batch,
880-method bounded resumable deletion, unique portable reference files, a response beyond the
old sixty-second deadline, exclusion of concurrent batch claims, and one-time
recovery without retrying billing failures. Existing provider error sanitization,
quota cleanup, book independence, source deletion, owner isolation, revision
checks and advisory/master protections remain required.

The old deadline was restored temporarily for the new deadline regression: it
failed with Processing instead of Ready. The original oversized-request
regression also failed before the change, and passes with child checkpoints.

Authenticated customer verification remains unavailable because the browser
connector cannot access the originating browser context. Controlled-provider
completion is not evidence that this customer's book has reached Ready. Final
CI and exact-SHA release evidence belong in release-proof.json.
