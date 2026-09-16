const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const marketSource=fs.readFileSync(path.join(root,'market-engine.js'),'utf8');
const LeadIntelMarket=require('../market-engine.js');

function runMarketResearchBlock(){
  return app.match(/async function runMarketResearch\([^)]*\)\{[\s\S]*?\n\}\nfunction scoreCell/)?.[0]||'';
}

test('Market Strategy uses authenticated OpenAI Web Search and keeps Firecrawl verification',()=>{
  assert.match(app,/\/api\/ai\/web-search/);
  assert.match(app,/credentials:\s*["']include["']/);
  assert.match(app,/workspace_id=/);
  assert.match(app,/\/firecrawl-search/);
  assert.match(app,/async function searchOpenAiWeb\(/);
});

test('OpenAI search waits for an actual server bridge instead of treating undefined as ready',()=>{
  assert.match(app,/if\(window\.LeadIntelServerBridge&&window\.LeadIntelServerBridge\.session!==null\)return window\.LeadIntelServerBridge/);
});

test('Market Research signs into the workspace before starting a degraded run and preserves the selected mode for resume',()=>{
  const block=runMarketResearchBlock();
  assert.match(app,/MARKET_RESEARCH_RESUME_KEY/);
  assert.match(app,/async function ensureMarketResearchWorkspace\(/);
  assert.match(app,/sessionStorage\.setItem\(MARKET_RESEARCH_RESUME_KEY/);
  assert.match(app,/bridge\?\.signIn\?\.\(\)/);
  assert.match(block,/await ensureMarketResearchWorkspace\(state\.market\.researchMode\)/);
  assert.ok(block.indexOf('await ensureMarketResearchWorkspace(state.market.researchMode)')<block.indexOf('researchStatus="running"'),'authentication must be checked before the research run is marked running');
});

test('pending Market Research resumes only after an authenticated workspace is ready',()=>{
  assert.match(app,/function resumePendingMarketResearchAfterAuth\(/);
  assert.match(app,/sessionStorage\.getItem\(MARKET_RESEARCH_RESUME_KEY\)/);
  assert.match(app,/bridge\?\.session\?\.authenticated/);
  assert.match(app,/bridge\?\.workspace\?\.id/);
  assert.match(app,/sessionStorage\.removeItem\(MARKET_RESEARCH_RESUME_KEY\)/);
  assert.match(app,/runMarketResearch\(mode\)/);
  assert.match(app,/leadintel:server-ready/);
});

test('each market query attempts OpenAI discovery and Firecrawl verification without invoking Apollo',()=>{
  const block=runMarketResearchBlock();
  assert.match(block,/searchOpenAiWeb\(query/);
  assert.match(block,/searchMarket\(query/);
  assert.match(block,/mergeResearchResults/);
  assert.doesNotMatch(block,/apollo|mixed_people|people\/search|crm-contact\/enrich/i);
});

test('OpenAI unavailability is isolated so Firecrawl can continue',()=>{
  assert.match(app,/openAiAvailable/);
  assert.match(app,/OpenAI integration is required for web search/);
  assert.match(app,/searchMarket\(query/);
  assert.match(app,/firecrawl/i);
});

test('research results deduplicate canonical URLs and preserve source provenance',()=>{
  assert.equal(typeof LeadIntelMarket.mergeResearchResults,'function');
  const merged=LeadIntelMarket.mergeResearchResults(
    [{url:'https://example.com/news/office-move/',title:'OpenAI title',description:'OpenAI evidence',market:'Latvia',queryId:'q1',sourceProviders:['openai']}],
    [{url:'https://EXAMPLE.com/news/office-move#section',title:'Firecrawl title',description:'Deeper verification',text:'Verified page body',market:'Latvia',queryId:'q1',sourceProviders:['firecrawl']}],
    [{url:'javascript:alert(1)',title:'Unsafe',sourceProviders:['openai']}]
  );
  assert.equal(merged.length,1);
  assert.equal(merged[0].url,'https://example.com/news/office-move');
  assert.deepEqual(merged[0].sourceProviders,['openai','firecrawl']);
  assert.equal(merged[0].text,'Verified page body');
});

test('normalized saved market state preserves source provenance and source-status fields',()=>{
  assert.match(marketSource,/researchSourceStatus/);
  const state=LeadIntelMarket.normalizeMarketState({
    researchSourceStatus:{openai:'complete',firecrawl:'complete'},
    researchResults:[{url:'https://example.com/a',market:'Latvia',sourceProviders:['openai','firecrawl']}]
  });
  assert.deepEqual(state.researchSourceStatus,{openai:'complete',firecrawl:'complete',gemini:'idle'});
  assert.deepEqual(state.researchResults[0].sourceProviders,['openai','firecrawl']);
});

test('research status copy distinguishes OpenAI discovery from Firecrawl extraction',()=>{
  assert.match(app,/OpenAI[^\n]{0,120}(discovery|signal)/i);
  assert.match(app,/Firecrawl[^\n]{0,120}extract/i);
});
