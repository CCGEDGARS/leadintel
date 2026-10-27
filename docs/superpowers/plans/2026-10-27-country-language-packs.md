# Country-triggered Language Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Country-triggered source-backed language preparation and English-first reviewable translations.
**Architecture:** Shared public packs, private credentials/reference data, existing translation/history/CRM paths.
**Tech Stack:** Browser JavaScript, Cloudflare Worker, D1, existing workspace AI/search and Google Translation API.
**Spec:** docs/superpowers/specs/2026-10-27-country-language-packs.md

## Global Constraints
English primary; no translate without saved English; explicit Translate/Apply/Save; protected templates/facts; workspace isolation; 3–5 actual fetched public sources; AI-tested is not native-reviewed; no sending; no fabricated provider success.

## Review Focus
- Ambiguous country and multi-country choice cannot overwrite manual preferences.
- Shared packs contain no customer data and source text is untrusted.
- Provider timeout/failed review cannot apply or persist translation.
- Context and source changes invalidate previews even after provider completes.
- Google errors/formatting preserve original and previous saved versions.

### Task 1: Public language pack service
Files: customer/language-pack-catalogue.js; backend/src/language-packs.js; backend/src/language-pack-routes.js; backend/migrations/0061_language_packs.sql; backend/test/language-packs.test.mjs.
Interface: catalogue.resolveCountry(country) -> {language,choices,requiresConfirmation}; catalogue.languages; GET /api/language-packs?workspace_id&language; POST /api/language-packs/prepare {country,language?}; pack {language,status,revision,rules,sources,checks,error}. Export runLanguagePackJobs and handleLanguagePackRoute. Add route/cron wiring at integration.
- [x] Write failing country, source-read, privacy, lease, failure and auth tests; observe RED.
- [x] Implement bounded durable source research and pack preparation; observe GREEN.

### Task 2: Optional Google translation
Files: backend/src/google-translation.js; backend/src/google-translation-routes.js; backend/migrations/0062_google_translation.sql; backend/test/google-translation.test.mjs.
Interface: GET/PUT/DELETE /api/integrations/translation/google (PUT {api_key}); POST /api/translation/google {source:{subject,message,messageHtml?},language,protectedTerms}. Result {subject,message,messageHtml?,provider,model}. Authenticated workspace membership; owner config; encrypted credentials; mask protected terms; preserve lines/formatting; no silent fallback. Does not perform editorial review; caller uses existing path.
- [x] Write and run RED provider/credential/security/structure tests.
- [x] Implement module/routes and run GREEN.

### Task 3: Country preparation and translation review UI
Files: customer/language-pack-ui.js; customer/app.js; customer/index.html; customer/content-language.js; customer/message-translations.js; customer/message-translation-ui.js; customer/outreach-ui.js; customer/styles.css; frontend tests.
Interfaces: window.LeadIntelLanguagePacks.prepareMarkets(markets), ensure(language), status(language), countrySuggestion(country); reuse existing translate/settings/history/CRM functions. Country selection dispatches preparation without changing draft; top toolbar Translate to suggested language; explicit preference takes priority; preview Apply/Cancel; Undo; provider selector and owner Google configuration in Languages details.
- [x] Tests RED country event, no-English guard, preview lifecycle, saved history, context changes.
- [x] Implement and verify GREEN with existing regression suites.

### Task 4: Integration and release
- [ ] Wire routes/cron, apply migrations, update cache entry boundary and docs.
- [ ] Run full customer/backend tests, build, meaningful browser flow and independent review.
- [ ] Commit/push authorized changes; require same-SHA CI/live manifest/backend smoke/proof before production claims. Report external blockers explicitly.
