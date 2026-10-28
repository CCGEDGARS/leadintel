# Buyer Agent

Owner-approved 28 October 2026. Runtime version `buyer-agent-20261028-v1`.

Buyer Agent extends the existing Buyers research workflow. It is invoked by explicit buyer discovery/recheck and approved automatic research, never by opening a saved page. It is not another standalone chatbot or a new numerical score.

## Inputs and tools

Build context from the shared source-backed company brief, its strongest verified development, workspace seller offer, opportunity hypothesis and evidence gaps. Keep the development quote, URL and dates. A source quote about a plant in Boden supplies project geography, not a new employer named Boliden. Unknown triggers remain unknown. Unverified commercial relevance stays a hypothesis.

For every retained full identity, add two bounded public search queries covering current employer/role and project, industry, association, event/speaker, interview and PDF evidence. They use the existing search/extraction adapters, two-person concurrency, source-page cache, 24-page and 180-second limits. `contactResearch.checks.buyer_agent` retains actual query outcomes, counts, times and failure reasons. Existing successful same-plan checks are reused; no new provider is advertised as installed. Restricted LinkedIn scraping is excluded.

Read named passages support identity/employer/role separately from opportunity responsibility. Search snippets, model summaries, vacancies, recruitment contacts and stale dated biographies cannot establish a current role. Another exact profile is a separate candidate, not evidence that the saved person changed jobs. Generic title fit does not establish responsibility for a particular project. Conflicts block qualification; uncertainty stays Needs review.

## Independent review and downstream boundaries

The existing AI supervisor receives exact profile URLs, employer, the source-backed brief/development and targeted-check coverage in both manual and automatic paths. It reviews supplied evidence without web access and cannot approve spending, invent contacts or send.

New automatic recipients require supporting Buyer Agent identity evidence and completed targeted checks in addition to existing qualification, AI review, contact confirmation and spending controls. Accepted saved contacts retain their existing reuse policy. Opportunity fit, research completion, identity assurance, email/phone availability and contact ownership remain distinct. A completed search never guarantees a phone number exists.

The company quality panel includes Buyer Agent coverage. The compact panel shows trigger provenance, person checks, sourced quotes and gaps. Reports and query receipts survive workspace normalization and CRM snapshots. Changes to identity/profile or company context invalidate review signatures; cancellation/workspace guards prevent stale writes. Paid Apollo, Hunter and Treg controls remain separate.
