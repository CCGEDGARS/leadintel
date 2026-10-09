# Personal LinkedIn in settings

Adds a personal-profile URL field to the right-side Integration Control Centre, with Save profile, Open my LinkedIn, Remove profile and a Profile linked indicator.

Uses the existing `brandIdentity.linkedinUrl` sender identity source and workspace save/sync path; no duplicate profile store. Existing sender/profile rendering receives the change immediately. Other identity fields remain intact. Remove clears the source used by future message generation; already saved/approved messages remain historical snapshots.

HTTPS personal `/in/` URLs only. Canonicalizes LinkedIn country hosts and removes query tracking/fragment. Rejects company pages, spoofed domains, credentials, nonstandard ports and non-HTTPS schemes. A linked profile is not OAuth authentication and is labelled accordingly; LinkedIn opens in a separate tab with noopener/noreferrer.

Verification: URL validation and rejection cases; sender identity update/removal; actual settings DOM save/open/remove/reopen; simulated workspace switch; related identity/settings tests; customer suite and static build. Production verification requires exact-SHA CI plus manifest, health and all configured smoke checks.
