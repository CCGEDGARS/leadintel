# Independent lifetimes for research status requests

The authenticated Stop research control returned `AbortError: signal is aborted without reason` while the Kitron server job remained active. Its stack passed through the status-observation request. The API transport coalesced simultaneous GETs even when callers supplied different AbortSignals. A shared response clone still shares the leading request's underlying response-body lifetime; the existing fallback covered a rejected fetch but not an abort after response headers were delivered.

A regression uses a real local HTTP response stream, two simultaneous status readers and separate controllers. Aborting the polling reader must reject that reader while the cancellation reader receives the complete status. The original transport fails this test; the repaired transport passes. Unsignaled startup GETs still coalesce. Signaled requests, including Request objects carrying their own signals, now use independent transports.

The browser failure is observed; its connection to shared streaming cancellation is supported by the controlled reproduction. Exact-release proof and another authenticated Stop/Resume check are still required before claiming customer acceptance. No paid lookup or outreach was authorized by this repair.
