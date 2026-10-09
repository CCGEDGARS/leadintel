# Confirmed subject correction and audit — 9 October 2026

The user explicitly corrected Professional subjects to exactly these five, in this order:
1. Steel and installation for Malmberget
2. Edgars Untals. Ercon
3. Room for one more steel supplier?
4. Malmberget steel – who should I ask?
5. Malmberget: EXC2 or EXC3?

This correction supersedes the generic Professional set in the earlier reference upload and 2026-10-06-professional-subjects.md. Only the Professional subject list in approved-reference-scripts.js is updated; all body paragraphs and other styles' reference subjects remain unchanged. The three other working sets match the approval records in 2026-10-06-nlp-core.md, 2026-10-06-friendly-core.md and 2026-10-06-brutal-honesty-core.md. The last document is the recorded five-subject Brutal set; the later verbatim upload contains one example subject, not a replacement five-subject list. No new subject wording is asserted approved.

Root cause: generic Professional presets were treated as authoritative despite the user correction, and unresolved subject patterns were rendered verbatim as disabled option text. The exact approved examples are now visible in the protected subject view. Working patterns fill only current reviewed project facts and approved seller context. Proper names and company names retain the supplied spelling. All 24 supported languages have deterministic fixed-text translations for the corrected Professional patterns. Project extraction uses explicit project/location fields, short titles or a named location in reviewed evidence; it does not truncate research paragraphs. Steel wording requires steel in the active seller's approved offering/evidence, and installation additionally requires installation context. EXC2/EXC3 is the user-approved technical question for that steel topic, never a statement that the seller or buyer holds either classification. Unrelated professions do not inherit steel, the example recipient, standards or sender identity. Missing required context leaves the option disabled with a plain explanation, never placeholders or an invented alternative.

Existing subject/body text and personal versions are not silently replaced. Previous known presets migrate as presets without consuming personal slots. New subject choices persist independently and do not change the message body. The exact golden five, other-style audit, language/length limits, workspace portability, missing-evidence display and serialized manual text are covered by new regressions.

Full tests also exposed two errors in the preceding release: deleting every project-containing paragraph without a trigger removed the Professional invitation; the event-panel test fixture still expected the earlier placement. The invitation now retains its original question with the unavailable conditional project clause omitted. The event fixture now verifies the requested Outreach Tools anchor. No protected message body or sending permission was changed.

Release completion requires full Customer CI success for the exact published SHA and release-proof verdict PROVEN. Automated release proof is separate from authenticated customer acceptance. No outreach is sent.
