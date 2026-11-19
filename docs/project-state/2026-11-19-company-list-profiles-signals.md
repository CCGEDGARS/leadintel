# Company lists: four targeting profiles and buying signals

## Requested outcome and ownership

The owner requested that the four saved Strategy profiles and active buying signals determine company-list research, individually or in combination. Preserve the 1–200 count, evidence standard, existing lists, CRM records, Buyers handoff, and saved Flows. No live 200-company acquisition, paid contact purchase or outreach is part of this change.

Strategy (`main.market.icps`, `signals`, `deletedSignalIds`, and current sourced `opportunities`) owns the targeting inputs. Profile owns the seller, offers, exclusions, markets and analyzed references. A company list owns its immutable reviewed criteria, receipts and results. A reviewed chat task owns its frozen selected Flow context. Existing classic Companies research remains a separate unchanged journey.

## Root causes

1. The new company-list builder read active buying signals and a Lookalike alias. It did not connect Core, Trigger-led or Opportunity-led profile definitions to its plan and evidence checks.
2. Flow task freezing retained signals but discarded profile definitions, deleted signal IDs, opportunities and stale-research state. A correctly saved Flow therefore lost these inputs at the research boundary.
3. Direct list previews had no server-side fingerprint of their resolved inputs. A Strategy edit between preview and start could change research criteria silently.
4. Company-list saves supplied a `companyList` research snapshot, but the company-owned CRM patch discarded that key. The company record was saved without its list evidence summary.
5. Chat recognized “best company” and plural requests, but not the ordinary “find 1 company” request used with profiles.

## Resulting behavior

- All four profile cards appear in Build company list. Only active, ready profiles are selectable. Explicit empty/all-off configuration never restores a default. The canonical reference Lookalike card supersedes the hidden old card, including when switched off.
- Select one or multiple profiles, matching any or all. Core checks saved customer operations; Lookalike needs substantive reference similarity; Trigger-led needs customer fit plus selected current events; Opportunity-led needs a sourced saved opportunity and current company-specific application evidence.
- The generated Trigger-led description's reference to “core profile” resolves against the baseline Profile customer definition, without importing an inactive Strategy card. Custom Trigger-led definitions remain intact.
- Buying signals have separate Profiles only, Prioritize and Require controls. Profiles only removes event criteria and score. Prioritize retains profile matches and adds at most 10 points for reviewed events. Require applies any/all event matching to every result. Trigger-led always needs its selected events even in Prioritize mode.
- Up to all 20 supported active signals can be selected. Deleted/off signals are excluded. New/edited active signals appear in newly opened criteria. Inactive profile definitions do not contribute to the research brief.
- Profile fit is capped at 90; the weighted, source/recency-adjusted event score contributes at most 10 additional points. Missing optional signals score zero. Signals cannot rescue unsupported profile fit. Buying intent remains unconfirmed.
- Selected list countries override reference/profile geography for that run. Lookalike retains exact selected reference identity and quotations. Opportunity-led cannot bypass commercial relevance, exclusions, identity or operating-market evidence.
- Each counted result requires actual read-source quotations and a separate evidence review. Required gaps stop inclusion; shortfalls remain incomplete. Existing bounded scheduling, retries, allowances, receipts and cancellation are preserved.
- Changing a form selection clears its preview. The direct API compares a fingerprint of current resolved options before starting. Old clients must reload when an explicit profile configuration exists.
- Existing lists/running tasks keep frozen inputs and their original policy version. New policy is `20261119-profiles-signals-v3`; legacy `20261119-reviewed-evidence-v2` and earlier jobs are not relabelled.
- CSV/Excel, chat outputs, saved results and new CRM records retain profile/signal attribution and separate score components. Existing CRM records, contacts and user changes are not overwritten. The company-only patch permits declared list-evidence fields without permitting buyer-owned fields.

## Acceptance evidence

- Model tests cover all four profiles, any/all combinations, Off/Prioritize/Require inclusion and scoring, unsupported evidence rejection, exact opportunity/reference citations, 20 signals, canonical/off/deleted settings, frozen criteria and exports.
- Authenticated HTTP + real SQLite + registered `app.scheduled` tests cover each profile, changed result sets, stale previews, edits under unchanged IDs, all-off validation, frozen running lists, CRM evidence and saved exports.
- Reviewed Flow tests retain all four definitions, opportunities and deletion state, restrict a selected subset through the frozen buyer context, reject inactive/deleted named signals and preserve an already-running task after its saved Flow changes.
- Controlled Chromium journey builds 200 reviewed rows with the browser closed, then reopens, displays top 10/show all, downloads all 200 CSV/Excel rows, saves all 200 CRM companies and opens Buyers. It exercises four-card selection, both combination controls, optional signal visibility, preview invalidation, Strategy switches/deletions, and unchanged saved-list criteria.
- Separate chat browser journey covers review-before-run, red credit blocker, resume, browser-independent completion, CRM save, CSV/Word/PDF and fresh browser restoration.
- Desktop (1440 px) and narrow/mobile (390 px) layouts have no document horizontal overflow; screenshots and page errors are captured. Controlled provider fixtures never make live research or paid contact calls.
- Focused customer regression checks and static build are run locally; exact-head required Customer CI and Backend CI remain mandatory for release. Production freshness is proved separately by the repository exact-SHA release pipeline, including the added profile-policy health/smoke gates.

## Limits, compatibility and rollback

The controlled 200-row journey proves processing, verification boundaries and persistence capacity, not the availability of 200 real matching companies for an arbitrary market. Actual yield still depends on source evidence, provider availability and the reviewed allowance. No authenticated production workspace was available for a real customer run.

No schema/data migration or background rewrite is required. Old lists and source evidence remain readable. A rollback must preserve v3 interpretation for existing v3 jobs (or pause those jobs); do not let an older worker process their different schema. Resume uses the existing frozen criteria. Profile/signal edits require a new reviewed list rather than mutating an existing one.


## Follow-up on the recorded Denmark list

The recording shows Past Customer Context selected, five reference companies, the optional tender signal unchecked, a target of ten companies and an allowance of ten operations. The builder rejected the empty optional signal selection at review. It now previews profile-only ranking in that case. A required signal or a Trigger-led profile still needs a selected event. Validation stays beside the Review button. The form warns when even the minimum number of operations needed exceeds the chosen allowance.

The assessor and reviewer use the same evidence-based strength scale. Each new match retains its assessed strength and adjusted score. Profiles contribute up to 90 points. Confirmed, dated signals can add up to 10. When any selected profile can qualify, an unsupported Trigger-led match is removed while independently verified Core or Lookalike evidence can still qualify. Older results retain their recorded values. In the Companies search, a retained assessment from a previous Strategy could displace a current result or count toward the strong-fit target after reopening. Ranking, continuation and saved snapshots now respect the current assessment and keep earlier scores marked for review.

The worker carries evidence from the first page to a linked page even when search already queued it. A failed provider authentication on the final operation reports the connection failure and the exhausted allowance together. The browser discards stale polling responses following a list action or workspace change. Controlled regressions exercise profile and signal choices, partial results, continuation from the saved queue, and the recording's selections through authenticated HTTP, SQLite and the registered scheduler.
