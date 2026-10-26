# Company references — 26 October 2026

The Company materials panel is now Company materials, references and success stories. New uploads allow five PDFs plus ten JPG/PNG images, 15 MiB per file, independently of three writing books. The authenticated workspace owns originals and analysis. Originals are saved unchanged before any AI processing and downloaded through authenticated endpoints. Existing browser-only PDF text remains available in the legacy document list; users may re-upload originals for durable analysis.

## Automatic preparation
A one-time upload ticket sends original bytes directly to the Worker, avoiding the frontend upload ceiling. D1 enforces independent file quotas and SHA-256 deduplication atomically. Processing is durable: the minute scheduler claims up to two files with five-minute leases, with recovery after interruptions. Text PDFs use server extraction; images and sparse/scanned PDFs use customer-owned Gemini/OpenAI/Anthropic credentials. Scanned PDFs above 60 pages need a smaller file. No platform credential is substituted. Provider failures become Needs attention with Retry; originals are retained.

AI analysis extracts a brief English relevance summary, exact source-backed customer/industry/challenge/solution/outcome excerpts, and page/image quotes. Fields absent from the document remain empty. Each evidence quote must match extracted source text. Extracted text and original bytes remain private; bounded metadata uses D1, large text/originals use metered R2. Some long files receive a bounded analysis sample and show partial-coverage guidance.

## Writing
The backend automatically ranks Ready source excerpts against the current recipient/research and writing instruction; up to two relevant references are supplied. English retrieval metadata supports non-English sources but is never claim evidence. No match means no forced reference. Writing Assistant supports explicitly requested Storyselling working alternatives with source citations separate from book citations. It validates referenced quantities against the source; unknown results remain unsupported. General Writing keeps customer isolation. Approved core template preparation is unchanged. Legacy original/rewrite generation receives the same reference evidence.

Source changes/deletion during generation invalidate the response; before Apply, company reference IDs/revisions are checked alongside books. Historical reference attribution persists with a saved working draft. Uploading, analyzing or generating never saves, approves or sends outreach.

## Verification and release
Run focused company-material, writing-assistant, source API, UI and storage tests; both complete suites; static build and Worker dry-run. Release config requires the new UI/runtime, authenticated route boundary and company_materials_version health marker. Follow exact-SHA release proof before describing production as proven.
