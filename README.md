# Lead Intel

Lead Intel is a Latvia-focused opportunity-research workspace for daily public
market monitoring, AI qualification, decision-maker enrichment, and
human-approved outreach.

## Open the app

- Version selector: <https://ccgedgars.github.io/leadintel/>
- V2 control centre: <https://ccgedgars.github.io/leadintel/v2/>
- Archived V1: <https://ccgedgars.github.io/leadintel/LeadIntel.html>

V2 is a static browser application. It is functional with demo data and JSON
imports. Live automation requires private Make or backend endpoints; provider
API keys must never be placed in this public repository or in browser settings.

## Basic-version workflow

1. Google Sheets supplies active research queries.
2. Make calls Firecrawl search for each query.
3. OpenAI analyses and scores each public signal.
4. Make parses the JSON and appends it to `Make Raw Findings`.
5. A private snapshot endpoint exposes safe lead data to V2.
6. V2 displays the daily shortlist, dossiers, contacts, runs, and approval queue.
7. The internal email contains the top three qualified opportunities.

The required endpoint payloads and Sheet mapping are documented in
[`docs/MVP_RUNTIME_CONTRACT.md`](docs/MVP_RUNTIME_CONTRACT.md).

## Local preview

From this directory:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080/v2/`.

## Safety

- Public business data only.
- Predicted email addresses remain research-only until verified.
- Suppression and eligibility checks are required before campaign use.
- Outreach sending is disabled in the basic version; a human must approve it.
- Credentials belong in Make/provider connections or a private backend.

