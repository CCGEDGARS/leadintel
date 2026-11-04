# Creator Save activates the reviewed primary master

Owner request: rename Save draft to Save and make the saved script the mandatory primary script.

The old editor persisted only a private source revision and required a separate Activate version action. Save now persists the exact reviewed original/pattern, activates that returned revision in the existing channel/style core registry with the captured core revision, then refreshes the generation catalogue. It does not change other channel/style slots, personal preferences, existing customer drafts, or send outreach. The review checkbox discloses activation. PIN/owner authorization and revision-conflict protection remain intact.

If activation fails, retain the saved source, show that the primary master was not updated, and allow a reviewed retry. Scope changes prevent follow-up activation and stale success messages. Existing Activate version remains available for historical saved sources.

Validation: UI save/activation, review gate, activation failure/retry, changed active revision, PIN/dialog preservation; real authenticated route + SQLite source/core persistence and fresh customer catalogue for email, LinkedIn and phone; existing channel script rendering tests preserve literal wording and drafts. Production proof remains a separate release gate.
