# Market research and continuous monitoring

LeadIntel provides three evidence workflows in Market Strategy.

## Quick Research

- Manual, on-demand snapshot.
- Maximum 4 queries.
- Maximum 5 results per query.
- Maximum 20 unique stored sources.
- Best for initial validation before strategy activation.

## Deep Research

- Manual, on-demand strategic assessment.
- Maximum 12 queries.
- Maximum 8 results per query.
- Maximum 80 unique stored sources.
- Searches selected categories: news, tenders, jobs, investments, official company sources and registries.
- Preserves each completed run in the workspace research history.

## Continuous Monitoring

- Requires an activated Market Strategy, a signed-in workspace and an explicitly saved workspace.
- Runs through the Cloudflare Worker scheduler every hour and executes only configurations that are due.
- Supports daily, weekly and monthly cadence.
- Uses selected active signals, source categories, custom public sources and a minimum alert score.
- Stores configuration, runs, deduplicated evidence and alerts in D1.
- Repeated evidence updates its last-seen timestamp but does not create a duplicate alert.
- New evidence is scored for signal match, recency and source validity. Evidence at or above the threshold creates an in-app alert.
- Users can run the saved monitoring configuration immediately and can mark alerts as read.

## Safety and cost controls

- Quick and deep query/result limits are enforced in code.
- Automatic runs process at most 10 due workspaces per hourly scheduler invocation.
- Each workspace run is bounded to 4 quick or 12 deep queries.
- Only public HTTP(S) custom sources are accepted.
- Provider credentials remain encrypted in backend integration storage.
- Evidence is deduplicated by workspace and canonical source URL fingerprint.
- Research failures create partial or failed run records instead of manufacturing evidence.

## User workflow

1. Build and review the company profile.
2. Configure ICPs and buying signals.
3. Run Quick or Deep Research.
4. Review evidence and activate Market Strategy.
5. Configure monitoring frequency, threshold, signals and sources.
6. Save monitoring settings. LeadIntel saves the workspace before enabling the schedule.
7. Review new opportunity alerts and monitoring history in Market Strategy.
