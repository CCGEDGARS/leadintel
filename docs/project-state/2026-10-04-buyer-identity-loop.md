# Combined buyer discovery and pending identity loop

## Authorized outcome
Use public discovery plus free Apollo people search, resolve full names, verify employer/role attribution, research public business/Gmail/phone evidence, preserve CRM history and hold paid contact enrichment behind existing explicit approval. No outreach was sent or newly approved.

## Root causes and changes
- Manual and automatic paths skipped directory discovery once three public names existed. Both now run identity-only Apollo search alongside public discovery when configured; no contact-reveal flags are added.
- Pending first-name records never entered public surname follow-up. A shared bounded resolver searches first name + employer + title in publicly indexed LinkedIn and open-web results, for up to ten pending records. Only one supported current-employer/role full-name match can resolve an identity. Two names, distinct profiles for the same name, duplicate directory claims, failed search coverage, wrong employers and roles remain pending with reasons. Stable directory IDs and keep preferences survive resolution.
- Public URL identities and directory/name identities could duplicate one person. Merge now reconciles stable IDs or a unique compatible full name, employer, role and profile, while preserving contacts, keep state and flow state.
- Generated roles could truncate the user's configured roles; confirmed roles now stay in the opportunity plan. Recommendations cover distinct relevant buying functions before repeated roles, retaining ranked choices and kept candidates.
- Final public contact updates now merge back into the wider pool before CRM synchronization. Existing company/Gmail pattern, explicit full-name Gmail, public phone, Hunter and approved Apollo confirmation paths remain in place. This change does not claim all mailboxes or phones will be discoverable.
- Manual deadline accommodates the additional five bounded identity waves (450 seconds). Individual searches remain bounded/cancellable; final public-contact research retains its separate bound.

## Verification
Regression tests exercise four public names plus Apollo discovery; historical pending identity follow-up; unique, ambiguous and incomplete identities; duplicate claims; legal-industry portability; role preservation/diversity; detail merging; resolved state/diagnostic save and reload. Automatic integration uses a workspace SQLite fixture and mocked public/Apollo providers, confirming five full identities and zero paid match requests when contact confirmation is unapproved.

Full customer/backend suites and static build must pass on final contents. Exact production SHA must pass CI, manifest, health and mandatory release checks before production claims. Authenticated LKAB acceptance is still distinct: customer screenshots establish earlier provider recovery and four names, not acceptance of these new identity loops. The assistant browser did not provide an authenticated customer session. Missing direct contacts and current buying authority are evidence gaps, never inferred successes.
