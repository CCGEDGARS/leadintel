# Kazakhstan support contract

Goal: make Kazakhstan selectable and preserve that market through onboarding, discovery, buyer research and message preparation. User requested the feature after approving publication/deployment to CCGEDGARS/leadintel in this chat; continue through the established release path.

Initial gaps (before integrating newer multilingual work): country absent from presets/known countries; discovery lacks a KZ rule and rejects Cyrillic-only company names; Kazakh and Russian are absent from supported message languages. International phone validation and configurable IANA scheduling already exist.

Desired behavior and acceptance:
- Kazakhstan is an accessible preset and survives normalized save/reload. Common Latin/local spellings normalize to one country.
- Research queries use KZ and country names in English, Kazakh and Russian. Recognize .kz and .қаз/punycode without confusing Russia with Kazakhstan. Preserve public evidence/fit gates and tender opt-in.
- Source-backed Cyrillic company names remain distinct and can be researched; names absent from source evidence remain rejected. Keep existing Latin identities compatible.
- Add Kazakh and Russian translation choices, with original English and protected names/numbers/links preserved through CRM reload. Country/domain inference suggests Russian for Kazakhstan and requires user confirmation; it does not establish a buyer's language preference.
- Regression-check +7 sender phones, Cyrillic buyer names and Asia/Almaty (UTC+5) send windows without changing existing account settings or activating/sending anything.

Scope: customer preset/profile/discovery/language modules and tests; backend scheduling regression, cache boundaries, release smoke checks. No new providers, country-specific customer defaults, real outreach, account changes or invented contacts. Actual paid provider/contact availability remains evidence-dependent.

Verification: focused RED→GREEN tests, complete customer suite, scheduling tests, static build/syntax, independent review, browser preset/persistence checks, exact-SHA CI and production release proof. Public external source checks do not substitute for an authenticated customer/provider run.

Sources: IANA .kz and .қаз root records; Kazakhstan government language information and 2024 unified UTC+5 announcement. Existing saved timezone choices are preserved.
