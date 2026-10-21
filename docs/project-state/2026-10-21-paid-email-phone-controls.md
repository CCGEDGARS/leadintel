# Separate paid email and phone controls

Approved outcome: Setup shows **Activate paid email search** and **Activate paid phone search** beside Save settings. Each permission persists independently per workspace and shows a green ON state. Approximate planning amounts are €0.30 for the email research workflow, €0.20 extra per phone found, and €0.50 combined when both permissions are on. These are estimates, not fixed Treg tariffs, measured average costs, or a guaranteed result; provider, AI and scraping usage vary. Existing subscription charges are separate.

## Behavior
- The existing `enabled` field remains the email permission. Migration 0047 adds `phone_enabled`, default OFF, without changing email approval, limits, credentials, CRM or previous receipts.
- Activating a service records the workspace owner's scoped consent after an in-app confirmation. Saving preferences does not itself run a paid lookup, activate automatic sending or send a message.
- Manual Confirm data and automatic research use the same saved permissions. The backend rejects attempts to purchase a disabled channel, rechecks consent before each paid phase and retains existing contact qualification, role, workspace, identity, budget and suppression protections.
- Phone-only work skips paid email discovery, email verification and profile enrichment. Existing verified email/profile evidence is retained. Email-only work never requests a phone. Both options reuse durable phase receipts and idempotency keys.
- Automatic phone lookup can enrich the selected strongest buyer even when a usable email already exists. Email confirmation remains independent; a provider-listed phone never becomes a verified email or an assertion of phone ownership/reachability.
- Request ceilings are in the provider's billing currency (USD): email finder $0.05, verifier $0.025, optional profile $0.05, phone $0.25. The €0.20 phone planning estimate is not a hard price cap. Actual Treg receipts remain settled micro-USD rather than invented currency conversions.

## Verification
Focused customer tests exercise both toggles, all on/off combinations, reload, cancellation, workspace reset and absence of paid requests while preferences are saved. Backend tests exercise persisted independent consent, disabled-channel rejection, phone-only automatic lookup with an existing email, no email/profile purchases in phone-only mode, migration preservation, CRM snapshots and the complete automatic email/email+phone → CRM → verified message-preparation path. Provider responses in these tests are simulated; no test sends outreach or purchases personal data.

Local release checks passed: 3,453 customer tests, 813 backend tests, production static build and whitespace/syntax checks. Review also verified that preference saves cannot launch lookup through buyer rendering and that current research is persisted before enriching an existing canonical CRM email contact.

Release verification follows `.agents/skills/release-integrity/SKILL.md` for the exact merged main SHA, frontend CI, backend deployment, release manifest, health and configured smoke checks.
