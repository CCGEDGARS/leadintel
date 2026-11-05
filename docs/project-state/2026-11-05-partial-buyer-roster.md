# Partial roster recovery

Customer reports Robert absent from both priority and other-contact cards. Screenshot also shows a malformed phone accepted as confirmed. Current authenticated job data is unavailable; the exact event that dropped Robert is not established.

Reproduced recovery gap: company restore only populated an entirely empty local roster and queried only the latest full roster. A partial list remained missing a previously retained person even when same-context history held the record.

Restore now merges retained full-roster history within the same workspace, domain, seller context and roles, then fills missing identities up to the existing ten-person cap. Existing local identities and person-scoped requests are not replaced by this recovery. Research and confirmation gates remain authoritative; recovery does not fabricate contact evidence.

Phone validation rejects impossible three-zero prefixes, repeated-digit placeholders and numbers beyond the international fifteen-digit maximum. Tests cover source-attributed invalid numbers, aliases, historical partial snapshots, read-only restoration and targeted isolation.

Customer acceptance still requires observing the current signed-in roster. An approved older customer snapshot can prove replay recovery, not current production contents.

## Correction from later customer evidence

The expanded Other contacts screenshot shows Robert retained among seven other buyers. His expanded card identifies `Dossier role conflict requires review`, with his email and phone preserved. The partial-roster recovery gap is real but does not explain this observed hold. Resolving Robert requires the specific conflicting dossier sources; it must not be represented as repaired by roster restoration.
