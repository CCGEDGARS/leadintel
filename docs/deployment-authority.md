# Deployment authority

LeadIntel has one frontend deployment authority:

- **Frontend:** Vercel project `leadintel`
- **Backend:** Cloudflare Worker service `leadintel-api`
- **Retired frontend platforms:** Cloudflare Pages and GitHub Pages

The machine-readable source of truth is `deployment-authority.json`.

## Rules

1. Frontend production and preview deployments come only from Vercel.
2. Cloudflare remains in use for the Worker API and D1. Retiring Cloudflare Pages must not remove or disable the Worker, D1 database, Worker secrets, or backend GitHub Actions.
3. Do not add a GitHub Pages workflow, a Cloudflare Pages build workflow, `wrangler pages deploy`, or another frontend deployment provider.
4. Customer CI must run whenever the deployment authority contract changes.
5. A Cloudflare Pages project or GitHub App connection configured outside the repository must be disabled in the provider account. Repository tests cannot disable external account integrations.
6. Production claims require the exact Vercel deployment SHA, the live release manifest, backend health, and release-integrity checks to agree.

## Account-level retirement checklist

For the legacy Cloudflare Pages project `leadintel`:

1. Open Cloudflare Dashboard → Workers & Pages → `leadintel`.
2. Confirm the project is the legacy **Pages** frontend, not the `leadintel-api` Worker.
3. Disable automatic production and preview deployments or delete only that Pages project.
4. Preserve `leadintel-api`, D1, Worker routes, secrets, and backend deployment workflows.
5. Open a new pull request and verify that Vercel deploys while no Cloudflare Pages deployment/comment appears.
