const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('market research completes before non-critical generated-content translation',()=>{
  assert.doesNotMatch(source,/await LeadIntelMarket\.withTimeout\([^\n]*localizeMarketGeneratedContent/);
  assert.match(source,/if\(state\.market\.opportunities\.length\)void localizeMarketGeneratedContent\(\{render:true\}\)/);
  assert.match(source,/LeadIntelContentLanguage\.translateMarketState/);
  assert.match(source,/opp\.marketLabel\|\|opp\.market/);
  assert.match(source,/source\.displayTitle\|\|source\.title/);
  assert.match(source,/source\.displayDescription\|\|source\.description/);
});

test('changing the language triggers asynchronous market-content translation',()=>{
  assert.match(source,/leadintel:language-changed[\s\S]{0,500}localizeMarketGeneratedContent/);
});
