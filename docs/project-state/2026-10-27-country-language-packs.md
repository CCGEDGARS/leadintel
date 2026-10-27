# Country language preparation and English-first translation

User authorized implementation on 27 October 2026. Country selection dispatches preparation; signed-in hydration resumes selected markets. Shared packs persist public fetched sources, quotes, content hashes, dates and AI review results in D1. Each phase checkpoints progress; cron resumes queued jobs. Unknown/multilingual countries require explicit language choice. Multiple explicitly selected unambiguous markets each prepare their language without choosing a message target. Explicit English preferences are respected. No customer facts enter shared packs.

Messages show a market-language shortcut above the editor. English is required and saved before a provider request; target-to-target chaining is prohibited. Translation plus editorial review produces an unsaved preview. Apply, Cancel, Save and Undo are independent. English and existing translated edits/history survive CRM; Undo changes only the original translation channel. Translation metadata separates actual provider/model, AI reviewer and pack provenance. Turkish and Chinese variants have valid language/subject/reference/CRM paths.

Google Cloud Translation is optional, uses separately verified encrypted workspace API keys and fails closed; Gmail/Gemini connections do not enable it. Languages & translations contains owner connection controls, provider selection, language status and source links. No dedicated Google Translation credential was supplied to this task: actual Google execution remains unverified. Source-backed AI tests cannot certify native language quality.

Independent review found ambiguous-market overpreparation, ignored explicit English, Chinese variant normalization, hidden Undo and cross-channel Undo overwrites. Each received focused regression coverage and fixes. Final full-suite/release results are recorded after verification; do not infer production completion from this document alone.

## Verification before integration
- Frontend full suite: 3,957 passed, zero failures (`node --test --test-concurrency=4 customer/test/*.test.js`). Dedicated real-composer workflow also passes with controlled provider responses and actual CRM serialization.
- Backend full suite: 1,087 passed, zero failures. Renumbered migrations 0061/0062 to follow concurrent book-processing release; dedicated routes/provider/pack tests: 28 passed after renumbering.
- Static production build and Wrangler Worker dry build both passed. Independent review findings resolved. Browser cache entrypoints include country-language token, including lazy Outreach loader.
- Initial full frontend run exposed a stale production-proof fixture and an unrelated brittle 100ms test race; fixture now covers new routes/assets and the cancellation test awaits completion under Node test timeout rather than racing CPU scheduling.
- Live browser redirects to sign-in. Authenticated production provider/source generation is not proven. Google Translation remains an optional connection requiring its own dedicated API key.

## Publishing gate
Automatic approval review rejected the feature-branch push to the existing `https://github.com/CCGEDGARS/leadintel.git` remote, stating that potentially private source/history would be transmitted to a destination without explicit user authorization. No bypass or alternate publication path was attempted. Publishing/deployment requires the user to authorize that exact destination. Local implementation, migration validation and tests are retained.

Additional Undo guard: a newer English source cannot be overwritten by undoing an earlier translation. Regression reproduced failure first, then passed with source comparison.

## Publication approved
The user subsequently explicitly approved publication to CCGEDGARS/leadintel and deployment in the same conversation. The connected GitHub account confirms admin/push permission; terminal Git has no stored GitHub credential, so publication uses the authenticated GitHub connection with per-file blob hashes and whole-tree identity checks. Rebased backend full suite passed 1,101/1,101. The combined frontend run covered 3,962 tests; its single cancellation-fixture scheduling failure was corrected by holding the request deadline clock and aborting only after the response-body read starts; cancellation/research regression recheck passed 29/29. No product transport behavior changed for that test correction.
