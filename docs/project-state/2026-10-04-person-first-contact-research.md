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

The first live refresh recovered Joakim’s official email and direct phone, but exposed two additional defects: a per-request timeout aborted the whole contact flow, and collapsed paragraph boundaries let a later union representative’s phone be attributed to an earlier named buyer. The follow-up preserves source paragraphs, stops phone attribution at the next section, clears a wrong stored phone when its source is rechecked, continues after individual request timeouts, and persists completed evidence to CRM even when optional follow-ups fail. Regression coverage checks both phone attribution and continuation after a request timeout. Public phone listings remain unverified for deliverability.

A subsequent refresh showed that public profile titles can include the role before the employer. Scope matching now reads every employer-position title segment on the exact profile URL (including provider metadata titles), and identity queries are restricted to direct public LinkedIn profiles. This prevents role-bearing titles from hiding a subsidiary conflict.

The downstream check found ranked buyer controls using object-reference lookup against the original people array. Ranking copies records, so every ranked control could receive index -1. Controls now resolve the original index by stable buyer identity; regression coverage verifies the actual rendered action attributes.

Public scope checks can be incomplete. The existing LinkedIn review dialog now lets an operator record an opportunity-review hold with a source-linked reason. The hold persists in the workspace and CRM research snapshot, removes the buyer from recommendations and automation, and does not reveal paid contact data. Regression coverage verifies persistence and qualification rejection.
