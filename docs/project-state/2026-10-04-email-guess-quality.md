# Email guess quality — 4 October 2026

## Problem and behavior
Manual research generated 20 guesses per buyer, including ten Gmail permutations. Official-domain listings could be accepted without the buyer's full name, and substring matching could confuse a guessed address with a different address. Automatic research had its own looser extraction path.

The shared discovery engine now ranks at most eight company-only research guesses. It learns formats from distinct named contacts with official same-company sources, preserves hyphens and offers flattened alternatives, transliterates supported Latin names, and rejects incomplete identities, malformed domains/addresses, generic inboxes, recent invalid checks (30 days) and addresses already attributed to another person. Learning remains scoped to the candidate's company; duplicates do not increase support. Evidence counts describe observed formats, never a probability of deliverability.

Both manual and approved automatic research use the shared sourced-address parser. It requires an exact full-name boundary, an exact company email domain, an actual address token and a safe public source URL. Non-pattern company addresses require explicit name/address attribution. Gmail is researched by full name plus company rather than generated; it requires explicit person/company/address attribution. Guessed/predicted format examples are excluded. Public listings remain `public_unverified`; guesses remain `guessed` and cannot qualify for automatic sending. Existing Apollo verification and optional Hunter settings stay authoritative.

Manual research learns from already-acquired pages before parallel lookups, prioritizes the leading pattern in the focused grounded-search fallback, and deduplicates recovered listings. Automatic research includes its top three patterns in the existing bounded email query. A collapsed buyer-card section explains the top three research guesses and the evidence for their format when no company address has been found. It is computed from persisted buyer/source data, so no new storage migration is required.

## Validation
Customer and backend suites, static build, syntax and diff checks. Regression cases cover observed format ranking, independent named contacts, company isolation, hyphens/diacritics, rejected identities, recent versus stale invalid checks, generic inboxes, wrong-domain suffixes, full-name prefix collisions, exact-address token matching, non-pattern public emails, unrelated directories, explicit Gmail attribution, grounded search recovery, provider failure states, and automatic research without paid reveal.

Release requires exact-main-SHA CI success, matching production manifest, backend health and mandatory smoke checks. The email-quality engine has its own mandatory production smoke check. Authenticated retention and served-JavaScript checks are separate from mocked provider regression evidence; no new live-provider search or outbound email is used for testing.

## Limits
This is research screening, not mailbox verification. DNS/MX checks and live SMTP probing are not added by this change. Public examples cannot prove a uniform company format or mailbox existence. Public evidence can be outdated. Gemini is used only through the existing actual grounded-search path when needed; no AI assertion promotes a guess to verified. Hunter remains off by default and optional.
