const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('market research translates generated content into the selected language before final display',()=>{
  assert.match(source,/await localizeMarketGeneratedContent\(\{render:false\}\)/);
  assert.match(source,/LeadIntelContentLanguage\.translateMarketState/);
  assert.match(source,/opp\.marketLabel\|\|opp\.market/);
  assert.match(source,/source\.displayTitle\|\|source\.title/);
  assert.match(source,/source\.displayDescription\|\|source\.description/);
});

test('changing the language triggers asynchronous market-content translation',()=>{
  assert.match(source,/leadintel:language-changed[\s\S]{0,500}localizeMarketGeneratedContent/);
});
