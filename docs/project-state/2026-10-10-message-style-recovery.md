# Message style recovery

The authenticated browser reproduced a stored mismatch: NLP selected, a saved Professional body displayed, and clicking NLP again did nothing. Explicit Update successfully produced the NLP body. Initial workspace startup showed Saving to LeadIntel and blocked controls, then settled to Synced to LeadIntel; no persistent browser document-loading loop was reproduced.

Three connected causes were verified:

- The change handler returned whenever the selected setting was unchanged, even when the applied draft style differed. Clicking the selected style now retries only that mismatch. Already applied manual copies remain unchanged.
- Old subject research kept `messageFactResearchBusy` true. A style choice persisted its setting, then the update guard silently refused to apply it. Explicit email style selection now aborts the old evidence request and invalidates its owner before updating. Late results cannot overwrite the new style. Unchanged evidence attempts are not forcibly restarted by a style retry; explicit Update/Find missing details retain their retry behavior.
- `foundation()` overlaid raw Profile strings after normalization, while `readStudio()` normalized them again. Trailing whitespace made the response scope differ from the request scope. Valid responses and provider errors could both be silently discarded, leaving stale Preparing text. The final foundation now uses the same normalization as storage and generation.

The new regression loads the entire outreach UI module, mounts its real workspace/editor/translation controls, and uses actual Profile foundation, storage, rendering, event handlers, field preparation and evidence research. Network calls are controlled boundaries. Tests cover persisted mismatch retry, active research cancellation and late results, failed field preparation/loading recovery and retry with whitespace-bearing Profile input, preserved manual NLP edits, complete page reload, durable Undo and CRM snapshot restoration. Approved master literals remain unchanged.

Automated runtime tests and exact-SHA release proof are separate from customer acceptance. The observed browser was authenticated; explicit Update's NLP result was observed. New selection behavior and real CRM Save/reopen must be verified after release before claiming authenticated acceptance of this revision. No message was approved, sent, or added to an active flow.
