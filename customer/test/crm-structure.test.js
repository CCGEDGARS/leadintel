const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const uiPath=path.join(root,'crm-ui.js');
const cssPath=path.join(root,'crm.css');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const ui=fs.existsSync(uiPath)?fs.readFileSync(uiPath,'utf8'):'';
const css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';

test('Master CRM is a persistent top-level workspace, not Step 8',()=>{
  assert.match(processMap,/crm-ui\.js\?v=20260828-master-crm-v1/);
  assert.equal(fs.existsSync(uiPath),true);
  assert.match(ui,/id="open-crm"/);
  assert.match(ui,/id="crm-workspace"/);
  assert.doesNotMatch(ui,/data-step="8"/);
});

test('CRM workspace includes search, lifecycle views, pipeline view and company detail',()=>{
  assert.match(ui,/id="crm-search"/);
  for(const value of ['all','pipeline','customer','archived','suppressed'])assert.match(ui,new RegExp(`data-crm-view="${value}"`));
  assert.match(ui,/id="crm-company-list"/);
  assert.match(ui,/id="crm-company-detail"/);
  assert.match(ui,/Contacts/);
  assert.match(ui,/Activity/);
  assert.match(ui,/Intelligence/);
});

test('CRM contact detail renders durable verified email and phone fields',()=>{
  assert.match(ui,/work_email/);
  assert.match(ui,/phone_number/);
  assert.match(ui,/Verified phone|No verified phone/i);
});

test('CRM company actions preserve lifecycle semantics and expose destructive delete only as a separate action',()=>{
  for(const value of ['add-pipeline','remove-pipeline','mark-customer','archive','suppress','restore','delete-permanently'])assert.match(ui,new RegExp(`data-crm-action="${value}"`));
  assert.match(ui,/confirm\(/);
  assert.match(ui,/removeCrmFromPipeline/);
  assert.match(ui,/deleteCrmCompany/);
});

test('CRM uses its own responsive stylesheet',()=>{
  assert.equal(fs.existsSync(cssPath),true);
  assert.match(ui,/VERSION='20260828-master-crm-v1'/);
  assert.match(ui,/crm\.css\?v=\$\{VERSION\}/);
  assert.match(css,/\.crm-workspace/);
  assert.match(css,/@media/);
});
