const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');

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
  const window={};const source=mailSource.replace('})(window);','root.injectForTest=inject;})(window);');
  vm.runInNewContext(source,{window,document,localStorage:{getItem(){return null;}},setTimeout,clearTimeout});
  window.injectForTest();const html=inserted.join('');
  for(const id of ['connect-microsoft-mail','send-with-microsoft','production-microsoft-status','disconnect-microsoft-mail'])assert.match(html,new RegExp(`id="${id}"`));
});

test('approved Microsoft send uses the Microsoft bridge and confirms only provider-accepted requests',async()=>{
  let confirmed=0,sendPayload=null;
  const nodes={'delivery-company-select':{value:'example.com'},'delivery-recipient':{value:'buyer@example.com'},'send-with-microsoft':{},'confirm-delivery-sent':{click(){confirmed++;}},toast:{classList:{add(){},remove(){}},textContent:''}};
  const window={LeadIntelServerBridge:{microsoftMail:{connected:true},sendMicrosoftMail:async(payload)=>{sendPayload=payload;return {ok:true,duplicate:false,message:{status:'sent',provider:'microsoft',provider_status:'accepted'}};},saveNow:async()=>{}}};
  const source=mailSource.replace('})(window);','root.sendForTest=send;})(window);');
  vm.runInNewContext(source,{window,document:{readyState:'loading',addEventListener(){},getElementById:id=>nodes[id]||null},localStorage:{getItem(){return null;}},sessionStorage:{setItem(){}},LeadIntelOutreach:{normalizeOutreachState:()=>({items:[{domain:'example.com',approved:true,approvedAt:'2026-09-15',drafts:{emailSubject:'Tailored subject',emailBody:'Tailored body'}}]})},LeadIntelDelivery:{normalizeEmail:value=>value},confirm:()=>true,crypto:webcrypto,TextEncoder,setTimeout,clearTimeout});
  await window.sendForTest('microsoft');
  assert.ok(sendPayload,'Microsoft provider must receive the approved message');
  assert.equal(sendPayload.subject,'Tailored subject');assert.equal(sendPayload.body,'Tailored body');assert.equal(confirmed,1);assert.equal(nodes['send-with-microsoft'].disabled,false);
});
