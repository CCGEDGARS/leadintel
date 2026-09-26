const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('target list exposes its saved rows and editing controls',()=>{
  const ui=read('reference-customer-ui.js');
  assert.match(ui,/Target Companies · \$\{items\.length\}/);
  assert.match(ui,/data-edit-target/);
  assert.match(ui,/function editTarget\(index\)/);
  assert.match(ui,/function cancelTargetEdit\(\)/);
  assert.match(ui,/writeState\(state\);renderTargets\(\)/);
});

test('main app saves retain target edits made by the company list modal',()=>{
  const app=read('app.js');
  const source=app.slice(app.indexOf('function saveState(){'),app.indexOf('\nfunction esc(',app.indexOf('function saveState(){')));
  const values=new Map([['leadintel_customer_v2_state',JSON.stringify({targetCompanies:[{companyName:'Nordic Paper',website:'https://www.nordic-paper.com/'}]})]]);
  const context={state:{step:2,targetCompanies:[]},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},STORAGE_KEY:'leadintel_customer_v2_state',updateCompleteness(){},updateNavigationAvailability(){},window:{LeadIntelJourney:{refresh(){}}}};
  vm.runInNewContext(source+';saveState();',context);
  assert.equal(JSON.parse(values.get(context.STORAGE_KEY)).targetCompanies[0].companyName,'Nordic Paper');
});
