# Core paragraph substitution regression

## Root cause

The library’s original was correct. The reusable source map nevertheless replaced entire development paragraphs with `development`/`friendlyOpening`, and Friendly’s complete experience sentence with `coreExperience`. The v3 renderer recovered approved wording only when its facts were all present. Its fallback still accepted a concise event summary, so a generic LKAB investment sentence passed deterministic validation. Prior tests favored complete evidence and accepted the missing-evidence fallback. Checking a raw library master or only the same renderer against itself could not catch that contract error.

## Permanent control

Native source patterns now retain sentence literals and expose factual atoms. Unsupported facts stay visible and block final actions. No wholesale event-summary substitution remains in NLP, Friendly or Brutal; Friendly experience retains its source frame. Runtime rejects the old paragraph slots. Independent source fixtures still verify unchanged originals; screenshot-specific missing-evidence expectations exercise the previously uncovered branch. Tests also cover all facts supplied, negation/speculation, other industries, legacy drafts, flow blocking and persistent reopen. The production release smoke checks that the runtime guard exists. Backend seeds migrate old builtins with history while preserving owner-authored masters and deletion tombstones.

The regression suite now distinguishes source fields that are legitimate facts from approved literal structure. Financial amounts remain in source/preparation evidence; a protected source with no amount slot cannot acquire a newly composed investment sentence. Existing stale/manual copies remain recoverable and are never silently overwritten. Explicit Update applies the corrected pattern and requires Save.

## Verification boundary

Tests establish this defined contract. Exact-SHA CI, manifest, backend health and mandatory smokes establish the production release. Signed-in screenshots establish actual emitted wording and unresolved-fact feedback. No check guarantees that all future code changes can never introduce a different defect; runtime validation plus CI prevent this particular paragraph fallback from passing unnoticed.

The separate opening-only action was also audited. It now refuses protected tailored core drafts and directs the user to Update message; manual/personal copies and LinkedIn retain their separate opening-edit authority. The core review panel hides the unsafe shortcut. A mounted regression covers this alternate entry point.
