const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const bridgeSource=fs.readFileSync(path.join(__dirname,'..','server-bridge.js'),'utf8');
const serverCss=fs.readFileSync(path.join(__dirname,'..','server.css'),'utf8');

function accountHarness(provider){
  const inserted=[];const nodes=new Map();
  const actions={insertAdjacentHTML(_where,value){
    inserted.push(value);
    for(const match of value.matchAll(/id="([^"]+)"/g)){
      nodes.set(match[1],{addEventListener(){},hidden:false,textContent:'',innerHTML:'',dataset:{},title:'',setAttribute(name,value){this[name]=value;}});
    }
  }};
  const document={
    readyState:'loading',addEventListener(){},
    querySelector(selector){return selector==='.top-actions'?actions:null;},
    getElementById(id){return nodes.get(id)||null;}
  };
  const localStorage={getItem(key){return key==='leadintel_auth_provider'?provider:null;},setItem(){},removeItem(){}};
  const window={};
  const source=bridgeSource.replace('})(window);','root.injectAccountUiForTest=injectAccountUi;root.renderAccountForTest=renderAccount;})(window);');
  vm.runInNewContext(source,{window,document,location:{href:'https://leadintel.ccgroup.lv/customer/',reload(){}},URL,localStorage,sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}},Storage:function(){},setTimeout,clearTimeout,fetch:async()=>new Response('{}'),CustomEvent:function(){}});
  return {window,nodes,inserted};
}

test('signed-in header identifies the Google account provider and email',()=>{
  const {window,nodes,inserted}=accountHarness('google');
  window.LeadIntelServerBridge.session={authenticated:true,user:{name:'Edgars Untals',email:'edgars@example.com'}};
  window.LeadIntelServerBridge.workspaces=[{id:'one',name:'Edgars workspace',role:'owner'}];
  window.LeadIntelServerBridge.workspace=window.LeadIntelServerBridge.workspaces[0];
  window.injectAccountUiForTest();
  window.renderAccountForTest();

  assert.match(inserted.join(''),/id="server-auth-provider"/);
  assert.equal(nodes.get('server-auth-provider').hidden,false);
  assert.equal(nodes.get('server-auth-provider').textContent,'Google · edgars@example.com');
  assert.equal(nodes.get('server-auth-provider').title,'Signed in with Google as edgars@example.com');
});

test('signed-in header identifies Microsoft without guessing an unknown provider',()=>{
  const microsoft=accountHarness('microsoft');
  microsoft.window.LeadIntelServerBridge.session={authenticated:true,user:{email:'edgars@company.com'}};
  microsoft.window.LeadIntelServerBridge.workspaces=[];
  microsoft.window.injectAccountUiForTest();
  microsoft.window.renderAccountForTest();
  assert.equal(microsoft.nodes.get('server-auth-provider').textContent,'Microsoft · edgars@company.com');

  const unknown=accountHarness('');
  unknown.window.LeadIntelServerBridge.session={authenticated:true,user:{email:'edgars@example.com'}};
  unknown.window.LeadIntelServerBridge.workspaces=[];
  unknown.window.injectAccountUiForTest();
  unknown.window.renderAccountForTest();
  assert.equal(unknown.nodes.get('server-auth-provider').hidden,true);
  assert.equal(unknown.nodes.get('server-auth-provider').textContent,'');
});

test('account provider badge is compact, readable, and mobile-safe',()=>{
  assert.match(serverCss,/\.server-auth-provider\{/);
  assert.match(serverCss,/white-space:nowrap/);
  assert.match(serverCss,/font:600 11px "DM Sans",sans-serif/);
  assert.match(serverCss,/@media\(max-width:900px\).*\.server-auth-provider/s);
});
