# Continue to Delivery — 25 October 2026

## Report and root cause

The authenticated Messages page showed a saved manual email with a colleague's Calendly and LinkedIn links. Its configured default booking link belonged to the account owner. Continue to Delivery reached approval, but approval reused the AI generation parser's exact configured-booking and evidence-link allowlist checks. The specific rejection was then replaced with a generic handoff error, making an enabled navigation control appear broken.

## Resolution

Only an exact saved working draft with manual/rewrite origin receives reviewed-link validation during native email approval. It can retain deliberately entered HTTP(S) links and a valid HTTPS Calendly event URL in that draft. It does not change default sender settings, rewrite the message, or broaden AI-generated link permissions. Credential-bearing and executable links, unresolved placeholders, required meeting invitation, Profile/recipient checks, translation checks, current approval, durable CRM save and workspace/buyer race guards remain enforced. The specific parser rejection is returned through the handoff.

## Verification

Regression tests first reproduced failed navigation and the overwritten error. The real rendered button then passed with a saved colleague booking/profile link, preserving exact approved text, configured defaults, selected buyer, CRM restore and zero send/enqueue requests. Separate tests retain strict generated-link validation and reject credentials, executable schemes, placeholders and incomplete invitations. Local full customer suite: 3,798 passed, zero failed. Focused handoff/parser/save/production-watch suite: 44 passed; bootstrap/budget checks: 11 passed. JavaScript syntax and static production build passed. CI and exact-SHA production proof are required before declaring production complete. Authenticated acceptance is checked separately after deployment; no outreach is authorized.
