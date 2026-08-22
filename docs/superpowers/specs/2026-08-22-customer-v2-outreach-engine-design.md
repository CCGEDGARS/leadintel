# LeadIntel Customer V2 Opportunity Dossier & Outreach Engine Design

## Goal
Turn a saved pipeline company into an evidence-backed opportunity dossier and human-approved outreach package without sending messages automatically.

## Scope
This milestone adds Step 6 to `/customer/`. It deepens research on one saved pipeline company, synthesizes a conservative dossier, recommends the best approved offer and buyer roles, creates editable email and LinkedIn drafts, and updates the local pipeline after human approval/contact actions. It does not send email, automate LinkedIn, expose hidden contact data, or fabricate company facts.

## Customer flow
1. Save a company to Pipeline in Step 5.
2. Continue to Opportunity Dossiers.
3. Select a saved pipeline company.
4. Run `Build dossier`.
5. LeadIntel scrapes the official company page once and runs no more than two targeted Firecrawl searches.
6. Review Why Now, recommended offer, buyer strategy, evidence ledger and clearly labelled commercial hypotheses.
7. Choose a discovered decision-maker when available, or use a role-based placeholder.
8. Review/edit email subject/body and LinkedIn message.
9. Approve the outreach package.
10. Approval moves the pipeline item to `Ready for Outreach`.
11. A separate manual `Mark contacted` action moves it to `Contacted` and records a local timestamp.

## Research budget and evidence discipline
- Maximum one official-site Firecrawl scrape per dossier build.
- Maximum two Firecrawl search requests per dossier build, five results per query.
- Existing Discovery evidence is retained and merged with deeper research.
- Every evidence item requires a valid HTTP(S) source URL.
- Official-domain evidence is labelled `Official`; other public sources are labelled `Public`; inherited candidate evidence is labelled `Discovery`.
- Missing or failed research never produces substitute facts.
- `Why Now` may summarize observed signal matches and evidence recency, but must not invent purchases, budgets, projects, hiring, expansion or intent.
- Commercial interpretations are stored separately as `Hypotheses` and visibly labelled as such.

## Dossier model
Each dossier stores:
- company, domain, website, market
- company opportunity score/confidence inherited from Discovery
- matched signals
- recommended offer
- target buyer roles
- why-now rationale
- evidence ledger with source URL/type/title/snippet/date
- commercial hypotheses
- research status and timestamp
- selected contact (name/title only when available)
- email subject/body
- LinkedIn message
- approval state/timestamps

## Offer recommendation
Use only offers already approved in the Company Intelligence Profile. Evidence/ICP token overlap may select the strongest offer. If no offer clearly dominates, select the first approved priority offer. Never invent a new product or service.

## Buyer strategy
Use approved decision-maker roles from the Company Intelligence Profile and discovered Apollo people already stored in the pipeline. No email or phone enrichment is performed in this milestone.

## Drafting rules
- Drafts are deterministic and grounded in dossier fields.
- Mention at most one evidence-backed trigger or context point.
- Avoid unsupported claims about the prospect's pain, budget, strategy or purchase intent.
- Use cautious language such as `may be relevant`, `it could be worth comparing`, or `I noticed public information related to...`.
- Default CTA is a short exploratory conversation, not a hard sell.
- Email and LinkedIn drafts remain editable before approval.
- Approval is mandatory before the pipeline can move to `Ready for Outreach` through this module.

## Pipeline behavior
The established stages remain:
Discovered → Qualified → Contact Found → Ready for Outreach → Contacted → Replied → Meeting → Proposal → Won / Lost.

Outreach approval sets the matching domain to `Ready for Outreach` unless it is already at a later stage. `Mark contacted` sets `Contacted` unless already later. Pipeline remains browser-local in the existing Discovery storage for this customer prototype.

## State and privacy
- Outreach state is browser-local under `leadintel_customer_v2_outreach`.
- Maximum 50 dossier/outreach items.
- Research text is clipped; no raw unlimited pages are stored.
- No personal email addresses or phone numbers are introduced.
- No email or LinkedIn message is sent automatically.
- Legacy `/v2/` remains untouched.