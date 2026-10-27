# Conversation workflow implementation ledger

Plan: `docs/superpowers/plans/2026-10-27-conversation-workflow-presets.md`.

- User approved saved presets, one default, automatic approved scripts/timing and manual takeover in this conversation. Design records that authorization; no real sends are authorized for development verification.
- Existing isolated cloud checkout retained, branch `feat/conversation-workflow-presets`.
- Backend implementation delegated as one scoped task, UI implemented in the parent; no overlapping owned files.
- UI RED: missing dashboard exports failed the new rendered tests before implementation. GREEN: new manager and old conversation/topbar/wire tests passed (38 at that point). Optional blank-script case then failed RED and passed after empty branches were omitted from API payloads.
- Ruling: use literal owner-approved reply scripts in this version, with no free-form AI sending — keeps one-time approval meaningful. Ambiguous replies require human handling; broader AI reply policies would require a separate design.
- Ruling: apply the default only to confirmed sends after its approval time; existing conversations require explicit assignment — prevents retroactive authorization.
- Ruling: existing Delivery policy owns timezone, working days, sending window and daily/spacing limits — avoids conflicting independent send policies. The preset editor explains this.
- Ruling: only verified Calendly evidence can establish booking; Google Calendar free/busy and meeting-request emails cannot prove a booked meeting.

## Implementation and review

- Task 1 complete: approved preset/revision storage, future enrollment, exact bounded reply scripts, lifecycle, shared guarded sending, takeover/resume, verified Calendly events and scoped API.
- Task 2 complete: top-bar Conversations drawer, common attention/filter predicates, accessible preset editor and read-only script inspection, explicit assignment/reapproval, takeover and reviewed resume. Scope checks cover confirmation, pending save and post-save reload. Intentional manual control is not a red failure.
- Independent interface review approved the corrections for lost in-flight edits, attention filtering, Escape propagation and the post-save workspace switch race. Additional rendered regressions cover late top-bar construction and quota recovery messaging.
- Independent backend review reproduced seven failures. Regression tests first failed, then passed for transactional resume/replacement CAS, next allowed reply windows, quota isolation, bounded single-thread lookups, provider-source Calendly lifecycle and completion excluding cancelled history. A further six-roots/healthy-tenant quota reproduction caught rotating failure markers; a preset-wide circuit now exposes all blocked roots and permits the healthy tenant on the next cycle. Scoped reviewer approved all seven fixes.
- Backend focused compatibility suite: 91 passed; final full backend suite: 1,128 passed, zero failed/skipped/cancelled.
- Rendered dashboard → real authenticated SQLite API wire test passed approval, exact script persistence, assignment, takeover, resume and deletion/history preservation with no provider sends.
- Actual local Worker + D1 HTTP checks passed authentication/isolation, approve/save/reload, reapprove, deactivate/delete and empty conversations in an isolated local fixture. Development frontend/new asset/health checks passed. No actual Gmail connection or real recipient sends used.
- Final migration applied successfully in a fresh isolated state; repeat application through the migration ledger reported no pending migrations. The earlier development state had zero Gmail messages/connections, CRM companies, workspace snapshots or presets. It was preserved at `/workspace/leadintel-development-backups/20261027-pre-workflow-final-state` before installing the fresh validated state in the normal ignored Wrangler location. No user data was discarded.
- Chromium checks rendered the drawer/editor at 390px and 1280px without horizontal page overflow. These use local fixtures, not authenticated customer acceptance.
- Final full customer suite: 3,981 passed, zero failed/skipped/cancelled. Static build and `git diff --check` passed. Production publication and authenticated customer acceptance are separate and unverified.
