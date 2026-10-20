# Buyer email confirmation and progress synchronization — 20 October 2026

## Reproduced failures

1. Two tabs could persist different `buyerResearchProgress` phase/label/step values for the same company. The three-way workspace merge treated these display captions as overlapping business edits, blocked synchronization, and disabled recipient selection. The authenticated browser reported exactly these conflict paths for LKAB.
2. Manual public-contact research extracted named official-company emails but saved them as public listings. The existing server-side source confirmation ran only through a separate contact action or selected automatic-flow path. Finding the address did not finish the free confirmation needed for Messages.

3. LKAB explicitly publishes purchasing addresses with `(at)` / `(dot)` notation. The extractor accepted only literal `@` addresses. The live official purchasing page returned zero named emails for Malin Barsk, Julia Öhrn and Linn Seger before the fix. A numbered alias such as `fredrik.eriksson2` also failed the name-pattern check despite being explicitly printed beside the correct contact.

## Changes

Only explicit bracketed at/dot addresses are decoded. Numbered aliases must still be physically present near the correct full name; no aliases are generated or promoted from patterns. Longer contact-card passages preserve the email beside a category description. The same extractor runs in the client and the source-confirmation backend. For cached identities, the final confirmation stage rereads each known official page once per pass before accepting a no-email outcome.

Qualified, researched contacts with a fresh official source-confirmed email are prioritized within the functional purchasing/operations slots. The two leadership slots, score ordering, stale-source checks and identity/role holds remain. All retained alternatives remain available.

The merge discards conflicting per-company buyer progress captions. Identity, recipient, source, email and role conflicts continue to require review; buyer evidence and independent edits are preserved. The UI reconstructs research status from saved results.

Every finished public-contact pass, including cached/resumed and partially completed passes with retained evidence, now runs the existing official-source confirmation endpoint for qualified buyers with an attributable official-company email. The endpoint rereads the actual page and records the person/email/source association in CRM. Source errors remain pending/error; the client does not invent verification. The request has a bounded deadline and checks workspace identity before accepting its response. Research cancellation stops new confirmations. The new contact-pass version causes older saved passes to receive this stage once.

This path invokes no Apollo/Hunter enrichment, sends no outreach, and does not change paid-provider consent or enabled Hunter deliverability requirements. Public listings on third-party sites remain distinct from live official-source confirmation.

## Verification

Observed red-to-green regressions cover the progress conflict and manual research → official-source confirmation → CRM result → durable reload. Failure coverage confirms unavailable sources remain errors and cannot fall through to a paid lookup. The customer suite and static build are required on final contents. Two production smoke checks require the new confirmation and progress-merge code.

Live source benchmark: LeadIntel's `fetchDirectPublicPage` and `sourcedBuyerEmails` recovered `andreas.jeppsson@bomill.com` and `alexandra.persson@bomill.com` from https://www.bomill.com/investor-relations/ on 20 October. This proves actual source extraction, not authenticated CRM acceptance, mailbox deliverability, or an LKAB result.

Authenticated workspace: downloaded a recovery copy and used the supported Keep my local changes action; the header returned Synced to LeadIntel. A fresh LKAB buyer run was started to revalidate the edited role selection. Completion, current-role evidence, usable confirmed emails and Messages handoff must be assessed from its actual result. None is established by passing tests or the BoMill source benchmark alone.

Live LKAB benchmark after the fix: the actual official purchasing page yielded `malin.barsk@lkab.com`, `julia.ohrn@lkab.com`, and `linn.seger@lkab.com`. Their published categories are respectively steel/drilling materials, processing-plant supplies/automation, and mine/plant/port projects. These are official-source associations, not mailbox-delivery guarantees.

Backend verification uses `TZ=UTC`, matching the Worker and CI environment. Running existing campaign fixtures with the scratch shell’s America/Los_Angeles timezone misinterprets SQLite UTC timestamps without timezone suffixes as future local times; this was diagnosed rather than bypassing an email eligibility gate.
