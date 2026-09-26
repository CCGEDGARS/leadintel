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
  assert.match(ui,/Research saved target companies/);
  assert.match(ui,/targetCount&&\(!saved\|\|activeModels\)/);
  assert.match(ui,/Build the Opportunity Map in View Results before activating/);
  assert.match(ui,/Review and select the suggested customer profile before activation/);
  assert.match(ui,/source:'target-companies'/);
  assert.match(ui,/Customer model active\. It now informs Company Discovery/);
  assert.match(ui,/Customer model deactivated\. The saved list remains available/);
});

test('target research handoff identifies Step 4 and the next search action',()=>{
  const targets=read('reference-customer-ui.js');
  const discovery=read('discovery-ui.js');
  assert.match(targets,/Go to Step 4 · Research targets/);
  assert.match(targets,/source:'target-companies'/);
  assert.match(discovery,/event\.detail\?\.source==='target-companies'/);
  assert.match(discovery,/You are now in Step 4 · Companies/);
  assert.match(discovery,/Results will be provisional until you finish those steps/);
});
