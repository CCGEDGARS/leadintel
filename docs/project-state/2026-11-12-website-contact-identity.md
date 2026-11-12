# Website contact identity matching and saved-result recovery

Owner request: the Sun Finance contact is present on LinkedIn but paid buttons are locked; correct the matching and check the other contacts. This is independent website contact research, not a waiver of recipient, seller-fit or outreach approval rules.

## Evidence and reproduced causes

The supplied screenshot establishes a Sun Finance search result and another same-name result labelled with GE Money. It does not by itself establish that the saved app conflict is false or that both results are different people. The private workspace job, its source receipts and provider account were not accessible.

Code and controlled fixtures reproduced these defects:

- Website roster joining compared complete localized LinkedIn URLs, treating lv.linkedin.com/in/person and www.linkedin.com/in/person as different profiles. A later name-count pass labelled duplicate rows a namesake conflict.
- The shared public profile matcher required identical spelling, rejecting a unique Elina/Elīna or Emils/Emīls match despite full-name/employer evidence.
- Employer-history detection flattened line boundaries and let a former-employer statement borrow a company name from the next section. Conflicts from a different same-name profile could also invalidate an independently matched target-company profile.
- Independent website paid readiness required an official company-page identity even when a unique professional profile had current name/employer matching evidence and mandatory public checks were complete. A bare URL and a verified match were not distinguished in the card's explanation.
- Saved duplicate records were not repaired by reopening; an identity hold had no dedicated fresh profile-check action.

## Repair

1. Compare professional profile paths for identity equality while preserving actual source URLs. Reject posts/activity subpages. Fold accents for full-name comparison, preserve the original display name and official source, and continue requiring unique profile/employer evidence. Different surnames, distinct profile paths and contradictory current employers remain held. Cyrillic transliteration is not automatic identity proof.
2. Keep employment-history line boundaries. Scope conflicting current-employer evidence to the retained/matched profile; an unrelated namesake is not a contradiction on the target person's profile. Current employer statements on the same profile remain blocking. Explicit current-employer statements in role headlines are also checked.
3. Reconcile server-owned saved website rosters from retained current search receipts. Only compatible full name/company/role records with the same professional profile or same actual source join. Retain the stable original ID, prefer the record holding paid data, preserve merged IDs, and archive the removed original with its receipts. Independently saved paid outcomes and distinct profiles are not combined. The retained primary CRM record takes precedence over archived aliases; ambiguous alternate records remain unassigned. Genuine holds remain.
4. The authenticated review-identities action repairs only saved evidence, starts no provider and preserves status/deadline. Opening an inactive legacy job invokes it once; active jobs reconcile under their existing lease. Revision, session/role and exact company/lifecycle guards remain. Paid in-flight approvals are invalidated by the existing freeRevision change. Replaying a completed saved repair is idempotent. Saved replay preserves the actual source acquisition date. Expired or undated cached queries are reacquired on continuation, with previous evidence retained in bounded history; they cannot be relabelled as freshly verified.
5. Independent website paid identity support accepts either the existing official source or a unique, dated professional-profile matching receipt bound to the exact full name, selected profile and current company. It still requires full mandatory public checks, no identity/employer/profile conflict, current data, explicit provider/channel approval and existing billing limits. A bare link cannot unlock it. These changes do not authorize a purchase or send, and do not waive ordinary Buyers qualification or email-recipient requirements.
6. Refresh identity checks is an explicit public-only action. It reacquires the profile query, preserves previous search evidence in bounded history and reuses completed sibling email/phone/Gmail/deep checks. Provider failures retain the existing hold. It uses the existing five-minute pass, ten-contact batch, source-attempt bounds and scheduler. It does not run automatically or change paid consent.

## Public-source audit, 12 November 2026

This coding session used the connected Firecrawl tools, not the customer's in-app provider credentials. Search results are excerpts unless stated otherwise.

| Supplied contact | Evidence obtained | Remaining limit |
| --- | --- | --- |
| Aleksandrs Čerņagins | Public indexed profile https://lv.linkedin.com/in/aleksandrscernagins matches Sun Finance. Firecrawl returned a provider-backed professional record for that exact URL, listing Sun Finance CEO, Latvia as current and GE Capital wealth-management work in 2007–2010. | The professional record came through Fullenrich via Firecrawl, not a live authenticated LinkedIn page. Provider record-update freshness was unavailable. This supports distinguishing history from current identity, not claiming the private app record was repaired directly. |
| Elīna Zerne | Official company leadership page: CFO. Indexed profile https://lv.linkedin.com/in/elina-zerne-86536969: Elina Zerne, Group CFO at Sun Finance. | Public indexed matching, not deliverability or private profile access. |
| Emīls Latkovskis | Official company leadership page: Co-founder & COO. Indexed profile https://lv.linkedin.com/in/emils-latkovskis-01847919: Emils Latkovskis, Co-Founder and COO at Sun Finance. | Same indexed-evidence limit. |
| Roman Kornienko | Official company leadership page: CIO. A public indexed profile at https://lv.linkedin.com/in/%D1%80%D0%BE%D0%BC%D0%B0%D0%BD-%D0%BA%D0%BE%D1%80%D0%BD%D0%B8%D0%B5%D0%BD%D0%BA%D0%BE-945110179 lists Роман Корниенко, CIO at Sun Finance and prior CTO work. | Candidate across scripts; no automatic identity confirmation based solely on transliteration. |
| Ašots Torosjans | Official leadership page: LATAM/SEA HUB CEO. Exact and broader profile searches were attempted. | No direct profile established. A third-party list excerpt under an alternate name is not enough to invent a profile URL. |
| Toms Jurjevs | Official leadership page and dated Nasdaq company statement: Founder/CEO. Search returned public posts. | Post handles are not direct profile URLs; none was invented. |

The official about-us page was read in full through Firecrawl with maxAge=0: https://sunfinance.group/about-us/. It also publishes Agris Vaselāns (CRO), Roberts Molotanovs (CLO), Margareta Brice (Head of HR), Gatis Treimanis (Europe HUB CEO), plus named investor/public-relations routes. Their appearance there establishes published roles, not private contact ownership. The homepage was returned from a dated Firecrawl cache. A separate free Apollo connector preview was blocked by that connector's provider-terms requirement; no terms were accepted and no preview or contact reveal executed. This does not establish the customer's in-app Apollo readiness.

## Regression and acceptance

- Red/green cases for accent variants, localized hosts, unrelated namesakes, same-profile current-employer contradictions, history section boundaries, post subpages and free directory identity provenance.
- Real SQL and registered scheduler: directory aliases join the official record; full actual mandatory plans run; unique profile evidence enables paid readiness but missing provenance or approval does not.
- Native HTTP saved repair: archived receipts and original paid-record ID survive; no provider call or deadline extension; distinct profiles remain held; a company replacement rejects the late write.
- Explicit native identity refresh repeats the profile query once and reuses completed sibling checks; no paid attempt occurs.
- Native authenticated browser, desktop/mobile: saved duplicate is repaired on open; the original accented name and one card remain; eligible paid controls open the normal confirmation, Cancel spends nothing; Refresh, Stop and fresh reopen retain history.

## Compatibility and rollback

No database migration or template changes. New optional state fields are identityReviewVersion, identityArchive and bounded identitySearchHistory; existing source/task/paid receipts are retained. The paid policy amendment applies only to independent website contact identity support. Restoring the previous UI/worker reimposes official-only paid eligibility but retains archived source records; users must not be told rollback deletes a valid contact or refunds a purchase. Cache versions and exact-SHA release checks must be updated together. Code/controlled acceptance, production freshness, public-source research and private-customer acceptance are separate claims.

Local acceptance before publication: full customer suite 5,947 passed, zero failures (two SQL/browser cases run separately in required CI); focused backend suite 37 passed with no skips; all three authenticated desktop/mobile website-contact journeys passed; static build and diff checks passed. Actual indexed-source matcher audit recognized Aleksandrs, Elīna and Emīls; Roman, Ašots and Toms remained unresolved direct profile matches. Production and private-customer acceptance require separate evidence.
