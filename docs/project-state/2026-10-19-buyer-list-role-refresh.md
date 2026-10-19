# Buyer list visibility and role refresh

The selected-company Buyers screen could report ten suggested people while rendering no names. `buyerRolesChanged` removed the entire display list. That same flag was still set when a refreshed shortlist was qualified, so the first successful refresh rejected all candidates before clearing it. If every provider failed, the old list could also be replaced with an empty shortlist and its role hold cleared.

Saved full-name candidates now remain visible with a role-review warning. Existing qualification and Messages gates still hold them until a valid role refresh. The refresh qualifies against its completed role check, keeps saved people and the hold when sources are unavailable, and rejects stale results when roles are edited during verification or search. Committee-completion recommendations are withheld while role review is pending; search progress remains visible beside retained people.

Startup and target reselection compare canonical effective roles, including the built-in executive and procurement anchors, rather than string-versus-array or raw expanded text. An unchanged selection therefore does not hide or invalidate its researched people on reload. The role input shows the edited selection while the earlier research awaits refresh.

Regression coverage reproduces saved-list rendering, loading, first-refresh ranking, total provider failure, edits during company verification, edits during public searches, reload stability, and the existing blocked Messages handoff. The fix retains source-attribution, identity, employer, role and contact-confirmation gates. No customer-specific defaults or paid contact reveals are introduced.

Production uses the exact-SHA release proof. Authenticated page acceptance is separate: the supplied screenshots establish the missing-list state; browser page inspection was returning HTTP 401 during this repair.

Local verification: all 2,982 customer tests and 686 backend tests passed. JavaScript syntax and the static build passed. Independent review found no remaining blocking issues. The release includes an additional mandatory smoke check for the visible-list and guarded-refresh code.
