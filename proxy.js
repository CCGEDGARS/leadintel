// ============================================================
// LeadIntel v2 — Local Proxy Server
// Routes: Apollo + Lusha + Firecrawl (CORS bypass)
// Run:    node proxy.js
// Keep Terminal open while using LeadIntel.html
// ============================================================

const http  = require('http');
const https = require('https');
const PORT  = 3131;

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Apollo-Key, X-Lusha-Key, X-Firecrawl-Key');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    const url = req.url;

    // ─── APOLLO: People Search ────────────────────────────────────────────────
    if (url === '/apollo-search' && req.method === 'POST') {
      try {
        const apolloKey = req.headers['x-apollo-key'];
        const payload = JSON.parse(body);
        const result = await makeRequest({
          hostname: 'api.apollo.io',
          path: '/api/v1/mixed_people/api_search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': apolloKey
          }
        }, JSON.stringify(payload));
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    }

    // ─── APOLLO: Organization Enrich ─────────────────────────────────────────
    else if (url === '/apollo-org' && req.method === 'POST') {
      try {
        const apolloKey = req.headers['x-apollo-key'];
        const payload = JSON.parse(body);
        const result = await makeRequest({
          hostname: 'api.apollo.io',
          path: '/api/v1/organizations/enrich',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apolloKey
          }
        }, JSON.stringify(payload));
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    }

    // ─── LUSHA: Contact Enrich ────────────────────────────────────────────────
    else if (url === '/lusha-enrich' && req.method === 'POST') {
      try {
        const lushaKey = req.headers['x-lusha-key'];
        const payload = JSON.parse(body);
        const qs = new URLSearchParams(payload).toString();
        const result = await makeRequest({
          hostname: 'api.lusha.com',
          path: `/api/linkedin?${qs}`,
          method: 'GET',
          headers: {
            'api_key': lushaKey,
            'Content-Type': 'application/json'
          }
        });
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    }

    // ─── FIRECRAWL: Deep Scrape ───────────────────────────────────────────────
    else if (url === '/firecrawl-scrape' && req.method === 'POST') {
      try {
        const firecrawlKey = req.headers['x-firecrawl-key'];
        const payload = JSON.parse(body);
        const result = await makeRequest({
          hostname: 'api.firecrawl.dev',
          path: '/v1/scrape',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlKey}`
          }
        }, JSON.stringify(payload));
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    }

    // ─── FIRECRAWL: Crawl (multi-page) ───────────────────────────────────────
    else if (url === '/firecrawl-crawl' && req.method === 'POST') {
      try {
        const firecrawlKey = req.headers['x-firecrawl-key'];
        const payload = JSON.parse(body);
        const result = await makeRequest({
          hostname: 'api.firecrawl.dev',
          path: '/v1/crawl',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlKey}`
          }
        }, JSON.stringify(payload));
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    }

    // ─── FIRECRAWL: Crawl Status ──────────────────────────────────────────────
    else if (url.startsWith('/firecrawl-status/') && req.method === 'GET') {
      try {
        const firecrawlKey = req.headers['x-firecrawl-key'];
        const crawlId = url.replace('/firecrawl-status/', '');
        const result = await makeRequest({
          hostname: 'api.firecrawl.dev',
          path: `/v1/crawl/${crawlId}`,
          method: 'GET',
          headers: { 'Authorization': `Bearer ${firecrawlKey}` }
        });
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    }

    // ─── FIRECRAWL: Search ────────────────────────────────────────────────────
    else if (url === '/firecrawl-search' && req.method === 'POST') {
      try {
        const firecrawlKey = req.headers['x-firecrawl-key'];
        const payload = JSON.parse(body);
        const result = await makeRequest({
          hostname: 'api.firecrawl.dev',
          path: '/v1/search',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlKey}`
          }
        }, JSON.stringify(payload));
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    }

    // ─── FIRECRAWL: Map ───────────────────────────────────────────────────────
    else if (url === '/firecrawl-map' && req.method === 'POST') {
      try {
        const firecrawlKey = req.headers['x-firecrawl-key'];
        const payload = JSON.parse(body);
        const result = await makeRequest({
          hostname: 'api.firecrawl.dev',
          path: '/v1/map',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firecrawlKey}`
          }
        }, JSON.stringify(payload));
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    }

    else {
      res.writeHead(404); res.end(JSON.stringify({ error: 'Route not found' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ LeadIntel Proxy running on http://localhost:${PORT}`);
  console.log('   Routes: /apollo-search · /apollo-org · /lusha-enrich');
  console.log('   Routes: /firecrawl-scrape · /firecrawl-crawl · /firecrawl-status/:id · /firecrawl-search · /firecrawl-map');
  console.log('\n   Open LeadIntel.html in your browser to start.\n');
});
