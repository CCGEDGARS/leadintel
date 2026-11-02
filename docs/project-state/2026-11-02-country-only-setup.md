# Country-only target selection — 2 November 2026

User requested country-only geography. Step 1 removes region presets and free-form region/industry/market entry. Popular country shortcuts remain, plus a country dropdown covering ISO 3166-1 entries with English display names. Industry and customer-segment definition remains in Profile.

The selector validates country selections. Saved region names are expanded through the existing region map when restoring Step 1 state; duplicates are removed within the existing selection bounds. Internal legacy region expansion remains supported for saved research compatibility. Navigation/readiness targets point to the country dropdown. The old custom-input autofill helper cannot replace this new select.

Verification: country-only markup, populated selector interaction, country validation and saved-region restoration; full customer/backend checks, static build and same-SHA production proof before declaring deployment.
