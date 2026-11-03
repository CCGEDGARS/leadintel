# Paid buyer continuation — 3 November 2026

Owner request: verify Settings and Step 1 against automatic email/phone research for the retained buyer pool, and fix mismatches. This is an explicit amendment to the earlier default initial/free-only rule. Per-person Recheck stays free-only; sending remains separately authorized.

## Observed cause and correction

Settings and Step 1 already share `additional_contact_policies`; they are mirrored controls, not two independent permissions. The UI forced one buyer on activation, shared targeting capped two and subtracted free-confirmed people, the database/API accepted only one or two, and the durable job skipped the legacy browser automatic hook. The approved unattended workflow also selected a recipient before processing the other approved buyers.

Keep the existing ledger and provider adapters. Extend the owner-configurable per-company limit to the bounded ten-person retained pool. Preserve every existing flag, budget, approval and timestamp. Expose explicit limit editing in both views; channel activation preserves saved limits. No migration activates paid research or increases an existing customer's spending approval.

Company-wide research captures current paid intent, completes required free/source and AI evidence checks, then uses the shared server continuation for missing enabled channels in relevance order within all three saved limits. Confirmed channels are reused. Per-person Recheck, preference saves and read-only reopening cannot initiate paid calls. A later activation cannot upgrade an earlier free-only request. The browser refreshes the current permission before choosing an explicit free-only or paid-capable command; incomplete free jobs retain their existing ID and completed source receipts.

Durable jobs continue independently of the browser. The approved workflow holds at Buyers while a provider lookup is pending, releases its lease, and resumes under fresh workflow authority on the next scheduler invocation. Pending recovery reuses the saved reservation and idempotency key, including at the company cap, with bounded recovery checks. Provider failures do not create confirmed data or authorize sending.

CRM is authoritative. Claim the research snapshot using exact snapshot CAS and job/workflow authority. Compare current evidence inputs AND current eligibility outcomes (AI review, agent verdicts, dossier employment conflicts, role/market responsibility and company qualification) before and after provider work. Typed scope changes block persistence and recipient advancement. Final workflow persistence merges only paid diagnostics into the current raw snapshot under CAS; it cannot replace manual holds. Reopening hydrates one unambiguous accepted exact-person email beside unconfirmed source records; conflicting accepted addresses stay held.

## Acceptance evidence and limits

Controlled adapter tests exercise the real Treg phase/charge ledger, CRM confirmation, multi-buyer dispatch, independent channels, revocation, caps, pending recovery, migration preservation, workflow scheduling and post-provider manual holds. The actual HTTP/Chromium journey exercises Refresh, closing the browser during work, four verified CRM emails, fresh browser reopen, green email buttons and zero duplicate provider dispatch on restore. Responses are controlled; these are not real paid lookups or real customer yield.

Required release gates remain same-SHA Customer CI, Backend CI/deploy, mandatory browser journeys and `release-proof.json` verdict PROVEN. Authenticated customer acceptance remains OPEN: no private production workspace settings, provider balance or live contact yield were available in this session. Never turn controlled four-email evidence into a claim that Viscaria now has four live verified contacts.

Rollback: the widened database constraint preserves old values and remains readable by the prior application. Reverting application code reduces available targeting; it does not require deleting lookup ledgers or downgrading owner-selected values.
