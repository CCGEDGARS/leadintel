# Durable contact data and persistent green status

## Request and observed state

The user wants a completed contact-data update to remain visibly green and all returned profile information to survive later visits and research refreshes. The supplied screenshots and the authenticated browser both identify Klas Nilsson at Stegra as the updated contact. That existing lookup showed provider-reported profile information, a check time of `2026-10-21T18:09:22.759Z`, and $0.0145 lookup cost. No email or phone was confirmed. No new provider request or outreach was performed during this task.

## Root causes

- The button's green class depended exclusively on the email-recipient gate, even when profile-only enrichment had succeeded.
- A subsequent public-research snapshot replacement could discard the buyer's `contactData`. The immutable `contact.enriched` activity already retained that data, but normal profile hydration did not recover it independently of the snapshot or the recent activity page.

## Implementation

- Completed profile updates receive a separate green `buyer-data-updated` style and `Data updated ✓` label in both buyer-card renderers. Email `aria-pressed`, recipient eligibility and sending gates remain tied to actual accepted email evidence.
- CRM detail reads recover retained enrichment from workspace/company-scoped immutable activities. A window query returns a bounded selection of receipts per identity: the latest attempt, the last successful profile/phone, and the last nonempty value for each supported profile field. Later successful responses that omit an earlier field therefore cannot erase it. This does not depend on the 40-item activity timeline page.
- Older returned profile/phone fields survive inconclusive later attempts. The latest attempt status remains visible when it needs review. New receipts also retain the queried full name and professional profile identity.
- Retained data overlays matching CRM contacts and current buyer research. Browser hydration can recover it even with no aggregate research timestamp or with an empty newly saved roster. Name/profile checks prevent attaching it to a different known identity.
- CRM shows retained role, company, seniority, city, country, professional-profile link, provenance, phone listing status, check time and lookup cost. Profile-only results remain visible through the retained profile section even when the current research roster is empty.
- Archived contacts remain hidden while their activity history stays intact. Explicit permanent company removal retains its existing destructive semantics.
- Asset versions cover the changed browser entrypoints, Discovery CSS, CRM modules and CRM CSS. No schema migration or additional paid lookup is required.

## Verification

Observed RED/GREEN regressions cover the green profile-only button without outreach eligibility, stale research replacement, empty rosters, more than 40 newer unrelated activities, later failed lookups, workspace isolation, identity mismatch, archive visibility, browser-state normalization and CRM rendering.

Final commands:

```text
node --test customer/test/*.test.js
cd backend && npm test
npm run build
git diff --check
```

Customer suite: 3,454 passed, zero failed/skipped. Backend suite: 807 passed, zero failed/skipped. Total: 4,261 passing tests. Publishing remains blocked as described below. The production static build and deploy-contract check pass. Authenticated browser inspection confirms the existing saved lookup only; it does not prove the new implementation is deployed.

## Release boundary

Automatic approval review rejected the GitHub push, citing potentially sensitive source disclosure to an unverified destination and missing explicit publishing authorization. No workaround or alternate publishing tool was used. The source destination was subsequently confirmed as the existing public `CCGEDGARS/leadintel` repository through its connector metadata, but publishing remains paused for explicit user authorization. This is prepared source, not PROVEN PRODUCTION. After authorization: push the prepared branch, review/merge, await exact-SHA CI/deployment, obtain a PROVEN release-proof.json, and verify Klas's green status/details after reload in the authenticated app. Do not purchase another lookup to test retention.

## Authorized release and authenticated follow-up

The user subsequently approved publishing and deployment. The shell Git connection lacked credentials, so the connected GitHub API published the identical tested source tree (`f9ce460d0ee530cd5922bcb6bb28ce6d1c3271aa`). PR #698 merged as `49abf89d1c1adcba4d8aadf7a87762cd709d427a`; frontend/backend CI and backend deployment succeeded for that main SHA. Authenticated reload showed Klas's `Data updated ✓` button with computed green background `rgb(13, 100, 83)`, retained lookup timestamp/cost and separate email eligibility. CRM displayed the retained profile section directly from server history.

That CRM inspection also revealed a related hydration defect: a verified Treg work email already existed for the same external person, but a newer public-research record appeared first and hid the saved email on the Buyers card. The follow-up changes CRM detail ordering to prefer contacts accepted by the shared confirmation policy while retaining every source record. It does not create verification, merge identities, send outreach or purchase another lookup. RED/GREEN coverage reproduces the newer public copy and rejects an unsupported-provider/wrong-domain claim. Final release proof and authenticated Buyers verification must cover the follow-up main SHA, not stop at #698.
