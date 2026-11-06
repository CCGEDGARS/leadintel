# Style selection must check the active catalogue

The owner reported that Storyselling displayed the bundled “When the handover stalls” / “Suppose…” text after new Creator Library masters were saved. The previous release's mocked current-catalogue tests did not establish this customer outcome.

A controlled reproduction with the real message adapter demonstrated that an already-loaded builtin catalogue bypassed library retrieval on a visible style click and produced the old hypothetical text. This is a verified failure path, not proof that the customer's authenticated session had that exact stale state; live session evidence remains unavailable.

Visible Email, LinkedIn and Phone style clicks now check the authenticated script catalogue before applying a row. They retain current text while loading, preserve it on retrieval failure, and do not silently use cached fallback text when the request fails. Existing selection/context race guards and Undo remain. Native rendering is still available where the authoritative server catalogue actually specifies a builtin; saved Creator masters retain priority. No master wording or customer records are rewritten by this change.

Regression coverage enters through the actual visible style button and message adapter: cached builtin -> newly activated master; cached builtin -> failed request -> preserved draft. Existing all-style tests now answer the fresh catalogue request and still verify exact text and Undo. Deployment proof and authenticated customer acceptance are separate gates; neither test counts nor release proof should be described as proof of the owner's actual saved content.
