const test=require('node:test'),assert=require('node:assert/strict');
const H=require('../message-draft-history.js');
test('history treats absent and empty recipient drafts as valid empty states',()=>{
 for(const value of [null,undefined,{},'']){assert.equal(H.snapshot(value),null);assert.doesNotThrow(()=>H.fingerprint(value));}
});
test('switching from an existing message to another buyer empty draft keeps the old history without a mount crash',()=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<div id="mw-header-actions"></div><details><summary>Tools</summary><button id="mw-version-history">History</button></details>',{url:'https://app.test/customer/'});
 try{
  const scope={workspaceId:'w1',userId:'u1',domain:'buyer.example',personId:'p1',channel:'email',language:'en'},before={domain:scope.domain,selectedPersonId:'p1',channel:'email',drafts:{emailSubject:'Reviewed subject',emailBody:'Existing buyer message'}},next={...before,selectedPersonId:'p2',drafts:{}};
  const controller=H.mount(dom.window.document,{scope:()=>scope,usable:()=>true,ready:()=>true,read:()=>H.itemSnapshot(before)});
  assert.equal(controller.beforeChange(before,next),true);
  assert.equal(H.createJournal(dom.window.localStorage).list(scope)[0].message,before.drafts.emailBody);
  assert.ok(dom.window.document.getElementById('mw-draft-recovery'),'recovery notice remains attached beside the visible editor');
 }finally{dom.window.close();}
});
