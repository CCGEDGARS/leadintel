# Lead Intel V2 — MVP Runtime Contract

This contract connects the public V2 interface to private automation without
exposing Firecrawl, OpenAI, Apollo, Google, or email credentials.

## Supported operating modes

1. **Demo** — built-in fictional records; no connection required.
2. **Imported** — a JSON file is loaded into the browser and retained locally.
3. **Live** — V2 performs `GET` against a private snapshot endpoint.

The runtime mode is visible in the top bar. Settings and imported data are
stored in this browser's local storage.

## Snapshot endpoint

V2 calls the configured data URL with:

```http
GET /leadintel/snapshot
Accept: application/json
```

The endpoint must allow the app origin in its CORS policy:

```text
https://ccgedgars.github.io
```

Recommended response:

```json
{
  "schema_version": 1,
  "generated_at": "2026-07-17T06:52:00+03:00",
  "workspace": {
    "id": "edgars-latvia",
    "name": "Edgars · Latvia",
    "market": "Latvia"
  },
  "opportunities": [
    {
      "id": "LV-20260717-001",
      "query_id": "Q-001",
      "run_id": "LV-20260717-0600",
      "company_name": "Example Latvia SIA",
      "score_100": 82,
      "score_10": 8.2,
      "keep": true,
      "confidence": "High",
      "signal_type": "Sales hiring",
      "signal_summary": "The company is recruiting a new commercial leader.",
      "factual_evidence": "A dated public vacancy names the company and role.",
      "pain_points": ["Sales onboarding", "Process consistency"],
      "recommended_offer": "Digital Sales Book",
      "commercial_reason": "A new leader creates a timely implementation window.",
      "decision_maker_role": "Commercial Director",
      "urgency": "High",
      "source_title": "Public vacancy",
      "source_url": "https://example.com/public-vacancy",
      "status": "New"
    }
  ],
  "signals": [],
  "sources": [],
  "runs": []
}
```

The app also accepts the same array under `qualified_leads`, `findings`, or
`raw_findings`. It understands both the snake-case keys above and the current
Google Sheet headings, including `Company Name`, `Score 100`, `Score 10`,
`Signal Summary`, `Pain Points`, and `Source URL`.

## Research trigger endpoint

V2 sends the configured Make webhook:

```http
POST /leadintel/run
Content-Type: application/json
Accept: application/json
```

Body:

```json
{
  "event": "leadintel.run.requested",
  "requested_at": "2026-07-17T06:00:00.000Z",
  "test": false,
  "workspace": {
    "id": "edgars-latvia",
    "name": "Edgars · Latvia",
    "market": "Latvia"
  },
  "settings": {
    "emailCount": 3,
    "appCount": 5,
    "minScore": 7
  },
  "workflow": {}
}
```

Return any `2xx` response after Make accepts the run. The scan may continue
asynchronously. V2 can then refresh the snapshot endpoint.

## `Make Raw Findings` output mapping

The existing Sheet is the MVP system of record. Map the parsed OpenAI output as
follows:

| Sheet column | Value |
|---|---|
| Captured At | Make `now` |
| Run ID | one ID created at scenario start |
| Query ID | Google Sheets search-row `Query ID` |
| Lead Solution | Google Sheets search-row `Lead Solution` |
| Company Name | parsed `company_name` |
| Keep | parsed `keep` |
| Score 100 | parsed `score_100` |
| Score 10 | parsed `score_10` |
| Confidence | parsed `confidence` |
| Signal Type | parsed `signal_type` |
| Signal Summary | parsed `signal_summary` |
| Factual Evidence | parsed `factual_evidence` |
| Pain Points | join parsed `inferred_pain_points` with line breaks |
| Recommended Offer | parsed `recommended_offer` |
| Commercial Reason | parsed `commercial_reason` |
| Decision Maker Role | parsed `decision_maker_role` |
| Urgency | parsed `urgency` |
| Source Title | Iterator `title` |
| Source URL | Iterator `url` |
| Search Query LV | Google Sheets search-row `Latvian query family` |
| Search Query EN | Google Sheets search-row `English query family` |
| Source Group | Google Sheets search-row `Source group` |
| Intent | Google Sheets search-row `Intent` |
| Status | `New` when `keep=true`, otherwise `Rejected` |

## Minimum Make scenario for the basic version

```text
Google Sheets: Search Rows
→ Firecrawl: Search
→ Iterator: web[]
→ OpenAI: Generate a response
→ JSON: Parse JSON
→ Google Sheets: Add a Row (Make Raw Findings)
```

Add a filter before `Add a Row` if only retained findings should be written:
`keep = true`. For auditability, retaining all rows and using `Status` is also
valid.

## Contact and outreach boundary

Apollo enrichment begins only after qualification. The public V2 endpoint
should omit private contact fields unless access control is added. Email or
LinkedIn outreach remains approval-only. The MVP does not auto-send messages.

