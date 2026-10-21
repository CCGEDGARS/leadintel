const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
async function mounted(provider="",authenticated=true){
 const w=new JSDOM('<div class="top-actions"></div><div id="toast"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 const observers=[];const Observer=w.MutationObserver;w.MutationObserver=class extends Observer{constructor(callback){super(callback);observers.push(this);}};w.disposeObservers=()=>observers.forEach(observer=>observer.disconnect());
 w.LeadIntelServerBridge={session:{authenticated,user:{email:"user@example.com"}},authProvider:provider,workspace:{id:'w1',role:'owner'}};
 let identity={meetingPlatform:'zoom'};w.LeadIntelSenderIdentity={get:()=>identity,setMeetingPlatform:meetingPlatform=>{identity={meetingPlatform};}};
 w.fetch=async url=>({ok:true,json:async()=>String(url).includes('/ai/status')?{role:'owner',providers:[]}:{role:'owner',providers:[{provider:'apollo'},{provider:'firecrawl'},{provider:'hunter'}]}});
 w.eval(read('personal-linkedin.js'));
 if(fs.existsSync(path.join(__dirname,'..','tool-account-links.js')))w.eval(read('tool-account-links.js'));
 w.eval(read('ai-settings.js').replace(/^import .*;\s*$/gm,''));
 w.eval('(function(){'+read('service-settings-extension.js').replace(/^import .*;\s*$/gm,'').replace(/^export .*;\s*$/gm,'')+'})()');
 w.document.getElementById('open-settings').click();await new Promise(r=>setTimeout(r,25));return w;
}
test('settings provides safe provider-specific setup links through refresh, close and reopen',async()=>{
 const w=await mounted();try{
 const check=()=>{
 for(const id of ['apollo','hunter'])assert.equal(w.document.querySelector(`[data-integration="${id}"], [data-service-provider="${id}"], [data-tool-links="${id}"]`),null,`${id} paid settings must be absent`);
 assert.doesNotMatch(w.document.getElementById('ai-settings-drawer').textContent,/Apollo|Hunter/);
 for(const id of ['openai','anthropic','gemini','firecrawl','calendly','personal-linkedin','zoom']){
  const links=[...w.document.querySelectorAll(`[data-tool-links="${id}"] a`)];assert.ok(links.length>=2,`${id} account and setup links missing`);
  for(const link of links){assert.equal(new URL(link.href).protocol,'https:');assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);assert.match(link.rel,/noreferrer/);assert.match(link.getAttribute('aria-label'),/opens in a new tab/);}
 }
 for(const id of ['gmail','microsoft-mail'])assert.equal(w.document.querySelector(`[data-integration="${id}"] a`),null);
 assert.ok(w.document.querySelector('[data-tool-links="openai"] a[href="https://platform.openai.com/settings/organization/billing/overview"]'));
 assert.match(w.document.querySelector('[data-tool-links="calendly"]').textContent,/Get access token/);
 };check();w.dispatchEvent(new w.CustomEvent('leadintel:microsoft-mail-status'));await new Promise(r=>setTimeout(r,25));check();
 w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await new Promise(r=>setTimeout(r,25));check();
 }finally{w.disposeObservers();w.close();}
});
test('meeting setup shortcuts follow the selected conferencing platform',async()=>{
 const w=await mounted();try{for(const [value,id] of [['teams','teams'],['google_meet','google_meet'],['zoom','zoom']]){const select=w.document.getElementById('meeting-platform');select.value=value;select.dispatchEvent(new w.Event('change',{bubbles:true}));assert.ok(w.document.querySelector(`#meeting-platform-links [data-tool-links="${id}"]`));}assert.ok(w.document.querySelector('#meeting-platform-note'));}finally{w.disposeObservers();w.close();}
});

test('Active tools follows System health, followed by communication and aligned account actions',async()=>{
 const w=await mounted();try{
  const health=w.document.getElementById('integration-health-summary');
  assert.equal(health.nextElementSibling.id,'ai-engine-summary');
  assert.equal(health.nextElementSibling.nextElementSibling.getAttribute('aria-labelledby'),'communication-integration-heading');
  for(const id of ['google','microsoft-account']){
   const card=w.document.querySelector(`[data-integration="${id}"]`);
   assert.equal(card.children.length,4);
   assert.equal(card.children[3].className,'workspace-provider-actions');
  }
  assert.match(read('ai-settings.css'),/@media\(min-width:681px\)/);
  assert.match(read('ai-settings.css'),/#integration-communication-grid>\.workspace-provider-card\{grid-row:span 5;grid-template-rows:subgrid\}/);
 }finally{w.disposeObservers();w.close();}
});

test('signed-in workspace cards keep authentication controls inside LeadIntel on reopen',async()=>{
 for(const provider of ['google','microsoft','']){const w=await mounted(provider);try{
  const check=()=>{
   for(const id of ['google','microsoft-account']){const card=w.document.querySelector(`[data-integration="${id}"]`);assert.equal(card.querySelector('a'),null);assert.ok(card.querySelector('[data-settings-signout], [data-settings-switch]'));assert.doesNotMatch(card.textContent,/Create account|Manage account|Session active/);}
   if(provider){const active=w.document.querySelector(`[data-integration="${provider==='google'?'google':'microsoft-account'}"]`);assert.match(active.textContent,/Selected/);assert.match(active.textContent,/user@example.com/);assert.ok(active.querySelector('[data-settings-signout]'));}
  };check();w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await new Promise(r=>setTimeout(r,25));check();
 }finally{w.disposeObservers();w.close();}}
});
test('signed-out workspace cards offer app login and explicitly named new-account links',async()=>{
 const w=await mounted('',false);try{for(const [id,name] of [['google','Google'],['microsoft-account','Microsoft']]){const card=w.document.querySelector(`[data-integration="${id}"]`);assert.ok(card.querySelector('[data-settings-signin]'));assert.match(card.querySelector('nav').textContent,new RegExp(`Create ${name} account`));assert.doesNotMatch(card.textContent,/Manage account/);}}finally{w.disposeObservers();w.close();}
});
