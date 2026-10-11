# Empty personal settings for a shared link

The shared customer application contained a personal Calendly URL as the initial,
signed-out, missing-status and disconnected Settings fallback. The same URL was
also automatically appended to generic generated outreach drafts. The sender
identity placeholder displayed the original owner's name. These were public
asset defaults, independent of saved workspace data or account authentication.

Settings now uses an empty booking URL and a neutral sender-name placeholder.
Generic drafts append a booking invitation only when their seller profile
explicitly supplies a secure Calendly URL. The approved core originals and their
wording remain unchanged. Saved profiles, provider connections and booking URLs
are preserved; this change neither clears customer storage nor migrates it.

Regression coverage mounts the actual Settings modules for an anonymous visitor,
a fresh authenticated workspace, and an existing connected workspace. It checks
empty personal/credential inputs, close/reopen, status refresh, separate visitor
isolation, and downstream draft save/reload in English and Latvian. The backend
regression checks anonymous rejection, rejection of another account's workspace
ID, empty new-account booking status and preservation of the owner's connection.
Existing account-cache isolation tests cover profile and unsynced-data switching.

Production verification requires the exact merged SHA and successful CI, plus
the standard release gates and five additional privacy smoke checks: neutral
Settings defaults, neutral sender placeholder, no personal outreach fallback,
anonymous workspace-state rejection and anonymous booking-settings rejection.
No authenticated customer Gmail session is used or claimed as acceptance proof.
