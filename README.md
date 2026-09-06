# LeadIntel

LeadIntel is a commercial-intelligence workspace for researching markets, identifying evidence-backed B2B opportunities, finding relevant decision-makers, preparing human-approved outreach, and learning from real sales outcomes.

## Production architecture

- Active workspace: <https://leadintel.ccgroup.lv/customer/>
- Production root: <https://leadintel.ccgroup.lv/> redirects to the active customer workspace.
- Frontend deployment: **Vercel**.
- Backend: **Cloudflare Worker + D1** at `leadintel-api.edgars-7e7.workers.dev`.
- Master CRM: workspace-scoped D1 companies, contacts, intelligence and activity history.
- Repository: GitHub is the source-control and CI system; GitHub Pages is retired.

The legacy `/v2/` entry point remains only as a compatibility redirect to `/customer/`. `LeadIntel.html` is the archived V1 application and is not the production workspace.

## Active commercial workflow

1. Website / Company & market
2. Context / Strategic intake
3. Intelligence profile
4. Market Strategy / ICP + Signals
5. Discovery
6. Content & Scripts
7. Delivery & Learning

Master CRM is a persistent layer across the workflow rather than an eighth step. Removing a company from the active pipeline preserves the CRM company, contacts, intelligence and activity history.

## Data and integration architecture

The browser keeps compact working state for onboarding and active UI flows. Growing CRM data is stored separately in D1 and is deliberately excluded from the synchronized 500 KB customer-state budget.

Public web research is performed through the configured intelligence proxies. Gmail OAuth credentials and refresh tokens stay in the private Worker integration layer and are never stored in the browser or Master CRM. Sending remains human-approved.

Market Strategy supports bounded Quick Research, broader Deep Research and durable Continuous Monitoring. Monitoring configurations, run history, deduplicated evidence and opportunity alerts are stored in D1; the hourly Worker schedule executes only due daily, weekly or monthly configurations. See `docs/market-research-and-monitoring.md`.

## Local preview

From the repository root:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080/customer/`.

## Verification

Backend:

```sh
cd backend
npm ci
npm test
```

Customer workspace:

```sh
node --test customer/test/*.test.js
```

Vercel static artifact:

```sh
bash scripts/build-vercel-static.sh
```

The public artifact must not contain backend source, repository metadata, CI files, test files, scripts, docs, or private credentials.

## Safety rules

- Public business research data only unless the workspace user explicitly supplies authorized business context.
- Do not invent evidence, contacts or email addresses.
- Suppressed companies remain stored for history but are blocked from normal pipeline reactivation and outbound activity.
- Credentials belong in private provider/Worker connections, never in public source or browser state.
- Production changes require green backend/customer tests and verified deployment artifacts.
