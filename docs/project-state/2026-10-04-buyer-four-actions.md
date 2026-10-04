# Buyer four-action interface

## Approved design
Four equal actions: Confirm email, Confirm phone, Confirm LinkedIn, Save buyer. Save is highlighted. Desktop uses four columns and mobile two columns. LinkedIn information shows Public match, Needs confirmation or Confirmed by you; the profile/search link belongs in a review dialog. Opening a profile never confirms it. Card-level Next and Clarify data are removed; the shared Messages footer chooses the exact saved buyer and uses the existing CRM email gate.

Automatic mode shows email confirmation selected and disabled. That selection expresses required verification, never an already verified mailbox. Manual mode retains the actionable email button. Phone and LinkedIn are optional. Saving remains possible before verification. Existing unsave behavior retains CRM history.

## Implementation and persistence
LinkedIn review checks the exact normalized profile and active workspace, saves the contact URL and a workspace CRM review activity, then syncs confirmation URL/time and the wider buyer pool. Sync failure rolls back displayed confirmation. Normalization retains the fields in both company and selected-prospect rows and the wider pool; status only applies to the same current profile URL.

Automatic legacy confirmation cannot invoke paid Apollo email/phone enrichment; automatic server buyer research uses identity-only directory discovery and existing verified CRM contacts, holding buyers without a verified contact for review. A general automatic confirmation preference no longer grants a paid per-contact reveal. Manual explicit contact actions remain available after manual takeover. Existing pre-send Hunter verification and outreach approval gates remain intact; no outreach was sent or approved by this work.

## Validation
Full customer suite: 1536 passing. Full backend suite: 400 passing. Static build, syntax and whitespace checks pass. Regressions cover four actions, manual/automatic locking, exact-profile status, normalization, CRM evidence recording, sync rollback, stale workspace/profile rejection, existing save/reload and exact-person message handoff, plus no automatic paid reveal even when the general confirmation setting is enabled.

Production requires exact-SHA CI, live manifest, health and all mandatory smoke checks. Authenticated customer acceptance and visual inspection of a populated customer card remain distinct from these tests; the assistant browser has no signed-in customer state.
