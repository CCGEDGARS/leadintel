# Optional Hunter and provider-neutral automatic contacts — 4 October 2026

## Agreed behavior

Hunter is an optional paid enhancement, disabled by default for every workspace, including workspaces that already have a saved Hunter key. Connecting or checking a key does not activate paid email lookups. The owner enables additional verification in Settings. Public research and Apollo remain the default route. No provider guarantees 100% accuracy.

Identity and mailbox verification remain distinct: a sourced full name and a generated email pattern do not prove mailbox existence or ownership. Apollo-verified, attributable business emails can advance without Hunter. Sourced but unverified addresses and Gmail/name guesses remain review records and cannot enter automatic delivery.

## Implementation

The authenticated owner-only Hunter settings endpoint persists the preference in existing workspace integration metadata. Both paid Hunter endpoints enforce it server-side. Key replacement and connection checks preserve the preference. Disabled Hunter is excluded from workflow setup blockers and required-provider attention.

Buyer confirmation reuses verified contacts, then uses Apollo. Automatic Apollo reveal requires saved owner approval and reuses the CRM enrichment cache, request records and daily/monthly limits. Backend buyer execution now performs approved confirmation rather than always holding all reveal operations for a manual click. Personal email, phone reveal and waterfall are not enabled by this email path. Absent or unverified contacts are retained for review while other candidates continue.

Optional Hunter checks one sourced address after Apollo; its finder is a final fallback. The former batch of up to 13 guessed addresses is removed. Recent checks are cached. Delivery with Hunter off checks exact company/recipient, full identity, CRM verified status and Apollo/Hunter attribution. Hunter enabled adds its mailbox gate and reuses recent confirmed checks. Existing suppression, approval, pause and send-window controls remain in place.

Apollo search is credit-free for the people-search endpoint; email reveal/enrichment may use credits. Default existing enrichment-policy limits apply. This change does not authorize sending any message during development or validation.

## Regression coverage

Behavioral coverage includes Hunter connected but disabled, server-side no-call enforcement, owner opt-in persistence through account checks, non-owner rejection, cached Apollo contacts, one optional sourced-address check, approved automatic Apollo reveal and refusal without approval, credit-policy reuse, provider-neutral delivery verification, and refusal to promote guessed or personal addresses. Full frontend/backend suites, build and exact release proof precede production acceptance. Live checks must inspect the default-off setting and retained buyers without triggering paid lookup or sending outreach.
