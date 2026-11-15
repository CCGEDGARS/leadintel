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
