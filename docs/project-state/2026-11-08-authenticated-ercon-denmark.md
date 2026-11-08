# Authenticated Ercon → Denmark acceptance

Owner authorization: operate LeadIntel as Ercon, find customers in Denmark, exercise the user journey and repair errors. Firecrawl is authorized. Real paid-contact cap: one email lookup and one phone lookup total. No outreach is authorized.

## Observed account state

- The owner authenticated the Firecrawl-hosted browser. The workspace showed Ercon's activated `www.ercon.lv` website, Denmark as the sole target country, an existing eight-page website PDF and the saved commercial brief.
- Review text opened the PDF's full extraction, including engineering, serial production, project manufacturing, installation and workforce services. The original was retained.
- Both paid contact permissions were initially ON. They were switched OFF through their visible Setup controls before company/buyer research, to prevent automatic paid continuation from exceeding the owner's total allowance. Manual delivery was saved and acknowledged. The eventual selected-person paid test still requires explicitly re-enabling its corresponding channel and checking actual receipts/limits.
- Automatic approval review rejected an attempted Delete-button test on the existing PDF as an unacceptable risk of deleting saved material. No deletion was executed. Use disposable data for destructive acceptance; the owner's saved material is not an expendable fixture.
- Continue to Profile executed actual Firecrawl searches/reads. The research metadata retained 12 sources and execution receipts, including one failed public search. No paid email/phone lookup or sending was performed in the inspected portion.

## Reproduced defect and repair

The combined company-research controller starts a 60-second deadline before website/search collection and passes its same signal into AI preparation. In the actual trace, collection began at approximately 14:19:55 UTC; the AI request began at 14:20:30 and was aborted around 14:20:55. The UI reported `AI synthesis stopped after 60 seconds`, even though AI had received only about 25 seconds. Sources and existing manually supplied answers survived. The recovery UI eventually exposed Retry AI profile preparation. A brief in-progress summary remained visible while completion/save was finishing; this was not established as a permanent spinner defect.

A deterministic regression completes three source waves in 20, 20 and 10 seconds, each within the existing 25-second request budget. Before repair, the original deadline cancels a ten-second-old AI request; the test fails at that exact assertion. After repair, synthesis receives an independent bounded 60-second stage. A stalled provider still aborts at its own deadline, saved evidence remains available and task cancellation targets the active synthesis controller. Workspace/input guards remain intact. No provider or research-admission limits were raised.

The repair also announces the AI stage and describes research as normally taking 1–2 minutes. Only the changed module's loader and HTML entry are cache-busted. Release smoke checks identify those exact assets; a smoke marker is not a substitute for behavioral acceptance.

## Evidence and remaining acceptance

- Focused company research, adviser, Setup and Step 2 tests: 185 passed before the full final run. The new slow-source regression failed on the original implementation and passed after the repair.
- Static build and changed JavaScript syntax checks passed.
- Full suites, CI and exact-release proof must be recorded before a release completion claim.
- The hosted browser session was destroyed while inspecting the separate saved-evidence retry. Its final AI outcome was not obtained. This is an external access interruption, not evidence that the retry succeeded or failed.
- Actual Profile approval → Strategy → Danish customer discovery → Buyers → triggers/messages → CRM reopen → Delivery preparation remains OPEN. Real contact outcomes and the authorized two paid actions remain OPEN. Neither local tests nor a release proof closes those business outcomes.

No session tokens, cookies, provider credentials or shared-browser access URLs belong in this record.
