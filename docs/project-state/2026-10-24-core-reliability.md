# CRM recovery and runtime incident ownership — 24 October 2026

## Root causes established in local execution

1. Server request deadlines aborted the fetch controller but did not independently settle the request promise. A transport or response-body reader that ignored abort could remain pending indefinitely and later return success. An already canceled request still reached the transport. Four failing behavioral regressions reproduced these cases before the fix.
2. CRM timeout records survive in the workspace task history, but Retry handlers are memory-only. After reload, a retained error could offer no Retry. Discovery initializes after account verification, so `server-ready` can already have fired before its listeners bind. Earlier-stage workspaces also leave Buyers unmounted. A handler must therefore be restored during Discovery initialization, before Buyers mounts, without marking the error recovered.
3. A nominally successful CRM response with a missing/null `companies` list became an empty list. That could replace cached company/pipeline data and complete a prior failure task without validating the read. A replaced bridge using the same workspace ID, or a sign-out during a read, also passed the older workspace-ID-only response guard.
4. Attention runtime incidents are held only in the current page's memory; they are not persisted in localStorage, unlike task history. The previous registry discarded structured request provenance and retained only message text. Therefore a later successful CRM read could not distinguish its own old transport incident from an unrelated component failure.

The currently observed customer generic warning has no captured fresh exception stack in this work. These findings do not establish that every generic warning came from CRM. Unknown incidents remain actionable through Reload; they are never cleared by a workspace save, provider check, journey change, or matching exception text.

## Resulting behavior

- The existing bounded server timeout now races the complete fetch-and-body read. Timeout and external cancellation settle independently of advisory abort; ignored late successes cannot escape. Pre-canceled requests make no transport call. Timers and external listeners are removed when the boundary settles. Writes acquire no automatic retry.
- CRM refresh restores a retained workspace-specific Retry during initialization, including when `server-ready` preceded listener setup. Retry can mount Buyers without starting a competing background refresh. Merely registering the action preserves the failure status. Only a valid successful read completes its task.
- Company lists are validated before replacing either cache or hydrating local pipeline evidence. Revision, authentication, workspace ID and exact bridge identity guard both list and detail response application and warning recovery.
- Journey selection is read from `stage.active`, independently of completion status. Legacy `status: current` remains compatible only when no explicit active flag exists. Only required incomplete steps produce a stage recommendation; optional improvements cannot reopen a completed stage.
- Attention preserves typed request code/path, transient flag, workspace and bridge identity for runtime incidents. CRM refresh captures the IDs of already observed transient `/api/crm/companies` transport incidents at its start. After a valid same-scope refresh and render, it clears only those captured incidents. Unknown exceptions, another endpoint/workspace/bridge, and incidents raised during the recovery attempt remain active. Existing reset/reload behavior is unchanged.

## Verification

- RED before implementation: deadline ignored by fetch, stalled response-body deadline, ignored external abort, pre-canceled fetch; persisted Retry loss, malformed-success cache erasure, same-workspace bridge replacement, and sign-out race.
- Focused command: `node --test customer/test/crm-refresh-recovery.test.js customer/test/attention*.test.js customer/test/server*.test.js customer/test/brand-asset-bridge.test.js customer/test/my-flows-bridge.test.js customer/test/crm-async.test.js customer/test/crm-activity-integration.test.js customer/test/empty-buyer-crm-recovery.test.js customer/test/journey-progress.test.js` — **149 passed, 0 failed**.
- Includes real Attention/task drawer click recovery, durable task save/reload/rebind, initialization after missed server-ready, actual CRM refresh → runtime recovery integration, unknown-error retention, cache/evidence preservation, deletion/revision and workspace race checks, and bridge asset/save callers using the revised transport boundary.
- JavaScript syntax checks for all four modified runtime files and `git diff --check` passed.
- A complete customer suite was started, then interrupted at the coordinating agent's request while other independent edits were active. No full-suite result is claimed here; the coordinating agent owns the final integrated suite/build.
- No browser, paid provider calls, authenticated customer mutations, commit, push, deployment or production proof were performed in this delegated scope. These checks establish local implementation behavior, not customer acceptance or production recovery.

## Release integration

Changed runtime files: `customer/server-bridge.js`, `customer/attention-centre.js`, `customer/attention-centre-model.js`, `customer/discovery-ui.js`. The coordinating agent must append cache versions to their existing script URLs in `customer/index.html`, preserving prior parameters. The Attention model also requires a version bump for its new active-stage integration. The coordinating agent owns loader/index edits and exact-SHA release verification.

Prevention: persistent task status and executable recovery actions have separate lifetimes; restore both explicitly on initialization. A recovered operation may clear only its verified scope and its pre-existing incident snapshot. Treat controller abort as advisory and validate successful payloads before replacing saved state.

## Integration follow-up: acknowledged saves and browser snapshots

The integrated suite exposed an additional transport boundary: `workspace-persistence.js` wraps fetch and awaits a durable browser snapshot after it has already parsed the server acknowledgement. Racing this entire wrapper against a network deadline incorrectly rejected an already committed PUT while its local IndexedDB write was still pending. The existing committed-PUT regression reproduced the failure; it now additionally proves saving remains pending until browser durability completes.

The bridge and persistence wrapper now share a private network-read-complete callback. Only a parsed network response ends the network watchdog; durable browser snapshot work remains awaited. The callback is removed before native fetch, and canceled late body results are rejected before they can publish a synced browser snapshot. A response-body-stall regression confirms that the network deadline remains active before an acknowledgement exists, and that a late body cannot update the bridge version or browser sync baseline. The four fetch/body/cancellation regressions still pass.

This follow-up changes `customer/workspace-persistence.js` as well as the bridge and adds coverage in `customer/test/workspace-sync-recovery.test.js`. Its existing index script URL also needs a cache-version append. Focused persistence, save-recovery, transport and brand-asset tests: **96 passed, 0 failed**. Syntax and diff checks passed. No deployment/customer recovery is claimed.

Final combined focused run (the earlier 149-test command plus `customer/test/workspace-sync-recovery.test.js` and `customer/test/workspace-persistence.test.js`): **201 passed, 0 failed**. Final bridge/persistence syntax and diff checks passed.

## Integration follow-up: pure startup recovery registration

The deployment guard correctly prohibits CRM refresh invocation inside `initDiscovery`, including a call that currently returns before issuing I/O. Recovery action restoration is now its own `registerCrmRecoveryRetry()` function, called by initialization and refresh. It only restores a retained task's callback; CRM requests, Buyers mounting and rendering remain inside the explicit Retry handler or the normal stage flow. The regression now fails if Setup initialization invokes `refreshCrmState` at all. Source-extraction fixtures include the real registration helper; the startup fixture supplies only its registration stub.

Final scoped check for this refactor: **57 passed, 0 failed**, including actual stored-task retry initialization, Messages/Delivery startup, empty-buyer CRM recovery, Attention and build stage-isolation checks. `node scripts/verify-discovery-deploy.mjs`, Discovery syntax and diff checks passed. No deployment guard was weakened by this refactor.
