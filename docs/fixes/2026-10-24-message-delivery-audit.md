# Message and Delivery review fixes

## Root causes and corrections

- Delivery used a company domain as both a company rollup and a send identity. Separate records now retain the buyer, recipient, approval revision, approved subject/body and available provider/thread identifiers. Saved buyer drafts participate in exact package selection. Legacy records remain readable and conservatively block repeats to their own recipient; ambiguous legacy replies require explicit record selection.
- Normalization silently clipped records at 50 sends, 20 replies and 200 activity events. These history caps are removed. Normalized save/reload and learning totals preserve every retained record. This prevents future clipping; it cannot reconstruct records already discarded by an older version.
- Meeting intent was treated as an accomplished meeting. Meeting requests now remain Replied until a real Meeting/Proposal/Won outcome is recorded. Existing explicitly recorded outcomes are preserved.
- A successful provider send followed by a failed workspace save returned a send failure. Confirmed delivery now remains successful, with synchronization pending, for both thrown errors and `{saved:false}` results. Provider ambiguity and workspace-switch guards remain fail-closed. No sending approvals are bypassed.

## Related paths inspected

Messages direct sending, Delivery provider/manual sending, archived buyer contact markers, manual replies/outcomes, Gmail reply attribution, automation handoff, history export and browser asset boundaries. Earlier sent revisions remain selectable for replies/outcomes after message replacement. No actual outreach was sent during implementation or tests.

## Prevention and evidence

New behavioral regressions cover two buyers at one domain, approval revisions, repeat confirmation, legacy history, 70 sends and 25 replies, meeting intent, Gmail thread attribution, saved-buyer handoff/reopen, exact contacted markers, historical outcome recording, and Gmail/Microsoft post-send saving failures. The independent review identified the contacted-marker, historical controls and nonthrowing-save paths; each received a failing regression before correction. Release smoke checks now require the new model, history control and synchronization separation.

Authenticated customer acceptance remains distinct from automated regression and exact-SHA release evidence. The review browser was signed out; no customer credentials or real recipient sends were used.

Final local evidence: 3,637/3,637 customer tests passed, static build passed, and changed-script syntax checks passed. Publication is blocked pending explicit approval to publish to public `CCGEDGARS/leadintel` and deploy. No production claim is made; exact-SHA release proof remains required after publication.
