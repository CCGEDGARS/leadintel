# Main AI engine and connected specialists

## User-approved behaviour

Any configured provider can be the single main engine, including Claude. Normal profile/strategy reasoning, company extraction and writing use the main integration. Saving secondary keys preserves the current main engine, including requests from older clients. Explicit Make main engine confirms the saved exact model, and stale confirmations fail without changing the active integration. Model updates test access before saving; credentials remain encrypted and workspace-scoped.

Recommended models checked against official documentation on 12 October: `gpt-6.1-sol`, `claude-sonnet-5-5`, `gemini-3.8-flash`. These are balanced recommendations, not a measured universal optimum. Saved older/custom models remain untouched until the owner tests/saves a replacement. Current Sonnet requests use adaptive thinking at low effort; legacy model requests retain their API envelope.

## Audit correction

The earlier conversation understated existing Gemini usage. Before this update, separate paths already supported market evidence verification, contact review, grounded contact search and OpenAI company-extraction failure recovery. Preserve these roles; do not describe Gemini as unused simply because it is not main. Settings now explicitly explains specialist API usage and its costs.

## Added routing

- General web research keeps configured OpenAI search first; zero returned evidence or unavailable primary research can invoke connected Gemini Google Search grounding once. The API endpoint, server approved research and copilot share this routing. Claude can remain main without an OpenAI credential when Gemini research is configured. Firecrawl/source verification retains separate authority.
- Gemini search exposes only actual grounding citations and supported segments, labels descriptions `model_summary`, and retains missing dates as unknown. It does not confirm identities, contacts, attendance or buying intent. Search results still need underlying-source verification. Missing/unavailable specialists preserve existing evidence or report a gap; cancellation does not initiate fallback.
- Company extraction uses the main engine. Connected Gemini can recover eligible provider timeout/rate-limit/outage failures for OpenAI or Claude; ordinary writing is not automatically rerouted. Existing protected template checks remain authoritative.
- Writing References uses native Gemini PDF recovery only for missing/sparse deterministic text, limited to 8 MiB / 60 pages within existing source limits. Sufficient deterministic page text is retained. Native output is page-index validated and original bytes/SHA remain intact. Cancelling before installation stops provider work and prevents installation. Native page content is not proof of fact.
- Model-extracted PDFs finish as Needs attention even when all pages are recovered. Authenticated members may retrieve current extracted pages and original bytes; UI escapes recovered text, requires loading the exact revision before review acknowledgement, and server requires explicit `acknowledgeExtraction`. Acknowledgement does not activate the source.

## Practical boundaries

The specialist is for Writing References uploads, not automatic OCR of every Step 1 material. Native recovery is bounded; larger and encrypted sources retain coverage/errors. There is no general three-provider ensemble, automatic writing-provider failover, guarantee that a different search index supplies independent corroboration, or authority to change/send approved scripts. No account key, model or active selection was changed in a real customer's workspace during implementation.

## Verification

Tests cover real SQLite provider save/activate/workspace isolation and Claude-primary/Gemini-search routing; provider request envelopes; citation exclusion/cancellation; native PDF bytes/pages/partial coverage, mixed readable/scanned preservation and cancellation; stored review gating; mounted model confirmation and source review. Full suites/build/release proof must be reported for final SHA, separately from live provider quality or customer outcomes. A successful Test & save establishes model access, not superior output quality.

Sources: https://developers.openai.com/api/docs/models/gpt-6.1-sol ; https://platform.claude.com/docs/en/models/overview ; https://www.anthropic.com/claude-sonnet-5-5 ; https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash ; https://ai.google.dev/gemini-api/docs/google-search ; https://ai.google.dev/gemini-api/docs/document-processing .

Local verification: backend `npm test` 565/565; customer full suite 2436/2436; production static build passes; canonical approved scripts unchanged; whitespace checks clean. Read-only code review completed and fixes include concurrent activation preservation, stale workspace response guards and combined extraction size enforcement. Deployment status remains subject to exact-SHA CI and release proof.
