const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const H=require('../message-draft-history.js');

test('the first Messages recipient can create an item when draft history has no previous item',()=>{
 const dom=new JSDOM('<div id="mw-header-actions"><button id="mw-version-history">Version history</button></div>',{url:'https://app.test/customer/'});
 try{
  const scope={workspaceId:'w1',userId:'u1',domain:'buyer.example',personId:'robert',channel:'email',language:'en'};
  const controller=H.mount(dom.window.document,{scope:()=>scope,read:()=>({subject:'',message:''}),usable:()=>true,ready:()=>true});
  const first={domain:scope.domain,selectedPersonId:scope.personId,channel:'email',drafts:{},messageStudioDraft:{status:'Ready to generate. No message has been created yet.'}};
  assert.equal(H.itemSnapshot(null),null);
  assert.equal(controller.beforeChange(null,first),true);
  assert.equal(dom.window.localStorage.length,0,'no previous draft is fabricated or journaled');
 }finally{dom.window.close();}
});
