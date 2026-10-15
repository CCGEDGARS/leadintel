# Strategy switches — 15 October 2026

Scope: ICP cards, buying signals, market-opportunity selection and automatic monitoring.

## Root causes

- Only unavailable ICPs had explanations; off cards used whole-card opacity. Switch handlers persisted state without refreshing the card.
- Discovery assembled qualification context from the original profile and could overwrite selected signal context. Non-core active buyer roles did not replace original roles when Core was off.
- All-disabled ICPs could fall back to the original profile during new-company query planning.
- Monitoring required a separate save and rendered controls before reading pending edits. A failed save retained an unconfirmed local enabled value; a dirty strategy could prevent disabling an existing schedule.
- Explicitly deselecting all monitoring source categories restored defaults during client/server normalization.

## Behavior

- ICPs show Active, Off or Setup required. Inactive editing fields are disabled; the switch stays readable and usable unless prerequisites are missing. Saved content is retained.
- Signal and opportunity cards state whether they are used. Changes refresh the relevant cards and invalidate strategy approval.
- `effectiveTargetingProfile` projects active ICP descriptions, markets, roles, offers, values and exclusions into company discovery and fit checks. Seller exclusions remain enforced. Off lookalike context is removed from the projected profile.
- New-company query planning returns no queries if every configured ICP is off. Explicitly supplied known companies remain researchable; pausing lookalike is not a prohibition on manual company research.
- Buyer roles use an enabled non-core ICP when Core is off. Existing company-specific roles remain preserved.
- Discovery fingerprints include all editable targeting fields, so older results can be marked stale without deleting them.
- Market research uses enabled targeting fields; when no ICP is enabled, profile research remains available to acquire the evidence needed to unlock an opportunity profile.
- Monitoring switches save immediately to the existing authenticated workspace-scoped API; saving disables repeat submissions. Failed saves restore the last confirmed local display and explicitly leave server confirmation unresolved. Disabling is available even after strategy edits.
- Empty source-category selections remain empty, including custom-source-only monitoring. Enabling with neither source categories nor custom URLs is rejected.
- Scheduled execution already filters server configurations by `enabled=1`; this guard is preserved. A deliberate one-time monitoring run remains a separate action.

## Verification

Regression tests exercise real normalization, query planning, qualification projection, buyer-role handoff, DOM disabled fields/re-enable persistence, failed monitoring saves, dirty-strategy disable and empty source selections. Existing visibility tests now count disabled switches separately from intentionally disabled edit fields.

Run customer and backend suites and build before release. Release integrity must prove exact main SHA, Customer CI, backend deployment, manifests, health and smoke checks. Browser opens signed out; authenticated workspace scheduling and external research are not asserted by local tests or deployment proof. No outreach is sent.
