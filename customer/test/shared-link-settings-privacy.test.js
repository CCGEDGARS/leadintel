const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,40));
async function mounted({authenticated=false,calendly={},storage={}}={}){
 const w=new JSDOM(read('index.html'),{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 const observers=[],NativeObserver=w.MutationObserver,close=w.close.bind(w);
 w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this);}};
 w.close=()=>{for(const observer of observers)observer.disconnect();close();};
 const requests=[];
 for(const [key,value] of Object.entries(storage))w.localStorage.setItem(key,value);
 w.eval(read('brand-identity.js'));w.eval(read('personal-linkedin.js'));w.eval(read('tool-account-links.js'));
 const main=JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state')||'{}');
 w.LeadIntelSenderIdentity={get:()=>w.LeadIntelBrandIdentity.normalize(main.brandIdentity||{})};
 w.LeadIntelServerBridge={session:{authenticated},workspace:authenticated?{id:'new-workspace',role:'owner'}:null};
 w.fetch=async input=>{const url=new URL(input);requests.push(url.pathname);let payload={role:'owner',providers:[]};
  if(url.pathname.endsWith('/calendly/status'))payload={role:'owner',configured:false,connected:false,scheduling_url:'',...calendly};
  return {ok:true,json:async()=>payload};};
 w.eval(read('ai-settings.js').replace(/^import .*;\s*$/gm,''));
 w.eval('(function(){'+read('service-settings-extension.js').replace(/^import .*;\s*$/gm,'').replace(/^export .*;\s*$/gm,'')+'})()');
 w.document.getElementById('open-settings').click();await settle();return {w,requests};
}
function assertEmptyPersonalFields(w){
 for(const input of w.document.querySelectorAll('[data-ai-key],[data-service-key],[data-calendly-token],[data-calendly-url],#personal-linkedin-url,[data-brand-field]:not([data-brand-field="primaryColor"])'))assert.equal(input.value,'',input.id||input.outerHTML);
 assert.doesNotMatch(w.document.getElementById('ai-settings-drawer').textContent,/Edgars|Untāls|edgars-7go|ccgroup\.lv|ercon\.lv/);
 assert.doesNotMatch(w.document.getElementById('sender-identity-staging').innerHTML,/Edgars|Untāls|edgars-7go/);
 const identity=w.LeadIntelSenderIdentity.get();
 for(const key of ['companyDisplayName','senderName','senderTitle','website','phone','email','linkedinUrl','signatureText','legalFooter','postalAddress'])assert.equal(identity[key],'',key);
 assert.deepEqual(Object.values(identity.assets),[null,null,null]);
}
test('a shared public link exposes empty personal settings without requesting workspace data',async()=>{
 const {w,requests}=await mounted();try{assertEmptyPersonalFields(w);assert.deepEqual(requests,[]);
  w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await settle();assertEmptyPersonalFields(w);
 }finally{w.close();}
});
test('a newly authenticated empty workspace stays empty on refresh and reopen',async()=>{
 const {w}=await mounted({authenticated:true});try{assertEmptyPersonalFields(w);w.dispatchEvent(new w.CustomEvent('leadintel:server-ready'));await settle();assertEmptyPersonalFields(w);
  w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await settle();assertEmptyPersonalFields(w);
 }finally{w.close();}
});
test('saved booking details remain specific to their owner and absent from a separate visitor',async()=>{
 const own='https://calendly.com/own-business/consultation';const {w}=await mounted({authenticated:true,calendly:{configured:true,connected:true,scheduling_url:own,token_hint:'••••abcd'}});
 try{assert.equal(w.document.querySelector('[data-calendly-url]').value,own);assert.equal(w.document.querySelector('[data-calendly-token]').value,'');
  const visitor=await mounted();try{assertEmptyPersonalFields(visitor.w);assert.doesNotMatch(visitor.w.document.body.innerHTML,/own-business|abcd/);}finally{visitor.w.close();}
  w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await settle();assert.equal(w.document.querySelector('[data-calendly-url]').value,own);
 }finally{w.close();}
});
test('public settings and outreach assets contain no personal booking default',()=>{
 for(const name of ['index.html','service-settings-extension.js','outreach-engine.js'])assert.doesNotMatch(read(name),/edgars-7go|Edgars Untāls/);
});
test('generated outreach and save/reload use only the supplied business booking link',()=>{
 const outreach=require('../outreach-engine.js');const profile={companyName:'Sample Consulting',priorityOffers:'Coaching'};
 const empty=outreach.buildOutreachDrafts({}, {},profile);assert.doesNotMatch(JSON.stringify(empty),/calendly\.com|edgars-7go|Edgars|Untāls/);
 for(const language of ['en','lv']){
  const link='https://calendly.com/sample-business/consultation';const drafts=outreach.buildOutreachDrafts({}, {},{...profile,calendlyUrl:link},'consultative',language);
  assert.ok(drafts.emailBody.includes(link));assert.ok(drafts.followUp.includes(link));
  const saved=outreach.normalizeOutreachState(JSON.parse(JSON.stringify({items:[{domain:'buyer.example',drafts}]})));
  assert.ok(saved.items[0].drafts.emailBody.includes(link));assert.doesNotMatch(JSON.stringify(saved),/edgars-7go/);
 }
});
