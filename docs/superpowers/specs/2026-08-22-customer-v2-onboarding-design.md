# LeadIntel Customer V2 Onboarding Design

## Goal
Create a customer-facing LeadIntel entry point at `/customer/` that converts company-owned context into an approved Company Intelligence Profile without modifying the legacy `/v2/` operator application.

## Product flow
1. Company sources: required main website, up to eight additional URLs, up to five PDFs.
2. Strategic intake: ten canonical commercial questions.
3. Intelligence analysis: scrape readable public pages, extract PDF text locally, preserve strategic answers as authoritative context, expose source failures as gaps.
4. Profile review: editable Company Intelligence Profile, recommended signals, evidence summary, information gaps, explicit approval gate.
5. Handoff: approved profile becomes the source of truth for the next Market Opportunity Engine, ICP Engine, Signal Designer, Discovery and CRM modules.

## Canonical questions
1. Priority products/services.
2. Ideal customer.
3. Lookalike customers (optional).
4. Buying decision-maker roles.
5. Priority growth markets/segments.
6. Competitive differentiation.
7. Buying triggers.
8. Negative ICP/exclusions.
9. Commercial value of a good opportunity.
10. 6–12 month commercial objective.

## Architecture
- `customer/index.html`: three-step customer UI.
- `customer/styles.css`: self-contained customer workspace styling.
- `customer/profile-engine.js`: deterministic, testable profile synthesis and state normalization shared by browser and Node tests.
- `customer/app.js`: browser storage, source scraping, PDF.js extraction, wizard state and approval controls.
- Firecrawl requests use the existing Cloudflare proxy. Public-source failures do not prevent profile creation.
- PDF text extraction occurs in-browser. Original PDF bytes are not persisted by this onboarding screen.
- State persists in browser localStorage under `leadintel_customer_v2_state`.
- Existing `/v2/` files are not modified.

## Evidence rules
- Strategic questionnaire answers outrank public website wording where they conflict.
- Current market footprint inferred from evidence is stored separately from target growth markets.
- Missing evidence is reported as an information gap; the system must not fabricate unknown commercial facts.
- Signal recommendations must include a reason and remain user-editable/activatable.

## Deployment safety
GitHub Pages must publish both `/v2/` and `/customer/`. The deployment workflow must continue copying the legacy `v2` directory unchanged while adding the customer directory.

## Verification
- Node tests cover URL safety, completeness, strategic precedence, current-market inference, signal recommendation, document evidence, information gaps, saved-state normalization, required UI structure and deployment preservation.
- `node --check` validates both customer JavaScript files.
