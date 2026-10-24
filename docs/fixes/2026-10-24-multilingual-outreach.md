# Russian and Kazakhstan outreach support

Approved scope: extend existing translation and saved-language controls; preserve English masters, original copies and send gates. The UI remains English. Existing languages and existing translation/editorial requests are reused.

Russian and Kazakh are now registered in both outreach language registries. Russian editorial guidance covers polite вы, cases, natural business language and exact identities. Kazakhstan aliases and .kz suggest Russian with confirmation; manual English/Kazakh/Russian overrides win. Country recognition includes English, Russian, Kazakh and Latvian names. Discovery includes Cyrillic country names plus local expansion/hiring terms through the existing query planner.

Reusable governance is in .agents/skills/leadintel-multilingual-outreach/SKILL.md and AGENTS.md routes future work to it. Arbitrary unregistered languages are intentionally rejected by the existing supported-language contract.

Validation: node --test customer/test/russian-language.test.js customer/test/message-translations.test.js customer/test/content-language.test.js. Provider-produced fluency and authenticated end-to-end translation require separate runtime verification; offline fixtures do not prove either. Production release remains subject to exact-SHA release proof.
