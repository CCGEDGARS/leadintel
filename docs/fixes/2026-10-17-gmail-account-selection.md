# Gmail account selection

Google Auth Platform was observed as External / In production (2 of 100 unverified users). Both configured callback URIs match the existing backend routes. Publishing status is not the identified account-choice defect.

The Gmail start route used consent with the signed-in user's email as login_hint. It now requests select_account consent without a login hint. Settings offers Change Gmail account to owners while connected, using the existing connection flow without disconnecting first. The callback retains the existing connection until new consent and token encryption succeed. One mailbox per workspace remains the supported model; changing a mailbox replaces it, rather than adding a simultaneous second mailbox. Workspace ownership and authentication are unaffected.

Existing gmail.readonly remains because reply synchronization uses Gmail thread reads. Verification/scope reduction is a separate functional change. No verification submission or permission expansion was performed.

Backend regression checks pass (24 tests). Customer mailbox/settings regression checks pass (32 tests). Production publication remains blocked by automatic approval review pending explicit user approval to publish to public main. Final second-account authentication and Google consent require the account holder. Production is not verified for this revision.
