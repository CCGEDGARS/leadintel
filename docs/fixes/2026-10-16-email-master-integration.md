# October 15 email masters: import and generator correction

## Authorized source

The owner requested correction and use of the new mandatory email scripts on
16 October. The source documents are PROFESSIONAL.docx, NLP.docx, FRIENDLY.docx,
and BRUTAL HONESTY.docx, uploaded on 15 October. Their complete extracted text
was reread and compared with the repository originals. No new prose was approved
or added to those originals. The October 9/13 fixtures remain historical records.

## Root cause

The October 15 import changed approved-reference-scripts.js and duplicated
backend seed bodies, while message-editor.js still searched for literal factual
spans from older masters. NLP, Friendly and Brutal failed with “Approved original
factual slots changed”; Professional retained example-specific seller/project
claims. The import also flattened signature and proof-list line breaks and lost
Brutal's greeting, which shared a source paragraph with its document title.
Tests and release smoke checks still required superseded October 9/13 wording.

## Correction

- Restore the complete source paragraphs, greeting, multiline signatures and
  Professional's three proof lines. Preserve all four verbatim originals.
- Use one explicit source-to-pattern mapping for all four generators. Replace
  longest factual spans first so “Edgars” cannot leave another sender with the
  example surname. Missing or altered mapping spans fail closed.
- Declare seller descriptions, reviewed development paragraphs, service/experience
  claims, project/route, proof, priorities, meeting material and identity/link
  spans as factual substitutions. No example country, market, year, contractor,
  certification or delivery record is evidence for an active workspace.
- Use current supplied facts in these spans. Missing Professional reliability,
  quality, cost and project facts remain visible review markers. Missing reference
  stays [link] in Professional and is omitted in other styles. Unsupported route,
  absent development, optional profile links and unconfirmed No slides are omitted.
  The example two-year period becomes the nonnumeric “your project” fallback.
  Public source masters stay verbatim; only working factual slots vary.
- Generate backend email seeds from the canonical source with
  `node scripts/sync-email-core-masters.cjs`. Known obsolete builtin registry
  copies upgrade with their exact previous text in history. Owner-authored
  revisions and deletion tombstones remain preserved. Migrated builtins use the
  protected native generator rather than generic library substitution.
- Include the master version in all four factual fingerprints and draft scopes.
  Saved/manual working text is preserved until an explicit style/update action.
- Accept the source's “20 minutes on Zoom” wording without rewriting it, retain
  selected meeting-platform adaptation, and detect unresolved proof markers at
  parsing and final-action gates. Keep subject, Save, approval and send separate.

## Verification

Independent October 15 fixture checks cover all source paragraphs and internal
line breaks. Tests cover all four generators, complete emitted-body goldens,
cross-industry/name isolation, backend/source equality, obsolete-copy migration,
owner edits/tombstones, invalid AI fields, numeric invention, stale requests,
manual preservation, CRM snapshot round trips, style switching and selected
meeting platforms. Superseded literal expectations are updated to the approved
new sources without removing persistence, race or evidence assertions.

The backend suite passes 664 tests with Cloudflare request-metadata fetching and
Wrangler telemetry disabled. An earlier unbounded run was blocked by automatic
approval review when Miniflare requested workers.cloudflare.com/cf.json; inspection
confirmed its metadata GET, and the safer run disables that external request.
The complete customer suite passes 2,765 tests and the static build passes.
Exact release evidence is recorded separately.
No outbound email, flow activation or automatic sync-conflict choice is authorized
by this correction.
