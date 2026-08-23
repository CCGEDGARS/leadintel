# LeadIntel Customer V2 Delivery & Learning Loop Design

## Goal
Extend `/customer/` from approved outreach packages into a controlled delivery workflow, automatic local CRM-stage updates, deterministic reply classification, outcome tracking and a measurable learning loop.

## Current integration boundary
LeadIntel does not currently contain a production Gmail OAuth connector. This milestone must not claim otherwise. The first connector is a browser-safe Gmail Compose bridge: LeadIntel opens a prefilled Gmail draft, the user sends it in Gmail, and then explicitly confirms `Sent` in LeadIntel. A connector interface isolates this delivery mechanism so a future OAuth Gmail adapter can provide true send/reply sync without redesigning CRM or analytics.

## Customer flow
1. Approve an Opportunity Dossier outreach package in Step 6.
2. Continue to Step 7 Delivery & Learning.
3. Select an approved opportunity.
4. Enter or confirm the recipient email.
5. Open a prefilled Gmail compose window containing the approved subject/body.
6. After the user actually sends externally, click `Confirm sent`.
7. LeadIntel records the delivery event and advances the matching pipeline item to `Contacted` without regressing later stages.
8. When a reply arrives, paste/record the reply text.
9. LeadIntel classifies the reply and advances the pipeline to `Replied`, or directly to `Meeting` when explicit meeting intent is detected.
10. User can record later outcomes: Meeting, Proposal, Won or Lost.
11. LeadIntel aggregates conversion performance by tone, market, offer and signal and shows evidence-based learning recommendations.

## Delivery safety
- No email is automatically sent by this milestone.
- Gmail compose links are generated only from an approved outreach package and a syntactically valid recipient email.
- `Confirm sent` is a separate explicit user action after external delivery.
- The app never stores Gmail credentials, OAuth tokens or passwords.
- Draft edits remain locked once the Step 6 outreach package is approved.
- CRM stages never move backwards because of delivery/reply/outcome actions.

## Gmail compose connector
The adapter produces a URL in the form `https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...`.

Inputs:
- recipient email
- approved email subject
- approved email body

The connector returns no delivery confirmation. LeadIntel therefore requires explicit `Confirm sent`.

## Delivery state
Persist separately under `leadintel_customer_v2_delivery`.

Shape:
- `selectedDomain`
- `opportunities[]`
  - domain/company
  - recipientEmail
  - sentAt
  - deliveryChannel (`gmail-compose`)
  - replies[]
  - latestReplyCategory
  - outcomeStage
  - outcomeAt
- `activity[]`
- `connector` metadata (`gmail-compose`, `manual-confirmation`)

Caps:
- maximum 50 opportunity delivery records
- maximum 20 replies per opportunity
- maximum 200 activity events

## Reply classification
Deterministic categories:
- `meeting_request`
- `positive`
- `objection`
- `not_now`
- `referral`
- `unsubscribe`
- `out_of_office`
- `neutral`

Classification must be conservative. Ambiguous replies stay `neutral`.

### CRM effects
- send confirmation → `Contacted`
- any real reply → at least `Replied`
- `meeting_request` → `Meeting`
- user records Meeting → `Meeting`
- user records Proposal → `Proposal`
- user records Won → `Won`
- user records Lost → `Lost`

A later existing stage is never downgraded.

## Learning loop
LeadIntel calculates:
- sent count
- reply count and reply rate
- meeting count and meeting rate
- proposal count
- won/lost count and win rate
- performance by outreach tone
- performance by market
- performance by recommended offer
- performance by matched signal

Recommendations require a minimum sample threshold. No claim like “Tone X is best” may be shown from one or two sends. Default minimum: 3 sent opportunities in a segment.

Examples:
- `Consultative tone has 5 sends and a 60% reply rate vs 20% for Direct. Keep Consultative as the default until more data accumulates.`
- `Expansion signal has produced 3 meetings from 5 contacted opportunities. Increase its weight cautiously.`

## UI
Step 7 contains:
- connector status card: `Gmail Compose · Manual confirmation`
- approved opportunity selector
- recipient email field
- `Open Gmail draft`
- `Confirm sent`
- delivery/activity history
- reply capture textarea
- automatic reply classification preview/result
- stage/outcome controls
- learning scorecard
- segmented performance table/cards
- recommendations section
- export learning data button

## Future OAuth connector contract
A later Gmail adapter can implement:
- `sendApprovedMessage(package, recipient)`
- `syncThread(threadRef)`
- `listNewReplies(since)`

The CRM and learning engine must consume normalized send/reply events, not Gmail-specific objects. This is why delivery state and analytics are connector-neutral in this milestone.

## Non-goals
- no background inbox polling
- no Gmail OAuth/token storage
- no automatic sending
- no email-address enrichment
- no LinkedIn automation
- no external CRM write-back yet
- no modification of legacy `/v2/`
