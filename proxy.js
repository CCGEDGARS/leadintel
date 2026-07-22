// ============================================================
// LeadIntel — Cloudflare Worker
// Deploy: paste into workers.cloudflare.com dashboard
// Worker URL: https://apollo-proxy.edgars-7e7.workers.dev/
// Optional secrets: APOLLO_API_KEY, FIRECRAWL_API_KEY
//
// Routes:
//   POST /                    → Apollo people search   (X-Api-Key)
//   POST /firecrawl-scrape    → Firecrawl /v1/scrape   (X-Firecrawl-Key)
//   POST /firecrawl-search    → Firecrawl /v1/search   (X-Firecrawl-Key)
//   POST /firecrawl-map       → Firecrawl /v1/map      (X-Firecrawl-Key)
//   POST /firecrawl-crawl     → Firecrawl /v1/crawl    (X-Firecrawl-Key)
//   GET  /firecrawl-status/:id→ Firecrawl /v1/crawl/:id(X-Firecrawl-Key)
// ============================================================

const ALLOWED_ORIGINS = new Set([
  'https://ccgedgars.github.io',
  'https://leadintel.ccgroup.lv',
]);

function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, X-Firecrawl-Key',
    'Vary': 'Origin',
  };
  if (origin && isAllowedOrigin(request)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function apiKey(env, secretName, request, headerName) {
  return (env && env[secretName]) || request.headers.get(headerName) || '';
}

function corsResponse(request, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    if (!isAllowedOrigin(request)) {
      return corsResponse(request, 403, { error: 'Origin not allowed' });
    }

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ─── APOLLO: People Search ────────────────────────────────────────────────
    if (path === '/' && request.method === 'POST') {
      try {
        const apolloKey = apiKey(env, 'APOLLO_API_KEY', request, 'X-Api-Key');
        if (!apolloKey) return corsResponse(request, 401, { error: 'Apollo API key is not configured' });
        const body = await request.text();
        const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': apolloKey,
          },
          body,
        });
        const data = await res.json();
        return corsResponse(request, res.status, data);
      } catch (e) {
        return corsResponse(request, 500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Scrape ────────────────────────────────────────────────────
    if (path === '/firecrawl-scrape' && request.method === 'POST') {
      try {
        const fcKey = apiKey(env, 'FIRECRAWL_API_KEY', request, 'X-Firecrawl-Key');
        if (!fcKey) return corsResponse(request, 401, { error: 'Firecrawl API key is not configured' });
        const body = await request.text();
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fcKey}`,
          },
          body,
        });
        const data = await res.json();
        return corsResponse(request, res.status, data);
      } catch (e) {
        return corsResponse(request, 500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Search ────────────────────────────────────────────────────
    if (path === '/firecrawl-search' && request.method === 'POST') {
      try {
        const fcKey = apiKey(env, 'FIRECRAWL_API_KEY', request, 'X-Firecrawl-Key');
        if (!fcKey) return corsResponse(request, 401, { error: 'Firecrawl API key is not configured' });
        const body = await request.text();
        const res = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fcKey}`,
          },
          body,
        });
        const data = await res.json();
        return corsResponse(request, res.status, data);
      } catch (e) {
        return corsResponse(request, 500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Map ───────────────────────────────────────────────────────
    if (path === '/firecrawl-map' && request.method === 'POST') {
      try {
        const fcKey = apiKey(env, 'FIRECRAWL_API_KEY', request, 'X-Firecrawl-Key');
        if (!fcKey) return corsResponse(request, 401, { error: 'Firecrawl API key is not configured' });
        const body = await request.text();
        const res = await fetch('https://api.firecrawl.dev/v1/map', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fcKey}`,
          },
          body,
        });
        const data = await res.json();
        return corsResponse(request, res.status, data);
      } catch (e) {
        return corsResponse(request, 500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Crawl ─────────────────────────────────────────────────────
    if (path === '/firecrawl-crawl' && request.method === 'POST') {
      try {
        const fcKey = apiKey(env, 'FIRECRAWL_API_KEY', request, 'X-Firecrawl-Key');
        if (!fcKey) return corsResponse(request, 401, { error: 'Firecrawl API key is not configured' });
        const body = await request.text();
        const res = await fetch('https://api.firecrawl.dev/v1/crawl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fcKey}`,
          },
          body,
        });
        const data = await res.json();
        return corsResponse(request, res.status, data);
      } catch (e) {
        return corsResponse(request, 500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Crawl Status ──────────────────────────────────────────────
    if (path.startsWith('/firecrawl-status/') && request.method === 'GET') {
      try {
        const fcKey = apiKey(env, 'FIRECRAWL_API_KEY', request, 'X-Firecrawl-Key');
        if (!fcKey) return corsResponse(request, 401, { error: 'Firecrawl API key is not configured' });
        const crawlId = path.replace('/firecrawl-status/', '');
        const res = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
          headers: { 'Authorization': `Bearer ${fcKey}` },
        });
        const data = await res.json();
        return corsResponse(request, res.status, data);
      } catch (e) {
        return corsResponse(request, 500, { error: e.message });
      }
    }

    return corsResponse(request, 404, { error: 'Route not found' });
  },
};
