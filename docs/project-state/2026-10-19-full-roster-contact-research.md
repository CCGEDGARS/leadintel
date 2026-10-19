# Full-roster buyer contact research

## Agreed outcome

The Buyers step attempts public contact research for every retained candidate, up to ten, then recommends up to four eligible researched people. Other retained people and all sourced contact details remain visible. Ten is a research target, never permission to fabricate names, roles or contact data. Missing names, channels, provider access and current-role evidence remain explicit gaps.

## Causes and changes

The contact pass explicitly selected only four people, leaving the other six unsearched. Default selection now covers the complete retained roster. Research completeness and automatic revisit checks use that same scope. Explicit individual and selected-person checks remain available; successful checks are cached by person, company, role and evidence version, while a retry resumes failed checks. Old four-person snapshots receive the full-roster pass once. Pending role edits do not start a competing contact pass before the role refresh.

An optional grounded lookup or evidence review could throw a request timeout into the entire contact pass after personal source checks had finished. These optional requests now have their own bounded deadlines and retain an explicit unavailable status instead of undoing completed checks. Parent cancellation still stops the run. The shared transport keeps its deadline and cancellation active through the response body, closing the successful-headers/stalled-body hang. All person tasks settle before canceled checkpoints are saved. Progress rendering is throttled so ten concurrent people do not continuously rebuild the Buyers page.

The server and persistence paths also retained a four-person/four-conflict limit. They now accept ten people, thirty-two evidence excerpts and ten conflict findings. Source selection reserves evidence for each person before generic context. Shared staff-directory URLs receive separate excerpts for each person, so an early biography cannot consume the whole excerpt and silently omit people five through ten. Fully read pages keep precedence over snippets. The optional reviewer still has no web access and cannot establish deliverability or phone ownership.

Recommendation selection now uses researched eligible alternatives when a stronger candidate has incomplete checks. The incomplete candidate stays visible with its score and gap. Executive source support, at most two leadership places, functional coverage, identity, employer, role, contact-confirmation and Messages gates remain enforced. Company-role coverage follow-up also checks a short roster even when each requested function already has one result; searches remain bounded and do not pad a small company to ten people.

## Verification and limits

Regressions cover ten-person research, four recommendations, cached individual retry, one failed person while nine finish, pending-role scheduling, response-body timeout/cancellation, backend review of later IDs, per-person evidence selection, a long shared directory, ten-conflict save/reload, researched replacement and executive gates. Independent review found no remaining blocking findings after these regressions passed. Existing attribution, public-source rejection, wrong-employer, workspace-isolation and downstream handoff tests remain part of the full suites.

Release status requires exact-SHA CI, the production manifest, backend health and every mandatory smoke check. Authenticated customer acceptance is separate: browser control is unavailable from the current originating mobile context. No paid contact reveals, new paid integrations, outreach sends or workflow activations are included in this repair.

Local final verification: 2,994 customer tests and 687 backend tests passed. JavaScript syntax, static build, and the updated production-proof fixture tests passed. The release configuration includes 252 mandatory production smoke checks.
