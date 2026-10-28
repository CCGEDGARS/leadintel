# Phone status display correction

The UI defaulted every CRM contact with no phone ledger row to pending_phone, including email-only records. Public-source channel completion was displayed independently as Not found, giving contradictory Apollo/pubic-search messages. One Confirm phone refresh also ignored terminal ledger states; Treg routing ran before pending Apollo refresh.

Phone state now requires a recorded pending request or explicit pending contact state. Missing phone requests remain not_requested. Pending/failed/completed paid states take precedence in the phone card while source-search results remain separately explained. Pending Confirm phone refreshes the existing CRM request before provider routing, without requesting paid enrichment. Failed and missing-request refresh messages do not claim completed no-number searches.

Regression fixtures reproduce email-only false pending, conflicting public/paid rendering, terminal refresh, and the Treg-routing case without any provider calls. No real lookup or outreach was initiated. These tests do not establish the authenticated outcome for Chris Van Den Berg.
