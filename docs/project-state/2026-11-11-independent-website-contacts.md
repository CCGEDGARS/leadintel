# Independent website contact research

Owner instruction: a supplied website is independent of the seller Profile. Find decision-makers and senior management first, retain other supported professional identities and published business contact details, use public sources/Firecrawl and Apollo identity-only discovery first, and require subsequent explicit approval for paid email or phone lookup.

## Cause and implementation boundary

The website extractor previously asked for seller fit, saved exclusions and exposed a fit filter. Its decision-maker button created a campaign and entered ordinary Buyers, whose seller qualification, ten-person shortlist, context hash and automatic paid permissions have a different purpose. Removing a label or inventing qualification would not repair that mismatch.

Website extraction and selection now ignore seller targeting. Descriptions require exact source text attributed to the selected company. Verified company homepages can supply their own short introductory description. Saved scans retain source evidence, and editing an identity clears its old description and verification.

The native `/api/websites/contacts` flow owns `website_contact_jobs` (migration 0075). It reuses public source transports, contact attribution/query plans, the shared invocation budget, registered minute scheduler, storage accounting and existing paid provider reservations/receipts. It does not write Buyer qualification, Seller Profile, chat or campaign state. Ordinary Buyers retain their existing contracts.

Company staff pages, public professional listings and Apollo identities remain distinguishable. Source-backed management and C-suite roles sort first, including common Danish/Swedish titles. Known role aliases do not create false namesakes or replace official evidence with an indexed result. Distinct name/profile/role conflicts remain separate and block paid readiness. Incomplete Apollo names trigger at most eight public follow-up queries.

## Coverage and authority

The initial discovery pass checks up to forty company pages, an Apollo leadership pass and four directory pages. It retains up to three hundred people and checks contacts in batches of ten. Larger structured staff pages are chunked before the shared parser's sixty-person limit. Coverage limits, partial checks, missing identities and access failures remain visible. This is accessible-source coverage, not a claim to enumerate every employee or private contact channel.

Each completed source operation checkpoints its actual outcome. Continuation budgets apply to a new batch rather than the lifetime job. Older response bodies rotate with read/query receipts and per-person quotations retained; an archived body needed again must be read again. Stop tolerates normal progress revisions, updates metadata only and preserves the newest checkpoint. Resume and paid approval require fresh revisions.

Writes bind the company identity/lifecycle, workspace, requesting session and exact role atomically. Seller Profile changes do not invalidate this research. Company, role or session changes discard late results. Stopped jobs remain resumable. Published additional emails and business Gmail matches retain their sources and unconfirmed status, separately from confirmed work addresses and company-wide routes.

Website jobs never invoke automatic paid continuation. A later approval binds the server-owned job, evidence revision, exact person, provider and one channel. Mandatory public, direct-email, phone, LinkedIn, business-Gmail, applicable deep and configured independent checks must finish first. Paid Apollo resolves a genuine provider identity; a website UUID cannot be submitted as an Apollo person ID. Existing provider activation, limits, cancellation, idempotency and retained billing receipts remain authoritative. Provider results restore through the exact CRM identity; provider role differences remain visible. No control authorizes outreach.

## Prevention and acceptance

Regressions cover unrelated/no seller context, cross-company descriptions, more than ten/sixty contacts, public profile and incomplete-Apollo acquisition, role aliases, namesakes, failed deep/independent checks, Stop/checkpoint races, actor/company races, native HTTP wake, registered scheduler, and fresh-browser restoration. Paid tests use actual native identity resolution, enrichment, ledger and CRM logic with controlled external HTTP responses; they spend no real contact credits and send no outreach.

The browser acceptance enters through the actual application and authenticated HTTP/SQL, closes the browser, invokes `app.scheduled`, and restores an unrelated finance company's CEO-first contacts in a fresh context. Shared-module changes must trigger backend CI/deployment evidence; release proof checks the new customer asset and backend version. Exact-SHA CI, production proof and authenticated customer acceptance are separate release gates; their resulting artifacts are recorded in the task evidence outside the source revision.

## Indexed identity correction

Authenticated Sun Finance acceptance exposed a publication author receiving a different named executive's role. Search titles are not person identities merely because they contain two words and the target company. Independent indexed acquisition now accepts only canonical LinkedIn professional-profile paths, excludes possessive publication titles, and requires description-derived employment to describe the parsed person. A quoted subject cannot supply an article author's role. Ordinary Buyer parsing keeps its existing scope.

The same admission rules apply to saved roster projection, resumed processing and paid readiness. Unsupported derived identities are quarantined on resume; valid IDs, raw source evidence and completed operation receipts survive. Regressions cover posts, profile activity subpaths, unrelated quoted subjects, valid apostrophe surnames, the surname Post, evidence-preserving recovery and rejection of previously completed invalid identities at the paid boundary. The actual job is paused until the corrected exact-SHA release is proven, then resumed in place for authenticated acceptance.
