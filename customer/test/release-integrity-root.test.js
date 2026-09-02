const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const repoRoot=path.join(__dirname,'..','..');
const config=JSON.parse(fs.readFileSync(path.join(repoRoot,'release-integrity.config.json'),'utf8'));
const rootHtml=fs.readFileSync(path.join(repoRoot,'index.html'),'utf8');

function smoke(id){return config.smokeChecks.find(item=>item.id===id);}

test('release integrity validates the production root chooser instead of the retired forced redirect',()=>{
  const entry=smoke('production-entry');
  assert.ok(entry,'production-entry smoke check must exist');
  assert.equal(entry.url,'/');
  assert.equal(entry.status,200);
  assert.ok(entry.contains.includes('Commercial Intelligence'),'root proof must require the active workspace choice');
  assert.ok(entry.contains.includes('Contact Intelligence'),'root proof must require the legacy workspace choice');
  assert.ok(entry.contains.includes('href="customer/"'),'root proof must require the customer workspace link');
  assert.ok(entry.contains.includes('href="LeadIntel.html"'),'root proof must require the legacy workspace link');
  assert.ok(entry.notContains.includes("location.replace('/customer/')"),'root proof must reject the retired forced customer redirect');
  assert.ok(entry.notContains.includes("location.replace('/v2/')"),'root proof must continue rejecting the retired v2 redirect');
  for(const marker of entry.contains)assert.match(rootHtml,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of entry.notContains)assert.doesNotMatch(rootHtml,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
