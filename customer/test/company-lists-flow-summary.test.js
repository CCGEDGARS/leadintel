const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('customer lists explain what is active, mapped, and saved for research',()=>{
  const ui=read('reference-customer-library-ui.js');
  assert.match(ui,/aria-label="What LeadIntel will use"/);
  assert.match(ui,/activeCustomers\.join/);
  assert.match(ui,/map\.analysisAt===reference\.analyzedAt|opportunityMap\.analysisAt===reference\.analyzedAt/);
  assert.match(ui,/Target Companies<\/strong>/);
  assert.match(ui,/targetCount\} saved/);
  assert.match(ui,/Review targets in Company Discovery/);
  assert.match(ui,/Customer model active\. It now informs Company Discovery/);
  assert.match(ui,/Customer model deactivated\. The saved list remains available/);
});
