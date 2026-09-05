# Step 1 — selected-language content generation

## Scope

LeadIntel keeps interface navigation, headings, labels and workflow controls in English. Generated commercial content now follows the selected content language across:

- Market Strategy: ICP names, definitions, rationales and market-opportunity conclusions.
- Company Discovery: evidence-aware candidate explanations.
- Content & Scripts: dossier conclusions, hypotheses, cold email, LinkedIn message, call opener, follow-up and objection response.
- Delivery & Learning: outcome-based learning recommendations and exported learning summaries.

`Auto` resolves to Latvian when a Latvian browser preference is present and otherwise to English.

## Data-safety rules

- Company names, domains, URLs, numerical scores, evidence records and CRM stages are not translated.
- Language switching updates only text that still matches a system-generated variant.
- Customer-edited strategy and outreach copy is preserved.
- Approved outreach packages remain immutable when the language changes.
- Existing evidence and scoring survive language migration.

## Verification

- Locale behavior was developed with failing tests first.
- The complete Customer V2 suite passes: 313 tests.
- Every customer JavaScript file passes syntax validation.
- The static deployment bundle builds without exposing test or backend source trees.
