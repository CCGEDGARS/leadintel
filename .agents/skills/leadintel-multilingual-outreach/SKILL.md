---
name: leadintel-multilingual-outreach
description: Govern LeadIntel multilingual client research, Russian and Kazakh outreach, translation, language preferences and translation quality checks. Use when adding languages, researching Kazakhstan, translating messages or changing language persistence.
---

# Multilingual research and outreach

Read AGENTS.md and docs/policies/core-template-ai-rules.md before changing protected templates. Use the existing message-translations.js and content-language.js paths, not a parallel translator.

## Language selection
Keep the interface language separate from outreach language. Offer Russian and Kazakh alongside existing languages. Treat Kazakhstan as a multilingual market: suggest Russian with confirmation, allow Kazakh or English, and always respect explicit buyer/flow preferences. Never infer a person's ethnicity or language preference from a name. Retain language settings per flow and translated versions per message/contact through workspace and CRM serialization.

## Research
Search English and relevant Russian/Kazakh country, company and role terms. Retain original Cyrillic spellings, source URLs, dates and identity evidence. Use transliterations only as search variants, never as verified identities. Search Kazakhstan, Казахстан and Қазақстан and relevant .kz sources without excluding legitimate companies on other domains. Translate supported roles for presentation without upgrading purchasing authority. Preserve Known → Planned → Researched → Verified and actual execution receipts. A query plan is not a completed search.

## Translation
Translate the complete subject and body through the existing explicit Translate action and editorial review. Keep the English source immutable, each paragraph and signature boundary, names, URLs, identifiers, numbers, currencies, facts and CTA. Use natural Russian business language and polite вы; do not invent patronymics or gender. Use professional Kazakh and polite сіз when selected. Preserve names as supplied unless the user explicitly requests a separate transliterated working copy. No new claims, urgency, guarantees or reference customers.

Store translated versions independently. Preserve history, Undo and stale-source detection. Translation and language selection never authorize saving, approval, automation or sending. Failures retain the current draft.

## Verification
Test selectors, manual override, Kazakhstan suggestion/confirmation, source preservation, protected tokens, CRM save/reopen, stale translations, invalid provider responses and context races. Deterministic checks cannot prove semantic equivalence or native fluency. Review output for mixed-language sentences, calques and meaning drift. Verify actual provider execution separately from offline tests. Follow release-integrity before making production claims.
