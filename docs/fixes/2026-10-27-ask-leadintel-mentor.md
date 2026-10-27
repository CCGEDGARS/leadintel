# Ask LeadIntel — business mentor upgrade

## Approved purpose and boundaries

User instructions, 27 October 2026: use the exact supplied mentor introduction, provide support throughout the journey, diagnose missing information and connections, assess quality, create drafts, research publicly available business information and recommend solutions. Ask LeadIntel must never alter code, interface elements, settings, processes, workflows, CRM records, approved templates or operational data, even when asked in chat. The user operates dedicated app controls. Chat history and saved memories retain their separate explicit management.

## Delivered behaviour

- The exact headline and paragraph appear above the composer. The introduction starts compact; **Explore capabilities** reveals three short capability descriptions and the advisory boundary.
- Personal business advice uses the saved profile, goals and workspace context. It no longer takes the context-free general-knowledge shortcut.
- Statistical comparisons, business scenarios and public website analysis have dedicated instruction routes. Forecasting market demand no longer selects credit/billing troubleshooting merely because the word “forecast” appears.
- An explicit website URL triggers the existing bounded public-page extractor. At most two distinct public pages are read per turn; private/local addresses, credential-bearing URLs and restricted LinkedIn pages are excluded. Existing redirect validation, page size, content type and timeout limits apply. The reader uses GET without browser sessions or credentials and does not change app settings or operational records.
- Page extracts are distinguished from search summaries. Sources retain their URLs and access timestamps; actual success/failure receipts are returned and persisted in conversation metadata. Search still uses the workspace's existing research providers and bounded follow-up. Failures remain visible as evidence gaps.
- Direct requests to change settings or operational data receive a deterministic advisory response before model/provider execution. Executable action proposals remain disabled, and no new write tools exist.
- Company/decision-maker research uses public professional evidence. Contact completeness, role attribution and email/phone verification remain distinct. Paid enrichment stays behind the existing dedicated Buyers approvals.
- Scenarios require assumptions, uncertainty and a time horizon. Statistical comparisons require compatible definitions, periods, units and denominators. Neither the model prompt nor the interface promises certainty or unrestricted personal data.

## Intentionally separate

Book-to-skill creation and retrieval of customer-created skills are not implemented by this change and are not advertised as available. Built-in specialist instructions are not a user skill library. No new paid contact-enrichment path or background automation was added.

## Validation and practical limits

Tests cover the exact compact introduction and accessible expansion, saved-context mentoring, specialist routing, mutation refusal, page-read receipts, real HTML extraction, redaction, private/credential URL exclusion, redirect safety, bounded URL counts, explicit no-browse requests and failed reads. Existing chat history, memory, streaming, isolation and read-only tests remain in the suites.

Public pages can block extraction, require JavaScript or lack the required information. The assistant must report that gap and may use available public search evidence with attribution. Unit and integration tests validate the implemented mechanisms and prompt contract; they do not establish that every model-generated business recommendation or forecast is correct. Production verification checks the exact release, backend version, approved copy and mandatory smoke checks.

## Review corrections

Independent review identified and verified three corrections before merge. Saved business context is now the default; only a tightly anchored allowlist of standalone stable-concept definitions may reuse a context-free planning answer. Diagnostic persistence now requires an explicit evaluated snapshot, so refused or unsafe requests cannot resolve existing warnings. Research receipts distinguish confirmed execution, an explicit non-execution and an unknown execution flag; provider/model/fallback/warning evidence is retained, and explicitly ungrounded source results are excluded. Regressions cover singular/plural and non-English personal advice, “this business” references, unchanged operational state and diagnostics, and ungrounded provider responses.
