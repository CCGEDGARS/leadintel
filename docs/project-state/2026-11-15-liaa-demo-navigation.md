# LIAA demonstration: Strategy refresh and cold Messages

Owner outcome: preserve the existing Ercon/Denmark example and demonstrate the connected export, content and exhibition workflow. Ajour 2026 is the selected event; the owner confirmed an exhibitor scenario. No stand number has been supplied. No outreach, deletion or paid contact action is authorized by this review.

## Observed failures

The real authenticated workspace retained Ercon, Denmark, approved Profile and Strategy, a selected Kitron buyer, three Ready books and three Ready enabled workspace skills. Those checks establish saved assets, not successful AI generation.

Opening Messages directly from Setup produced no visible active module and the notice `Messages could not initialize`. Re-importing the exact already-loaded module exposed its cached evaluation exception: `Cannot read properties of null (reading 'pipeline')`, from `pipelineRows` through `getSelectedCompanies`, `pipeline`, `selectedCandidate` and `captureMessageAuthority`.

Companies is deliberately lazy on Setup. Messages reads its selected-company API during module evaluation, but the shared Messages loader imported the module without hydrating that authoritative owner. Existing rich-text browser acceptance visited Buyers first, so it did not cover this entry path.

Separately, the controlled Profile/Strategy browser journey reopened Strategy and then unexpectedly moved to Companies. Its navigation trace identifies `lookalike-discovery.refreshCurrentStep4`: it treated process stage 4 (Companies) as module 4 (Strategy) and clicked the process control. The delayed callback also trusted saved navigation over a newer visible choice.

## Repair and preservation

- Hydrate Companies through `ensureDiscoveryMounted` before importing Messages. Disable research refresh and recursive Messages preload for that one boundary. Other normal mount callers retain their existing behavior.
- Refresh Strategy through the module navigation owner. Check its current module when the timer executes. The legacy fallback uses the module marker rather than the process stage.
- Preserve all customer data, approved masters, recipient validation, manual drafts, provider permissions and explicit save/approval/send boundaries. No schema or provider changes.
- Refresh the changed loader chains and require their exact assets in the release smoke checks.

## Acceptance evidence

Three deterministic Strategy-navigation regressions failed against the original implementation and pass after repair, including a newer navigation choice and the legacy marker path. The previously failing real HTTP/SQL Profile-to-Strategy journey passes after repair.

The new mandatory Step 6 Chromium case first selects a real fixture CRM recipient, saves Setup, closes its browser context and opens a fresh context. It verifies that Companies is initially unmounted, then opens Messages directly and checks the same recipient, the single visible module, the Writing Assistant entry, preserved provider call count and zero page exceptions. It failed at the cold Messages boundary before repair and passes afterward. The fixture uses controlled providers; it does not establish real customer contact quality or generated-content quality.

Full regression, exact-release proof and the final authenticated Ercon content/exhibition rehearsal must be recorded separately. Firecrawl destroyed two hosted browser sessions during this review; that is an external test-session interruption, not a loss of saved customer records. Do not close authenticated content generation, skill application or exhibition acceptance from saved Ready metadata alone.

## Post-save recipient continuity and unknown stand

The longer Step 6 browser journey also failed during phone style selection, locally and in required CI. A company-records notification clears the recipient validation. Recovery was scheduled only if validation was already pending; a refresh after a successful validation could leave the saved buyer unvalidated until an unrelated synchronization event. A deterministic regression reproduces that exact missing recovery event. Schedule the same bounded, identity-checked recovery for both cases and disable phone style selection while recipient readiness is unavailable. A changed CRM identity remains rejected and the saved working text is preserved.

The owner confirmed Ercon will exhibit at Ajour but has no stand-number information. Keep that field empty and label it optional. An exhibitor invitation can truthfully say `our stand` without a number; retain every known event/date/city/sender field and conditional recipient attendance. This affects event working patterns only. Visitor meeting points, invalid dates, unsafe URLs, follow-up meeting-note requirements and protected business templates retain their existing gates.

The focused recipient/channel/event suite passes 81 cases. The required event browser journey now covers both a visitor with a meeting point and an exhibitor with an empty stand number through actual HTTP/SQL save/reopen, recipient selection, invitation, existing template library and controlled mailbox submission. No real customer outreach is sent. The long Step 6 journey explicitly dispatches the post-save company-records notification before phone preparation so another unrelated sync event cannot conceal the recovery boundary.
