const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const discovery=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const proxy=fs.readFileSync(path.join(__dirname,'../../proxy.js'),'utf8');

test('company discovery requests only proxy-approved browser headers',()=>{
  const allowed=/Access-Control-Allow-Headers': '([^']+)'/.exec(proxy)?.[1].toLowerCase().split(/,\s*/) || [];
  for(const route of ['firecrawl-search','firecrawl-scrape']){
    const request=discovery.match(new RegExp('fetch\\(`\\$\\{INTELLIGENCE_PROXY\\}/'+route+'`[,]\\{[^\\n]+'))?.[0];
    assert.ok(request,`${route} request exists`);
    const headers=[...request.matchAll(/"([A-Za-z-]+)":/g)].map(match=>match[1].toLowerCase());
    assert.ok(headers.includes('content-type'));
    assert.ok(headers.every(header=>allowed.includes(header)),`${route} must not trigger a denied CORS preflight`);
  }
});
