const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('market research and generated intelligence stay in English without translation attempts',()=>{
  assert.match(source,/workspaceContentLanguage/);
  assert.doesNotMatch(source,/localizeMarketGeneratedContent|translateMarketState|leadintel:language-changed/);
  assert.match(source,/opp\.marketLabel\|\|opp\.market/);
  assert.match(source,/source\.displayTitle\|\|source\.title/);
  assert.match(source,/source\.displayDescription\|\|source\.description/);
});
