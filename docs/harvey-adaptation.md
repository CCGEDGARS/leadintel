# Selective Harvey adaptation

Owner-authorized 1 November 2026. Reviewed reference: `ethanplusai/harvey`,
commit `b24c6b7143d270f835fc7b8e340f3d2f7ebe7304` (MIT; see
`third-party/harvey-LICENSE.txt`). These are bounded native extensions inspired
by Harvey's signal playbook and published-contact extraction. Harvey itself,
its heartbeat, subscription credentials and sending engine are not installed.

## Runtime changes

- `customer/research-brief.js` prioritizes already extracted official facts by
  supplied offer terms, selected-buyer functional terms, development context and
  source date. A date within 90 days has a small priority bonus; a source older
  than 365 days, future date, unsafe text or qualified/negative statement cannot
  become the recommended observation. Historical facts remain in the brief.
  Read timestamps do not stand in for publication dates. Undated observations
  explicitly provide no evidence of urgency. Ranking is lexical and advisory,
  not a semantic proof of fit or a buying-probability score.
- The brief's additive `signalSelection` explains the first usable observation
  with URL and exact source quote. The Buyers summary exposes that explanation
  in an optional details element. It does not select a buyer, approve a trigger,
  rewrite a saved draft or authorize sending. Automatic trigger selection uses this same priority before existing template
  usability tie-breakers, rejects stale/future/qualified/unextracted sources,
  and preserves reviewed choices. The explicit message application path receives
  the ranked facts. Policy and selection enter the
  context fingerprint; existing compatibility version and stored facts survive.
- `backend/src/published-email-html.js` decodes valid Cloudflare email-protection
  attributes/links and same-element `data-user` + `data-domain` attributes in
  the existing bounded direct public-page extractor. Script/comment removal
  runs first. Decoding is deterministic, bounded, makes no provider call and
  does not guess addresses. The original page URL remains the evidence source.
  These listings still pass existing employer/name attribution and mailbox
  confirmation gates. Public listing is not deliverability verification.

## Existing systems retained

Buyer selection already uses workspace-specific roles, function coverage,
source/current-role checks and qualified contact outcomes. Preserve
`rankedBuyerShortlist`, `topFourResearchCandidates`, `qualifyBuyer` and their
existing research/paid-contact gates rather than adding Harvey's two-person cap
or universal owner-first matrix.

Existing delivery code owns source-authority locks, recipient validation,
suppression, approved message snapshots, idempotency and reply handling.
No scheduling, approval, suppression, send-window, paid-provider or send-mode
setting changes in this adaptation. Generic Harvey email framework rules,
unsubstantiated reply-rate claims, fixed hiring-first signal order and
assumptions that a job posting proves pain/budget are intentionally excluded.
Canonical master scripts, Creator Library precedence and English originals
retain their existing authority. No new database migration or workspace skill
quota consumption is required.

## Verification

New regression suites:

```sh
node --test customer/test/offer-evidence-priority.test.js
cd backend
node --test test/published-email-html.test.mjs
```

Cover offer-specific/name-invariant ranking across industries, dated/undated/
stale/future/conditional facts, blocked snippets, cross-company isolation,
unchanged manual text and CRM reopen, actual public extractor -> contact
listing, malformed encodings and hidden script/comment removal.

Regression release gates: full customer suite, full backend suite, static build,
independent code review and exact-SHA production release integrity. Local
tests are controlled fixtures, not proof that a new real-world buyer or email
has been found. Production proof and authenticated customer outcomes must be
reported separately.

## Revert

Revert the adaptation commit(s) through the normal reviewed release flow.
There are no schema changes, external workers or schedules to dismantle.
Existing saved briefs safely ignore the additive selection field. Never erase
customer state or manual drafts to roll back this change.
