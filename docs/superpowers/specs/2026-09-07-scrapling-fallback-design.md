# Scrapling Fallback Design

## Purpose
Add a real, observable Scrapling extraction path to LeadIntel without replacing Firecrawl as the primary research extractor.

## Architecture
Research extraction remains Firecrawl-first. For a public URL, LeadIntel attempts Firecrawl; when Firecrawl returns a retryable failure, the existing direct public-page fallback is tried; if direct extraction also fails and a Scrapling runtime is configured, the backend calls that runtime. A successful Scrapling response is normalized to the same evidence shape and tagged `source: scrapling-fallback`.

The Scrapling runtime is an HTTP service implemented in Python using Scrapling 0.4.15 `Fetcher`. It accepts only public HTTP(S) URLs, performs a static stealth-capable fetch, returns readable text plus title/source URL/status, and never claims browser/stealth execution beyond what it actually ran.

## Security
- Firecrawl remains primary.
- Scrapling runs only after Firecrawl and direct extraction fail.
- Existing public-URL/SSRF validation remains authoritative in the Cloudflare backend.
- The Scrapling service independently rejects localhost/private-network targets and non-HTTP(S) schemes.
- Runtime calls use a configurable `SCRAPLING_SERVICE_URL` and optional `SCRAPLING_SERVICE_TOKEN` bearer token.
- If the service URL is absent, Scrapling is `unavailable`; LeadIntel must not claim it ran.
- Provenance records include upstream Firecrawl status, direct-fallback failure, runtime source, target URL, and timestamp.

## Runtime contract
`POST /api/scrapling`

Request:
```json
{"url":"https://example.com"}
```

Response:
```json
{"success":true,"data":{"markdown":"...","metadata":{"title":"...","sourceURL":"https://example.com","url":"https://example.com","statusCode":200,"source":"scrapling-fallback","fetchedAt":"..."}}}
```

## Acceptance
1. Firecrawl success never invokes Scrapling.
2. Firecrawl retryable failure + successful direct extraction never invokes Scrapling.
3. Firecrawl retryable failure + failed direct extraction + configured Scrapling may return Scrapling evidence.
4. Scrapling evidence is labeled `scrapling-fallback` only after a successful runtime response.
5. No configured runtime means no Scrapling claim.
6. Private/internal targets are rejected in both layers.
7. Tests cover routing, provenance, unavailable runtime and malformed upstream responses.
