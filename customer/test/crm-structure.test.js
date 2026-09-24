const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const uiPath=path.join(root,'crm-ui.js');
const presentationPath=path.join(root,'crm-presentation.js');
const cssPath=path.join(root,'crm.css');
const supportLoader=fs.readFileSync(path.join(root,'shell-support-loader.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const ui=fs.existsSync(uiPath)?fs.readFileSync(uiPath,'utf8'):'';
const presentation=fs.existsSync(presentationPath)?fs.readFileSync(presentationPath,'utf8'):'';
const css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';

test('Master CRM is a persistent top-level workspace, not Step 8',()=>{
  assert.match(processMap,/crm-ui\.js\?v=[a-zA-Z0-9-]+/);
  assert.equal(fs.existsSync(uiPath),true);
  assert.match(ui,/id="open-crm"/);
  assert.match(ui,/id="crm-workspace"/);
  assert.doesNotMatch(ui,/data-step="8"/);
});

test('CRM detail loads the evidence renderer before displaying durable company and contact provenance',()=>{
  const renderer=processMap.indexOf('crm-presentation.js?v=');
  const uiImport=processMap.indexOf('crm-ui.js?v=');
  assert.doesNotMatch(processMap,/^import\s/m,'CRM dependencies must stay in the deferred loader');
  assert.ok(renderer>=0,'CRM evidence renderer must load');
  assert.ok(uiImport>=0,'CRM UI must load');
  assert.ok(renderer<uiImport,'CRM evidence renderer must load before the detail UI');
  assert.match(ui,/LeadIntelCrmPresentation\?\.intelligenceHtml/);
  assert.match(ui,/LeadIntelCrmPresentation\?\.contactsHtml/);
  const rendererLoad=supportLoader.indexOf("await import('./crm-presentation.js?v=");
  const uiLoad=supportLoader.indexOf("await import('./crm-ui.js?v=");
  assert.ok(rendererLoad>=0,'deferred loader must load the CRM evidence renderer');
  assert.ok(uiLoad>=0,'deferred loader must load the CRM UI');
  assert.ok(rendererLoad<uiLoad,'CRM UI must wait for the evidence renderer');
  assert.match(supportLoader,/20260924-crm-evidence-activity-v1/);
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

test('CRM contact detail renders email status, contact source, and phone fields',()=>{
  assert.match(presentation,/work_email/);
  assert.match(presentation,/email_status/);
  assert.match(presentation,/Contact source/);
  assert.match(presentation,/phone_number/);
  assert.match(ui,/LeadIntelCrmPresentation\?\.contactsHtml/);
});

test('CRM detail provides a retryable control for complete activity history',()=>{
  assert.match(ui,/data-crm-load-activity/);
  assert.match(ui,/Load older activity/);
  assert.match(ui,/getCrmActivities/);
  assert.match(ui,/activityCursor/);
  assert.match(css,/crm-load-activity/);
});

test('CRM company actions preserve lifecycle semantics and expose destructive delete only as a separate action',()=>{
  for(const value of ['add-pipeline','remove-pipeline','mark-customer','archive','suppress','restore','delete-permanently'])assert.match(ui,new RegExp(`data-crm-action="${value}"`));
  assert.match(ui,/confirm\(/);
  assert.match(ui,/removeCrmFromPipeline/);
  assert.match(ui,/deleteCrmCompany/);
});

test('CRM uses its own responsive stylesheet',()=>{
  assert.equal(fs.existsSync(cssPath),true);
  assert.match(ui,/VERSION='[a-zA-Z0-9-]+'/);
  assert.match(ui,/crm\.css\?v=\$\{VERSION\}/);
  assert.match(css,/\.crm-workspace/);
  assert.match(css,/@media/);
});
