// ============================================================
// LeadIntel — Cloudflare Worker
// Deploy: paste into workers.cloudflare.com dashboard
// Worker URL: https://apollo-proxy.edgars-7e7.workers.dev/
//
// Routes:
//   POST /                    → Apollo people search   (X-Api-Key)
//   POST /firecrawl-scrape    → Firecrawl /v1/scrape   (X-Firecrawl-Key)
//   POST /firecrawl-search    → Firecrawl /v1/search   (X-Firecrawl-Key)
//   POST /firecrawl-map       → Firecrawl /v1/map      (X-Firecrawl-Key)
//   POST /firecrawl-crawl     → Firecrawl /v1/crawl    (X-Firecrawl-Key)
//   GET  /firecrawl-status/:id→ Firecrawl /v1/crawl/:id(X-Firecrawl-Key)
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, X-Firecrawl-Key',
};

function corsResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ─── APOLLO: People Search ────────────────────────────────────────────────
    if (path === '/' && request.method === 'POST') {
      try {
        const apolloKey = request.headers.get('X-Api-Key');
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
        return corsResponse(res.status, data);
      } catch (e) {
        return corsResponse(500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Scrape ────────────────────────────────────────────────────
    if (path === '/firecrawl-scrape' && request.method === 'POST') {
      try {
        const fcKey = request.headers.get('X-Firecrawl-Key');
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
        return corsResponse(res.status, data);
      } catch (e) {
        return corsResponse(500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Search ────────────────────────────────────────────────────
    if (path === '/firecrawl-search' && request.method === 'POST') {
      try {
        const fcKey = request.headers.get('X-Firecrawl-Key');
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
        return corsResponse(res.status, data);
      } catch (e) {
        return corsResponse(500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Map ───────────────────────────────────────────────────────
    if (path === '/firecrawl-map' && request.method === 'POST') {
      try {
        const fcKey = request.headers.get('X-Firecrawl-Key');
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
        return corsResponse(res.status, data);
      } catch (e) {
        return corsResponse(500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Crawl ─────────────────────────────────────────────────────
    if (path === '/firecrawl-crawl' && request.method === 'POST') {
      try {
        const fcKey = request.headers.get('X-Firecrawl-Key');
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
        return corsResponse(res.status, data);
      } catch (e) {
        return corsResponse(500, { error: e.message });
      }
    }

    // ─── FIRECRAWL: Crawl Status ──────────────────────────────────────────────
    if (path.startsWith('/firecrawl-status/') && request.method === 'GET') {
      try {
        const fcKey = request.headers.get('X-Firecrawl-Key');
        const crawlId = path.replace('/firecrawl-status/', '');
        const res = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
          headers: { 'Authorization': `Bearer ${fcKey}` },
        });
        const data = await res.json();
        return corsResponse(res.status, data);
      } catch (e) {
        return corsResponse(500, { error: e.message });
      }
    }

    return corsResponse(404, { error: 'Route not found' });
  },
};
