# Workspace verification and startup recovery

The customer screenshot shows `Could not verify your workspace`, produced by
the account verification gate. It is not a disk-space or 500 KB sync warning.
The screenshot does not identify the failed request; the exact failure in the
customer's separate browser remains unknown.

Reproduced causes in the previous implementation:

- `init()` caught mandatory account verification and auxiliary startup work in
  one block. A failed Gmail/Microsoft status request or CRM migration could call
  `AccountCache.failed()` after account membership and workspace hydration had
  already succeeded, hiding the entire verified application.
- A temporary session, membership or workspace-state failure had no retry.
  Non-success membership responses were incorrectly represented as an empty
  workspace list.
- Malformed successful session responses parsed as an empty object and were
  incorrectly treated as confirmed sign-out.

Mandatory startup GETs now have three bounded attempts for transient network,
timeout and selected server errors, with short backoff and account-epoch checks.
Response shape validation distinguishes an unavailable verification service
from a confirmed expired session. No write or account-changing action retries.
Failure revokes workspace API access, preserves cache, and keeps private content
hidden. A visible retry button reloads verification without clearing data.

After membership and hydration succeed, the application becomes available.
Auxiliary CRM migration, asset cleanup and mail status checks settle separately;
their failure cannot revoke verified access. Existing account switching,
old-tab rejection, cache archive failure and sign-out preservation still apply.

Regression tests cover each mandatory startup endpoint, both optional mail
checks, CRM migration failure, malformed session JSON, finite retry exhaustion,
revoked write access and recovery UI visibility. Release gates require recovery
markup, retries/auxiliary isolation and access revocation assets for the exact
merged revision. Actual customer acceptance requires reload in their browser;
a passing authenticated cloud browser does not identify their original cause.
