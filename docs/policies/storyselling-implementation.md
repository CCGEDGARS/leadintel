# Native Storyselling correction

The 26 October user correction supersedes the separate bank workflow described below. Storyselling now uses mandatory channel templates through the ordinary style selection and working-copy flow, plus the ordinary Writing Assistant with optional books. No story card, card approval, purpose/example selector or objection field is required. Shared authority: `customer/storyselling-native.js`. Email/direct LinkedIn/phone and paid LinkedIn InMail stages are supported. Normal relevant company evidence and attribution checks apply during explicit assistant revisions. Historical bank APIs and saved provenance are retained.

See `../plans/2026-10-26-storyselling-native-correction.md` for the current design. The following records the superseded v1 implementation for compatibility context only.

# Storyselling v1

The user-supplied 26 October 2026 master is preserved in storyselling-source-v1.md and its fourteen template sections are included in the server generation context.

Use Messages → Choose your style → Storyselling. This fifth style opens Writing Assistant with Storyselling already selected and a ready-to-edit instruction. Opening it preserves the current message and starts no generation. The assistant selector remains available too. The managed script library allows this entry through without looking for a protected core template. Applied and saved messages display Storyselling only while their exact text matches the saved story-source receipt, including after CRM reopen. Manage story bank supports up to 100 workspace cards, manual editing, drafts, explicit approval, deletion and JSON export. Prepare from company reference copies only existing analysis fields and exact evidence locations; it does not invent missing narrative details or approve sources. Sharing approval includes the participant dignity/accuracy check.

Generation selects only approved cards in the requested language, matched to supplied buyer role/industry/country/evidence and the declared objection. A match score of 0.6 is a deterministic matching threshold, not a calibrated probability. A reviewed trigger plus its source URL is mandatory. Empty/mismatched banks return actionable BLOCKED/FALLBACK errors without replacing the working draft.

Email <=130 words, DM <=90 and spoken-call copy <=100; exact narrative facts are checked. Fourteen message purposes are supported. An independent second AI call checks ten criteria, requiring >=16/20 and full marks for truth, reason, story completeness and hook. Invalid output preserves the draft. Critic calls incur the configured provider’s normal usage. These checks do not independently verify source claims or guarantee semantic truth; approval and factual/native review remain necessary.

Successful previews reserve the card per stable buyer ID (email fallback). The returned receipt permits revision of the same preview; a different request cannot reuse it as another touch. Deleted/changed cards and linked material revisions invalidate applying the preview. Workspace and recipient guards remain. Card provenance and critic results travel with applied/saved drafts. Existing canonical masters, first originals, Undo, Save, approval and send permissions stay separate.

Cadence shown in the bank is a planning guide, not a new delivery scheduler. This bounded release does not start/send an automatic multi-channel sequence, seed illustrative cases, create unverified LV/RU/Kazakh masters, generate 150/300-word meeting variants, or measure reply rates per card. Existing explicit delivery/translation tools remain in force. Same-language approved cards are required to protect exact hard facts. Do not describe this as a fully implemented autonomous story campaign.

Validation: backend/storyselling.test.mjs and customer/test/storyselling.test.js cover card lifecycle, truth classes, matching, critic rejection, hard points, channel ceilings, user objection handoff, native hypothetical framing, workspace isolation, stale revisions, stable recipient identity, and preview receipt reuse. Full backend/customer suites and exact-SHA release proof are required for production claims.
