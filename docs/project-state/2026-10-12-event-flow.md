# Optional event flow and feature visibility — 12 October 2026

## User-approved behavior

No Events & Conferences main navigation button. Setup contains an optional Prepare for an event disclosure. Save & activate event opens and highlights connected event disclosures. Inactive event controls remain collapsed and accessible. Late activation from Companies or Messages opens Setup without restarting the flow. Rendering never generates a message.

Reference-company and website-monitoring cards use stronger benefit-led copy and a shared visual accent. Existing reference activation and monitoring schedules remain their respective authorities.

## Implementation

- `event-campaign-ui.js` mounts the existing campaign form in Step 1 and a compact entry in Companies. Event name, edition, audience, objective, buyer roles, stand/meeting point, value and availability remain workspace-scoped.
- Company discovery includes exact-edition exhibitor and speaker/attendee searches even in its reduced-query mode. Existing commercial qualification and evidence gates remain mandatory. Search results do not automatically prove attendance.
- The Messages event panel opens for an active event. Three invitation purposes: stand/meeting-point invitation, meeting request, and attendance question. Professional, Friendly and Direct tones remain available.
- Attendance defaults to unknown. Reviewed company evidence does not confirm a person's attendance. Confirmed-person status requires the selected person ID, event ID and exact start date, source URL, supporting excerpt, checked date and explicit source-review acknowledgment. This is user-reviewed evidence, not independent automatic verification.
- The event AI writer reuses the authenticated writing-assistant endpoint and its existing source retrieval, identity, URL, numeric and provenance validation. It receives event, recipient and seller context and in-person meeting instructions. No new provider or subscription. Live provider output still needs factual review.
- Event previews are independently editable and explicitly saved into existing CRM script-package metadata. Reopen is scoped to the current recipient/channel and checks the saved campaign snapshot. Apply is explicit. Business draft content and protected original/history are backed up and can be restored exactly. Sending still requires existing review/approval and a separate delivery action.
- AI timeout, cancellation, buyer/draft/campaign/workspace changes and source-revision changes reject stale proposals. Error paths preserve the ordinary working message.

## Practical limits

Public attendee coverage depends on available sources; no private attendee database or automatic LinkedIn sending was added. A directory is a research source, not purchasing intent. Event follow-up requires actual conversation records; this update does not invent meeting history or add an autonomous follow-up engine. The optional Delivery banner explains the existing approval/send boundary.

## Verification

Focused tests cover edition/identity evidence gates, invitation purpose, active/optional disclosure behavior, late setup, explicit generation, stale AI replies, independently edited save/reopen, serialized business restoration and the mounted Messages apply/restore path. Run the complete customer suite and static build on final source. Production status must be proven for the exact merged SHA through the repository release-integrity system. Local fixtures do not establish authenticated production acceptance or real event-search quality.

## Pre-merge review corrections

Independent review found that reviewed attendance inputs could be rebound to another buyer or edition, and pending event AI requests did not include all factual/source-filter state in their stamp. Attendance review now resets on workspace, buyer identity/domain, channel, campaign revision or edition changes; editing a source/status/checked date requires fresh review. Event request stamps include the full studio factual context, selected writing-source filter and reference snapshot, alongside draft/identity context. Mounted regressions reproduce both failures and verify correction.
