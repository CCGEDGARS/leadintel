# Workflow acceptance audit — 8 November 2026

## Outcome and scope

Owner request: exercise LeadIntel step by step, repair failures, and verify the connected saved workflow. Actual customer acceptance remains **OPEN**. Local controlled acceptance is separate from release proof and from actual provider/contact outcomes.

Source baseline: `2a3645f4857eb422ff7df9db828226468694da93`. The initial checkout was `9731e62d`; it was fast-forwarded before the recorded checks below. Earlier checks against that checkout are not substituted for the updated-source checks.

While the audit ran, main advanced to `ee07c362c63b042adebe5d680aacb1405618d60f`. Local results below remain explicitly tied to the earlier baseline plus these test repairs. PR #906 CI tests merge revision `ccb4bc59059d637397c575fd7d3ee7ccd8a048f5`, combining repair revision `8ddec9fc3c07dffb984f171fae8e8f5c774649e9` with that newer main. The focused Profile/Strategy browser job passed on this exact merge (run `42487560804`, job `128752678823`). This is CI integration evidence, not production release proof.

No customer runtime code changed in this audit. The repairs concern acceptance-test correctness and execution. The customer's screenshot of a Profile preparation failure remains unresolved; no claim is made that these repairs fix that error.

## Repairs

1. The Buyers competing-revision scenario called a change to `answers.meeting_value` unrelated. Profile answers participate in reviewed targeting/Strategy context; changing one legitimately locks downstream navigation. The scenario now changes the normalized brand color, verifies that change survives the merge, and retains the same-person conflict checks. A scratch experiment with an arbitrary top-level note was rejected because that key is not retained by application normalization. The passing case uses an actual supported saved field.
2. The Buyers action runner tried to capture a progress element while polling replaced that element. Chromium failed with `Element is not attached to the DOM`. Full-page screenshots avoid retaining that detached element. Assertions on overdue state, pause, preserved receipts, resume, status recovery, cancellation and reopen remain in place.
3. Running the Buyers action file directly previously performed no acceptance work: it exported a function without a command-line entry point. It now has a direct entry point, a default artifact directory, explicit nonzero failure exit status and `LEADINTEL_BUYER_ACTION_ARTIFACT_DIR` support. Importing it still does not start a test.
4. The expanded Messages test covers repeated fresh browser contexts, owner-library personalization, LinkedIn and phone drafts. Its 150-second whole-test deadline cancelled it in both full backend runs although the standalone journey passed. Its whole-test budget is now 240 seconds; individual action deadlines and assertions remain. The phone catalogue request-start promise also has an explicit 10-second deadline, releases its gate on failure and reports a specific missing-dispatch error rather than waiting indefinitely.

## Coverage obtained

All browser checks below use shipping frontend code, controlled authenticated sessions and local production-route/SQL fixtures. Provider responses are controlled; these are not the owner's signed-in browser or a production customer database.

| Area | Evidence obtained | Remaining boundary |
| --- | --- | --- |
| Setup | Website activation, country controls, material upload/evidence, unavailable source recovery, save failures, early website input, fresh reopen; desktop and narrow viewports | Actual customer source/provider run |
| Profile | Edited answers, targeting confirmation, acknowledged persistence, fresh reopen, narrow confirm control, failed-save feedback and retry | Screenshot's actual failed request and provider output |
| Strategy and Companies | Frontend approval/stale/search/selection contracts; exact-merge CI browser job exercises Setup → edited Profile → targeting save → Profile approval → Strategy activation → completed empty company search → fresh reopen/late navigation | Controlled empty search; no claim of an uninterrupted seven-stage real-provider journey |
| Buyers | Official-source confirmation, delayed source, unrelated revision merge, same-buyer conflict, exact recipient handoff and CRM reopen | Actual research quality and contact yield |
| Buyer controls | Overdue state, stop, resume same job, status outage/recovery, cancellation, retained identities/receipts, mobile layout and English reading view | Actual customer's saved run lifecycle |
| Paid contacts | Controlled one-priority-person email/phone execution, saved allowance, browser-independent scheduler continuation, reopen and zero repeated purchases | Real authorized email and phone calls not executed |
| Messages | Core styles, invalid preparation/retry, exact manual draft, failed-save recovery, newer CRM recovery, two-buyer isolation, LinkedIn and phone drafts, fresh reopen | Actual-model quality and customer acceptance |
| Delivery | Loading/error recovery, exact approved identity, accepted/unknown submission handling, CRM outage recovery, manual record and cross-workspace isolation | No real send performed |

This table is a scoped control audit, not an exhaustive inventory or proof that every app button works.

## Verification record

- Full customer suite: **5,749 passed; zero failures, cancellations or skips**.
- Static production artifact build: passed.
- Standalone Setup, targeting, Buyers, Buyer controls, controlled paid Buyers, Messages and Delivery journeys: passed on the updated baseline with the runner repairs described above.
- Source hashes in Setup (34), Buyers (17), paid Buyers (12) and Delivery (14) evidence were compared with the working tree and all matched. Other runners do not provide that same source-hash manifest; they are not described as equivalently source-bound.
- Initial concurrent backend run: 1,883 passed, four failed and three cancelled. Two Buyers tests and the Messages test reached their test deadlines. Later fixture failures included a previous fixture's network interception rejecting another fixture's loopback origin. That run remains a failed run; standalone passes do not erase it.
- Backend rerun without the concurrent frontend suite or additional browser journeys: 1,889 passed, zero failed and one cancelled at the Messages whole-test deadline. This remains an unsuccessful run.
- Final full backend run with the revised Messages budget: **1,890 passed; zero failures, cancellations or skips**, 275.5 seconds overall. The Messages browser journey completed in 160.8 seconds, demonstrating why the former 150-second whole-test budget cancelled valid work. Its evidence is `/tmp/leadintel-step6-test-ZkkZjB/evidence.json`.
- PR #906 Backend CI run `42487560846`: success. Customer V2 CI run `42487560804`: pending final result.

Reproduction commands:

```sh
node --test customer/test/*.test.js
npm --prefix backend test
node scripts/verify-step1-journey.mjs
node scripts/verify-step5-journey.mjs
node scripts/verify-buyer-action-journey.mjs
node scripts/verify-step6-journey.mjs
node scripts/verify-step7-journey.mjs
bash scripts/build-vercel-static.sh
```

The targeting and paid-journey modules are imported by the backend browser tests; merely invoking those exported-function files directly is not a recorded test pass.

## Actual account, provider and release gates

- User authorization includes Firecrawl plus at most one real paid email lookup and one real paid phone lookup. Actual calls in this audit: **zero email, zero phone**. No outreach was sent or queued in the controlled journeys.
- No browser-control connector or usable shared browser-management socket is available in this session. The supplied Companion Page has no page ID/document view. A screenshot establishes visible state, not the ability to operate that Chrome tab.
- Direct Chromium/curl requests to the app, its deployment hostname and the Worker were rejected by this execution environment's network proxy (CONNECT 403). This is not evidence that the app itself returned 403.
- The Vercel connector could read deployment records and the public release manifest. Both referenced baseline SHA `2a3645f4857eb422ff7df9db828226468694da93`. Its attempt to read `/api/session` returned a 401/access failure and did not establish a customer session. No authenticated operational requests were made through it.
- Retrieved Vercel runtime records showed `url.parse` deprecation warnings; these do not establish the cause of the Profile error. The screenshot's `Unexpected token '<'` suggests a non-JSON response but does not identify the failing request or its origin. No speculative runtime patch was made.
- No new runtime release or same-SHA PROVEN release proof was produced. Deployment READY and a matching public manifest are not substituted for that proof.

Completion criteria still open: control an authorized test/customer browser, reproduce and resolve the actual Profile failure, execute the bounded real-provider checks, and demonstrate the saved Profile → Companies → Buyers → Triggers → Messages → CRM journey with real source-backed outcomes. The owner should not be asked to act as the basic control tester.
