const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const bridgeSource=fs.readFileSync(path.join(__dirname,'..','server-bridge.js'),'utf8');
const mailSource=fs.readFileSync(path.join(__dirname,'..','production-gmail-ui.js'),'utf8');

test('account UI exposes a Microsoft sign-in action that starts Microsoft OAuth',()=>{
  const html=[];const nodes=new Map();
  const actions={insertAdjacentHTML(_where,value){html.push(value);for(const id of value.matchAll(/id="([^"]+)"/g))nodes.set(id[1],{addEventListener(){},hidden:false});}};
  const document={readyState:'loading',addEventListener(){},querySelector(selector){return selector==='.top-actions'?actions:null;},getElementById(id){return nodes.get(id)||null;}};
  const location={href:'https://leadintel.ccgroup.lv/customer/'};const window={};
  const source=bridgeSource.replace('})(window);','root.injectAccountUiForTest=injectAccountUi;root.signInForTest=signIn;})(window);');
  vm.runInNewContext(source,{window,document,location,URL,localStorage:{getItem(){return null;}},sessionStorage:{},Storage:function(){},setTimeout,clearTimeout,fetch:async()=>new Response('{}')});
  window.injectAccountUiForTest();
  assert.match(html.join(''),/id="server-microsoft-signin"/);
  window.signInForTest('microsoft');
  assert.match(location.href,/\/api\/auth\/microsoft\/start/);
});

test('delivery connector renders Microsoft connect, send, status, and disconnect controls',()=>{
  const inserted=[];const nodes=new Map();const card={insertAdjacentHTML(_where,value){inserted.push(value);for(const id of value.matchAll(/id="([^"]+)"/g))nodes.set(id[1],{addEventListener(){}});}};
  const document={readyState:'loading',addEventListener(){},querySelector(selector){if(selector==='#step-7 .connector-card')return card;return null;},getElementById(id){return nodes.get(id)||null;}};
  const window={};const source=mailSource.replace(/\}\)\(typeof window!==['"]undefined['"]\?window:globalThis\);\s*$/,'root.injectForTest=inject;})(typeof window!==\'undefined\'?window:globalThis);');
  vm.runInNewContext(source,{window,document,localStorage:{getItem(){return null;}},setTimeout,clearTimeout});
  window.injectForTest();const html=inserted.join('');
  for(const id of ['connect-microsoft-mail','send-with-microsoft','production-microsoft-status','disconnect-microsoft-mail'])assert.match(html,new RegExp(`id="${id}"`));
});

test('approved Microsoft send uses the Microsoft bridge and confirms only provider-accepted requests',async()=>{
  const {mailRuntime,providerReceipt}=require('./helpers/production-mail-runtime.js');
  for(const providerStatus of ['accepted','unknown']){
    const h=mailRuntime('microsoft',providerReceipt('microsoft','sent',{provider_status:providerStatus}));
    try{
      const result=await h.send();
      assert.equal(h.calls.length,1,'Microsoft receives the current approved message');
      const {provider,payload}=h.calls[0];assert.equal(provider,'microsoft');
      assert.equal(payload.subject,h.pkg.drafts.emailSubject);assert.equal(payload.body,h.pkg.drafts.emailBody);
      assert.equal(payload.recipientSnapshot.name,'Alex Buyer');assert.equal(payload.recipientSnapshot.email,'alex@buyer.example');
      assert.equal(payload.recipientSnapshot.companyDomain,'buyer.example');
      assert.equal(result.providerConfirmed===true,providerStatus==='accepted');
      assert.equal(h.records,providerStatus==='accepted'?1:0);
      assert.equal(h.q('send-with-microsoft').disabled,false);
    }finally{h.w.close();}
  }
});
