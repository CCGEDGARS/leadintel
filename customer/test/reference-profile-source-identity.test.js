const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('suggested customer profile identifies analyzed companies and their websites',()=>{
  const ui=read('reference-customer-ui.js');
  assert.match(ui,/id="reference-profile-sources"/);
  assert.match(ui,/reference\.rows\.filter\(row=>reference\.analyses\?\.\[row\.id\]\)/);
  assert.match(ui,/esc\(row\.companyName\)/);
  assert.match(ui,/esc\(row\.domain\|\|row\.website\)/);
  assert.match(ui,/rel="noopener noreferrer"/);
  assert.match(ui,/if\(sources\)sources\.innerHTML=''/);
});
