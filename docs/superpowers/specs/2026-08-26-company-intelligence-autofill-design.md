# Company Intelligence Autofill — Design

## Goal

Turn Customer V2 onboarding into an intelligence-first experience. After the customer provides the mandatory company website and at least one target market, LeadIntel researches the company website plus relevant public web sources, drafts the strategic context it can support, and moves the customer to a review screen where every suggestion can be edited before the Company Intelligence Profile is approved.

## User journey

1. Customer enters company website.
2. Customer selects one or more target countries/regions/markets.
3. Optional additional URLs and PDFs may be supplied.
4. Customer clicks **Research company & pre-fill context**.
5. LeadIntel:
   - scrapes the main website and supplied URLs;
   - performs a bounded public web search for company context;
   - deduplicates and preserves source URLs;
   - builds a conservative evidence draft;
   - when an authenticated workspace AI provider is active, asks that provider to enrich the draft from the same evidence under a strict JSON/evidence contract.
6. Step 2 becomes **Review what LeadIntel found**. The ten strategic fields are pre-filled where evidence is sufficient.
7. Each field shows its origin/confidence/source context in the current browser. Unsupported fields are explicitly marked **Needs your input**.
8. Customer edits or clears any field. Existing non-empty customer answers are never overwritten by a research rerun.
9. The existing Company Intelligence Profile and approval flow remain the final source-of-truth gate.

## Research boundaries

### Firecrawl

Reuse the existing production Firecrawl proxy already used by Customer V2:

- `/firecrawl-scrape` for official/supplied URLs.
- `/firecrawl-search` for broader public discovery.

Company onboarding research has a hard cap of **3 public search queries** and **4 results per query**. Research failures are partial failures, not blockers.

### Public search query families

The engine builds at most three query families:

1. Company/domain + products/services/customers/case studies.
2. Company/domain + news/partnerships/expansion/investment + selected target markets.
3. Company/domain + LinkedIn/company profile/distributor/partner references.

Queries must include the company domain or derived company name to reduce unrelated matches.

## AI enrichment

Reuse the existing authenticated route:

`POST /api/ai/generate?workspace_id=...`

No new AI service or credential store is introduced.

AI prompt contract:

- evidence only;
- no fabricated customer names, prices, deal values, certifications, markets or buyer roles;
- distinguish explicit evidence from reasonable inference;
- return strict JSON only;
- whitelist exactly the ten strategic question IDs;
- every suggested field has `value`, `confidence`, `source_ids`, and `rationale`;
- confidence is one of `high`, `medium`, `low`;
- referenced source IDs must exist in the supplied evidence set;
- empty string is required when evidence is insufficient.

If the user is signed out, no active AI provider is configured, or AI generation fails, onboarding still completes with the deterministic evidence draft and clearly identifies that AI enrichment was unavailable.

## Deterministic evidence draft

The fallback engine may fill only information that can be grounded mechanically:

- priority offers from official/product/service page titles and repeated product/service evidence;
- ideal customer / market focus only from clearly repeated industry taxonomy in evidence;
- buyer roles only when actual role terms occur in evidence;
- differentiation only from explicit claim/certification/customization/reliability evidence;
- buying triggers from the existing signal vocabulary when matching language occurs in evidence;
- lookalike customers only when a customer/case reference is explicit enough to extract safely.

The fallback must not invent:

- opportunity value;
- commercial success objective;
- exclusions;
- buyer roles not present in evidence;
- customer names inferred from unrelated search results.

## Merge / edit safety

Research draft merge rules:

1. Existing non-empty customer answer wins.
2. A draft may fill an empty field.
3. A rerun must not overwrite any non-empty field, regardless of whether it originally came from AI/evidence or the customer subsequently edited it.
4. A field cleared by the customer remains empty until the customer explicitly runs research again; even on rerun, only empty fields are candidates for refill.
5. Profile and market strategy are invalidated after new onboarding research so stale strategic outputs cannot survive changed evidence.

## Evidence normalization

Normalized source shape:

```js
{
  id: "S1",
  type: "website" | "link" | "public",
  url: "https://...",
  title: "...",
  text: "...",
  query: "...",
  status: "ready"
}
```

Rules:

- only HTTP(S) URLs;
- deduplicate by normalized URL;
- cap persisted evidence to 12 sources;
- cap public-source text to control Customer State size;
- preserve source URL/title for user review;
- prefer official-domain results first, then credible external references.

## UX

Step 1 CTA becomes **Research company & pre-fill context**.

During research the button is disabled and a compact status card reports:

- website scan;
- public-source search;
- AI enrichment/fallback;
- number of evidence sources collected.

Step 2 hero becomes:

**Review what LeadIntel found.**

Supporting copy explains that LeadIntel has pre-filled only what its evidence supports and that the customer remains the final authority.

A research summary displays source count and whether the draft used the configured AI provider or evidence-only mode.

Each strategic field displays browser-local review metadata:

- AI draft / Evidence draft / Your input / Needs your input;
- confidence when applicable;
- source links when available.

This review metadata is UX provenance. The authoritative answers and evidence sources are stored in the existing Customer V2 main state and therefore use the existing server-sync mechanism.

## Security and privacy

- No provider API key enters research code or browser state.
- AI calls use the existing authenticated server route and encrypted workspace credential.
- Firecrawl receives only public URLs/search queries and never uploaded PDF bytes.
- PDF behavior remains unchanged: extracted text stays in Customer V2 state; original bytes are not uploaded by onboarding.
- External source links use `rel=noopener`.

## Production completion criteria

1. RED tests cover research query cap, normalization, AI parsing, conservative fallback and no-overwrite merge behavior.
2. Customer structure test proves the research module is loaded and the onboarding CTA/review UX is active.
3. Full Customer V2 test suite and JavaScript syntax checks pass.
4. Exact final branch head has a READY Vercel preview.
5. Branch diff is reviewed against `main` to confirm all earlier mission/market/compact-source changes remain present.
6. PR is merged only after CI on the exact final head is green.
7. Vercel production deployment is READY on the merge SHA.
8. `https://leadintel.ccgroup.lv/customer/` serves the new research assets and current mission/target-market/compact-source UI.
9. Cloudflare Worker health remains green.
10. Authenticated live AI enrichment is considered fully E2E-verified only after one signed-in workspace run reaches Step 2 with populated evidence-backed fields.