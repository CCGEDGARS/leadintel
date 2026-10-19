# Qualified additional email services — 19 October 2026

## Approved behavior

After company qualification and completed public research for four real eligible buyers, show:

**Strong match. No confirmed public work email found.**

Email action: **Find email with additional services**.

Both selected Buyers and Companies contact controls use the same gate. Missing evidence, unresolved identities, changed roles, conflicts and partial/stale public checks cannot unlock paid enrichment. Company fit and email readiness remain separate; neither the button nor a payment guarantees an email will be found.

Step 1 has an optional collapsed Additional email research panel. Owner authorization defaults off and can be revoked. It permits Apollo email enrichment for the strongest one or two buyers, within explicit per-company, daily and monthly lookup limits. Saving enabled preferences also enables the connected Apollo email capability. Connecting a provider is still required; merely adding this feature does not activate customer spending, phone/personal lookups or outreach sends. Hunter delivery verification remains a separate enabled service and requires its explicit per-check credit approval.

## Implementation and prevention

- Server-backed workspace policy and atomic lookup reservations in migration 0041. Reservation checks current limits and approval at execution, protecting concurrent tabs and policy changes.
- Separate manual per-contact approval and upfront automatic authorization. Existing saved/official contact confirmation runs before contact reveal; explicit stricter provider requirements remain enforceable.
- Additional lookup uses customer-owned Apollo credentials and existing workspace enrichment credit gates. No shared-key fallback, phone request or personal-email exception.
- Original public buyer identity remains linked to the verified CRM contact after Apollo resolves its own identifier. Current CRM contact state is revalidated when reusing a cached result; archival cannot resurrect a contact.
- Successful/no-result/uncertain-charge attempts are not repeated automatically. Known pre-reveal/credit-policy failures can be explicitly retried without retaining a spent reservation.
- Company/buyer/workspace guards surround asynchronous confirmation and CRM writes. Paid Hunter evidence is kept when synchronization needs retry rather than discarded and bought again.
- An unavailable provider does not consume automatic-attempt fingerprints; connecting it resumes approved eligible research.
- Pending, inconclusive and unavailable results remain explicit holds. This feature does not prove a complete requested-count company shortlist or successful real paid lookup.

## Verification

Focused regression suites exercise manual cancellation, optional upfront authorization, four-person readiness, strongest-two selection, stale/failed research, workspace switches, company removal, current policy reductions, concurrency, cached no-result lookups, archival, public/provider confirmation levels, CRM identity continuity, Hunter checks, provider connection recovery and retained paid evidence on sync failure. Full customer/backend suites, static build, exact-SHA CI and production proof are release gates; authenticated UI verification and any real credit-consuming lookup are reported separately.
