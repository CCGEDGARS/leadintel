# Master CRM history hardening — 24 September 2026

## Changes

- The company activity endpoint now returns a workspace-scoped, keyset-paginated timeline. It sorts by occurrence time, creation time, and activity ID, returns a continuation cursor, and caps each response at 100 records.
- CRM company details return the first 40 events and a continuation cursor in the same request. The detail panel exposes **Load older activity** with retry feedback; older pages append without duplicates, and stale responses cannot overwrite another selected company.
- Company upserts now reject attempts to add archived companies to the active pipeline. Archived and suppressed records also remain out of the pipeline if an inconsistent legacy stage is encountered.
- Company and contact inserts now use conflict-safe writes and then resolve the canonical workspace identity, preventing concurrent saves from surfacing uniqueness errors. Archived contact identities return an explicit conflict.
- CRM record changes and their timeline events are committed in the same D1 batch. If the event write fails, the paired company, contact, intelligence, or lifecycle mutation rolls back.

## Verification

- Backend regression coverage exercises a timeline spanning three pages, route pagination, duplicate-free continuation, archived-company pipeline protection, concurrent company/contact saves, and rollback after failed activity writes.
- Customer regression coverage exercises the bridge URL contract and appending older activity pages in the detail view.
- Verification completed: 343 backend tests and 1,053 customer tests passed; the isolated static build and JavaScript syntax/diff checks passed.
- Full verification commands:
  - `cd backend && npm test`
  - `node --test customer/test/*.test.js`
  - `npm run build` (in an isolated temporary copy)
  - `git diff --check`

No production deployment or release proof was performed for these working-tree changes.
