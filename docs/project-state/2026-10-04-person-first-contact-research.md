# Person-first buyer contact research

## Root causes and changes

Manual email research searched eight guessed-address alternatives before a focused official-domain full-name query. The generic company contact pass used six first names and leadership/contact keywords, which missed recruitment pages. Email-query rows were consumed only for email extraction, so direct phones on those pages were discarded. The new first query is `site:company-domain "Full Name"`, followed by a focused full-name/company query, before guessed address and Gmail searches. Both passes extract attributable names, emails and phones, preserve URLs, and retain per-person incomplete research status. Official email evidence takes precedence over syndicated results for the same address.

The automatic server research now also performs the official-domain full-name query. Neither path invokes paid Apollo reveal or Hunter verification as part of public contact discovery.

Public employment parsing previously accepted a target-company name followed by subsidiary words after `at`. The company boundary now requires the actual target employer. Existing records are rechecked against the same direct LinkedIn profile URL and exact full name; an explicit subsidiary title stores a sourced opportunity-scope hold. A known country differing from the target market, including an explicit UK-scoped job title, also holds the buyer. These buyers remain visible for review and cannot be highlighted or advance merely because their email is verified. The automatic workflow applies the same scope holds to cached CRM contacts. Unknown responsibility remains a qualification gap, not fabricated purchase intent.

Named public phone extraction retains official pages and LinkedIn job adverts with exact full-name attribution; it does not unlock private directories or mark numbers provider-verified. A historical phone listing remains unverified. Public-source email acceptance still requires the existing server-side official-page recheck and selected confirmation policy.

Public contact refresh also writes the CRM company research snapshot. That snapshot now retains public email/phone details, their source URLs, unverified phone status, country/employer context and sourced scope holds. Direct contact records retain the existing email-verification protections.

## Regression coverage

- Person-first search recovers email and phone from a generic official recruitment page when guesses return no results.
- Automatic research independently recovers an official email and phone without enrichment.
- Foreign-market and subsidiary buyers are held, cannot be highlighted, and retain source/reason through reload.
- Unrelated same-name profile URLs cannot introduce a scope hold.
- Failed searches remain incomplete; guesses remain unverified.

Local checks and exact-SHA production proof are separate from authenticated customer acceptance. No sending is authorized by this change.

## Authenticated refresh follow-up

The authenticated LKAB public refresh on 4 October executed 36 email evidence searches with Apollo email/phone and Hunter disabled, then hit an optional contact follow-up timeout. The timeout path preserved local discoveries but skipped qualification recomputation and the CRM snapshot write. Finalization now always recomputes qualification, marks partial research incomplete, merges the evidence pool and attempts the existing CRM contacts/snapshot save. It preserves the error/retry state and never upgrades a partial provider run to complete. Regression coverage forces an optional review timeout with a foreign-market contact and verifies the scope hold plus completed email-research evidence in the durable CRM payload.
