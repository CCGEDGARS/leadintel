# Contact attribution and role confirmation — 19 October 2026

The LKAB audit found a media-contact phone attached to Johan Menckel, missed public phones for David Englund and Tony Bogdanoff, a recruitment-contact description treated as a buying role, and an uncorroborated Managing Director profile ranked as a recommended executive. Gmail patterns appeared alongside discovered contacts.

## Root causes and prevention

- The phone parser used proximity to a name. Attribution now stops at another named contact, email owner, or press/referral section. A rejection marker prevents refresh merging from restoring a rejected number.
- Newly discovered source pages were not read in that pass. Up to three relevant pages per person are now extracted with footers, shared caching, independent retry state and explicit extraction failures.
- External listings were excluded from phone extraction and stripped on save/reload. Underlying text, employer and an exact named company-domain email now support external business listings. They retain external-source status and never acquire official-company or deliverability status. Both selected-target and pipeline normalization preserve the evidence.
- Role review distinguishes hiring contacts, source-supported roles and uncorroborated executive roles. Holds apply to recommendations, recipient handoffs and the approved automatic workflow before either public confirmation or optional provider reveal.
- Evidence review previously received the first 600 characters, often navigation. It now receives bounded passages around the actual people and preserves material conflicts when a provider fails.
- LinkedIn says **Profile matched automatically**. Gmail guesses are hidden. Company patterns are collapsed under **Unverified email patterns**. Source association, deliverability, phone reachability and purchasing authority remain separate.
- Evidence version 2 repairs legacy saved cards once. CRM intelligence snapshots retain role/attribution evidence; a legacy restore cannot falsely mark old evidence repaired. No customer-specific runtime routing or hard-coded contacts were added. Explicit full-page reads supersede search markdown; a cached snippet cannot restore a rejected number. Phone rejection also wins equal-timestamp merges. Role matching stays inside the named person's own clause, and supported source quotes survive skipped checks. The automatic workflow applies known role holds across the retained pool and prior records, including people outside the visible six-person shortlist.

## Reproduction sources

- David: https://lkab.com/en/work-with-us/available-jobs/384053-en-inkop/
- The phone on Johan's old card is assigned to Mikko Viitala: https://group.vattenfall.com/se/nyheter-och-press/pressmeddelanden/2022/hybrit-milstolpe-nadd---pilotanlaggningen-for-vatgaslagring-i-drift
- Tony: https://jobbsafari.se/jobb/automationsteknikerelektriker-till-sovringsverket-sasrb-20213553
- Current UK leadership illustrates the unresolved scope of Paul's generic title: https://www.lkabminerals.com/news/seven-years-of-gold-lkab-minerals-awarded-again-by-ecovadis/

These names are regression fixtures and evidence references. No outreach is authorized by this repair.

## Verification

Observed failing regressions cover cross-person phone attribution, inline referrals, another email owner, same-pass source extraction, missing employer completion, external contact save/reload, unresolved executive handoff, CRM snapshots and hidden Gmail guesses. Customer/backend suites, syntax, static build and exact-SHA production proof are release gates. Authenticated customer acceptance is recorded separately.

Local final verification: 2,976 customer tests and 686 backend tests passed, including public-source confirmation without Apollo/Hunter, saved-contact prioritization, attribution save/reload and the incomplete-query status regression. Static build and JavaScript syntax checks passed. Production and authenticated acceptance must be proved separately for the released SHA.
