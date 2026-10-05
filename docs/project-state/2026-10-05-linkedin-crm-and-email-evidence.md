# LinkedIn CRM handoff and email source precision — 5 October 2026

## Authenticated observations before changes

Edgars' Ercon → Sweden → LKAB workspace restored with ten named buyers. Four recommended cards were ordered Larisa Pekka (86), Mats Stålnacke (86), Robert Jonsén (81), Jeanette Berggren (73). Six additional candidates remained compact; four had explicit stale-role holds. Jeanette retained an Apollo-verified company email. Engineering/Operations coverage and three pending pool identities remained incomplete.

Clicking Larisa's Confirm LinkedIn & create message failed with `Unsupported CRM activity type`. The frontend posted `note`, whereas the backend permits specific activity types. Prior frontend tests mocked every activity as successful and missed the actual contract. Changed to `contact.linkedin_confirmed`, channel `linkedin`, and added that narrow type to the workspace-scoped CRM activity allowlist. The real route regression and frontend regression both failed before the change. Other arbitrary note types remain rejected. Exact profile/workspace qualification and synchronization gates remain in force.

The saved Mats address omitted a middle initial despite linking to CSR Sweden's LKAB page. Inspection of the cited page found `mats.o.stalnacke@lkab.com` immediately before `Kontakt: Mats Stålnacke`; the previous parser rejected this reverse-labelled middle-initial form. AI-generated contact summaries with valid citation URLs could also be treated as source text. They now carry `evidenceKind: model_summary` and do not supply contact findings without extracted page text. Focused contact fallback extracts source pages before matching email addresses.

Public email refresh rechecks previously saved email sources, replaces source-mismatched findings with addresses supported by extracted text, records exact rejected addresses, and preserves evidence with an unavailable status when extraction fails. Source checks are shared within the selected buyer batch and their decisions survive normalization/CRM snapshots. Existing provider-verified CRM contacts retain their separate verification path. No Gmail guess is promoted to ownership or deliverability evidence. No outreach is sent.

## Verification boundaries

Tests establish the CRM activity contract, email extraction, source-recheck behavior, and saved rejection traces. Exact production release proof and authenticated post-deployment handoff/reload observations must be collected separately. The pre-fix authenticated failure is evidence of the bug, not successful message creation.

## Prevention

For connected actions, test the frontend payload against the actual backend allowlist rather than a success-only mock. A cited AI answer is a discovery lead; extract the cited source before representing its email/phone as publicly listed. Preserve exact source addresses, including initials, and record failed source checks as unavailable rather than absence.
