# Independent lifetimes for research status requests

The authenticated Stop research control returned `AbortError: signal is aborted without reason` while the Kitron server job remained active. Its stack passed through the status-observation request. The API transport coalesced simultaneous GETs even when callers supplied different AbortSignals. A shared response clone still shares the leading request's underlying response-body lifetime; the existing fallback covered a rejected fetch but not an abort after response headers were delivered.

A regression uses a real local HTTP response stream, two simultaneous status readers and separate controllers. Aborting the polling reader must reject that reader while the cancellation reader receives the complete status. The original transport fails this test; the repaired transport passes. Unsignaled startup GETs still coalesce. Signaled requests, including Request objects carrying their own signals, now use independent transports.

The browser failure is observed; its connection to shared streaming cancellation is supported by the controlled reproduction. Exact-release proof and another authenticated Stop/Resume check are still required before claiming customer acceptance. No paid lookup or outreach was authorized by this repair.

## Company assessment ownership at the Buyers handoff

After the owner changed initial prospecting to B2B industrial fit, actual company review produced four eligible companies and all four were saved in Master CRM. Kitron's Companies assessment was 76/100 with no company gaps, but its existing selected Buyers snapshot still carried the earlier purchasing assessment. Recomputing qualification on that stale snapshot returned an unverified purchasing application, while recomputing the newly reviewed Companies row passed.

Existing selection was deliberately retained to protect buyer research, but the handoff kept the entire old company context as well. Refresh only the authoritative company evidence, fit and assessment fields on entry to Buyers or explicit reselection. Preserve the selected object, people, manual roles, notes and contact research. Only an actionable result for the same domain and current Strategy may supply the update. Navigation/reselection, stale and foreign results, saved reload and preservation regressions cover this boundary.
