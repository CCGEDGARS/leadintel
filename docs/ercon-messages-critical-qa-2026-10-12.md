# ERCON Step 6 Messages critical rescue QA — 2026-10-12

Evidence: user screenshots of 23:14; inspected `customer/test/verbatim-template-contract.test.js` and `customer/test/core-template-rules.test.js`. Screenshot text may be a saved manual edit or rewrite and is not by itself proof the default generator violated contract.

## P0 approved message mismatch
- Live visible Professional draft begins 'Hi Joakim, I’m Edgars Untals from ERCON, reaching out about LKAB’s investment...' rather than canonical observation -> empathy -> role question -> introduction. It is visibly shorter than the October 9 approved 12-paragraph master.
- Protected Professional test asserts exact approved script with substitutions and 20-minute call. Diagnose draft provenance: original vs manual edit vs rewrite vs stale persisted result vs UI selection/switch. Never overwrite customer edits during diagnosis.
- Acceptance: reset to original yields exact canonical wording and paragraphs; selected Professional default derives from protected master with verified dynamic facts; edited/rewrite versions distinct and reproducibly saved. Test real UI hydration, not only pure template module.

## P0 state/approval
- 'Your email — Unsaved changes' alongside Edit, Save, Update message, Add to flow creates ambiguous state. State machine: original, editing, generating, saved, ready; explicit required action; prevent stale async response overriding manual edits.
- Sending eligibility must check accepted company-address evidence, identity/contact review, user approval; no fabricated verification.

## P1 layout
- Primary email editor too narrow and internally scrolls, hiding message length and paragraph contract. Let editor dominate width/height; responsive readable viewport.
- Simplify style selection to compact choice with style previews; switching must not auto-rewrite protected masters or consume credits unless update is explicitly requested.
- Consolidate primary actions: Edit, Save, Reset Original, Update Draft, Approve/Add to Flow; only one main CTA at a time.
- Subject chooser shows 5/5 but needs contract-level validation for style/category relevance, max 60 chars and correct personalization; no disappearing subjects.
- Sender settings, language/translation, sources and advanced tools collapsed contextually. Keep sender identity/meeting context summary and protected references accessible.

## P2 remove distraction
- Writing Assistant has competing Shorten/Rewrite/Reset, Ask/Expand, sources and nested library sections. One Ask/Apply/Dismiss assistant workflow with safe preview and approval; no AI rewriting source masters.
- Multiple nested Outreach Tools accordion panels (library, style templates, my content, approved originals), Events and Advanced research are advanced; collapsed by default.
- Save to templates, set as default, choose saved templates are configuration actions; move to advanced/dropdown without deleting functions.
- Status 'Page check: Needs review' should indicate precise blocker(s) rather than generic banner.

## QA verification
- Existing tests do not establish production UI behaviour. Add DOM integration test for canonical Professional first-render, typed manual edits, refresh/relogin, subject choices, style switch, async race, reset, and no paid-provider fallback.
- Do not change live draft, trigger AI or send any message during QA; inspect state first.
- User rates Step 6 3–4/10, identifies it as most critical buyer-facing feature. P0 fixes before cosmetic refactoring and release.
