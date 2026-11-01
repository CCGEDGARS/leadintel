# Dossier deadline and source-batch recovery

Customer receipts confirmed both providers hit the shared 90-second pass deadline: OpenAI completed 6/6 searches but only read 7/20 sources; Gemini completed 3/6 searches. Neither pass reached validated dossier completion.

Reading every selected URL before extraction meant a later stalled page could leave earlier readable pages unextracted. Read and extract batches of eight, checkpointing sourced facts/people and extracted URLs after each batch. Resume skips extracted sources and retains successful query receipts. Search completion alone still cannot satisfy dossier readiness.

Allow 180 seconds per provider, 405 seconds for the bounded dossier client operation and 420 seconds for its HTTP request. The existing initial buyer-run ceiling is 450 seconds. Two full provider attempts now fit inside the client budget; cancellation and evidence requirements remain unchanged. These are maximum deadlines, not expected completion times or a guarantee of provider availability. Later configured fallback work remains bounded by the overall client deadline.

Regression tests reproduce loss of early readable evidence behind a later stalled batch, verify retained extraction for both providers, and enforce budget alignment. Existing dossier, lifecycle, source-provenance and release checks remain required. Actual Viscaria completion must be checked in the authenticated account; mock tests and deployment proof do not establish customer contacts.
