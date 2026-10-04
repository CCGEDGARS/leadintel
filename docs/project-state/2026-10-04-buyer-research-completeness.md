# Buyer research completeness — 4 October 2026

## Root causes and changes
- Older stored runs recorded identity discovery as not_needed. Both current manual and automatic flows perform configured Apollo identity-only search. Research version and timestamp now identify earlier runs. On entering Buyers, an authenticated stale selection is refreshed once per session with saved evidence retained. This is public/identity research, never paid email/phone reveal.
- Provider normalization manufactured accepted=0 when counts were absent. Unknown now remains null. New runs record accepted counts from source-labelled Firecrawl and grounded diagnostics; automatic runs preserve the same provider/decision reporting.
- Contact evidence searches followed optional grounded work and could be starved. They now run after profile/name checks and before optional grounded follow-ups, with intermediate state persisted.
- Per-buyer email research status, attempted and failed search counts and timestamp survive normalization/reload for shortlist and pool. Empty results distinguish Not searched yet, Searching, Search incomplete, and Not found in completed searches. Raw candidates and guesses never become verified contacts.
- Automatic buyer runs now perform bounded public full-name/company-email/Gmail evidence searches before holding contacts for manual paid confirmation or selecting an already verified CRM contact. Public findings remain unverified.
- Swedish title suffixes and explicit current-employer metadata now parse, with wrong-employer and former-role regression checks.
- An explicitly selected delivery mode takes precedence when rendering email confirmation: automatic checked/locked, manual actionable.
- Live research exposed a sports-club Gmail falsely attributed by broad proximity. Non-pattern Gmail now requires an explicit adjacent person/employer attribution, with a regression example. The withdrawn candidate remains in the trace as rejected evidence.

## Real public LKAB evidence
20 managed Firecrawl queries checked all ten pending names. Replaying captured responses with the corrected parser supports eight full-name identity suggestions: Erica Ringvall, Josefin Ekbäck, Ulrik Gren, Jeanette Berggren, Mari Kuokkanen, Linda Jonsson, Christina Lejon, Helena Oja. Markus is ambiguous; Rikard lacks sufficient evidence under the current parser. These are public source matches, not verified buying authority.

Six opportunity-role queries returned 48 source results and a diversified six-person recommendation: Malin Barsk, Mattias Selberg, Adam Emerson, Kalle Mågård, Jens Persäter, Tore Mettävainio. This is a separate live public research probe, not the authenticated customer's saved shortlist. Procurement/sourcing coverage is demonstrably available. Twenty-four email evidence searches completed without provider failures. A club Gmail candidate was rejected during review; no verified company email was produced.

See the two committed JSON traces for every identity decision, provider query, source URL and rejection. Source freshness and employer/buying authority still require confirmation before outreach.

## Verification boundary
Customer regression suite, backend suite, static build, syntax and whitespace checks are recorded for this release. Production integrity proof is generated separately for the exact merged SHA. The cloud browser showed a signed-out empty workspace, so no authenticated Edgars workspace rerun, Apollo request or CRM acceptance is claimed. The managed public provider probe does not prove customer API-key routing or stored-run migration in his signed-in session.
