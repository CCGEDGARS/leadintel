# CRM action safety and recovery

Edgars delegated selection and completion of the next important defect. The attached Master CRM design makes durable, workspace-scoped commercial memory the governing requirement.

## Verified problem

`crm-ui.js` binds company actions to a company ID before awaiting confirmation, but does not recheck the account, workspace, selected record or permission before issuing the mutation. Its general company action handler also lacks duplicate-submit and transport-error recovery. General CRM reads compare only workspace IDs; replacing the account/bridge within the same workspace can publish an old response. `crmRequest` likewise returns late responses without a scope check.

## Decision

Keep the existing CRM layout and APIs. Bind each operation to the authenticated bridge, workspace object/ID, user and role, plus a local revision for explicit workspace changes. Bind company actions to the selected-record revision as well. Recheck after confirmation and every asynchronous boundary. Invalidate pending approvals when navigating or closing CRM. Reject stale responses at the shared bridge as an additional boundary. Never retry a mutation automatically.

Alternative considered: disabling workspace controls while CRM is open would not protect account changes, late responses or other consumers. Adding confirmation to every reversible action would add friction without solving context drift. Use precise context checks and a visible pending/error state instead.

## Behavior

- One company mutation at a time; controls show a pending state and recover after cancellation or failure.
- Confirmation names the exact company; changing context cancels it.
- Only a result belonging to the original context can announce success, refresh a record or dispatch CRM changes.
- Transport failure stays visible beside the record, preserves its saved information and permits an explicit retry.
- Viewer roles see read-only records; permanent deletion and restoring suppressed companies remain owner-only.
- Ordinary pipeline removal continues preserving companies/history. No real destructive action, paid lookup or email is needed for acceptance.

## Acceptance

Regression tests must first reproduce stale confirmation submission, same-workspace account/bridge changes, late completion overwriting another record, repeated submission, rejection recovery and successful refresh. Run the customer suite and build, review changed call paths, then require exact-SHA production proof. Browser evidence is reported only if actually obtained.
