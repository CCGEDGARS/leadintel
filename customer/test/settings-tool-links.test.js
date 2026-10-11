const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
async function mounted(){
 const w=new JSDOM('<div class="top-actions"></div><div id="toast"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 w.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'w1',role:'owner'}};
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
 for(const id of ['openai','anthropic','gemini','apollo','firecrawl','hunter','google','microsoft-account','gmail','microsoft-mail','calendly','personal-linkedin','zoom']){
  const links=[...w.document.querySelectorAll(`[data-tool-links="${id}"] a`)];assert.ok(links.length>=2,`${id} account and setup links missing`);
  for(const link of links){assert.equal(new URL(link.href).protocol,'https:');assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);assert.match(link.rel,/noreferrer/);assert.match(link.getAttribute('aria-label'),/opens in a new tab/);}
 }
 assert.ok(w.document.querySelector('[data-tool-links="openai"] a[href="https://platform.openai.com/settings/organization/billing/overview"]'));
 assert.match(w.document.querySelector('[data-tool-links="calendly"]').textContent,/Get access token/);
 };check();w.dispatchEvent(new w.CustomEvent('leadintel:microsoft-mail-status'));await new Promise(r=>setTimeout(r,25));check();
 w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await new Promise(r=>setTimeout(r,25));check();
 }finally{w.close();}
});
test('meeting setup shortcuts follow the selected conferencing platform',async()=>{
 const w=await mounted();try{for(const [value,id] of [['teams','teams'],['google_meet','google_meet'],['zoom','zoom']]){const select=w.document.getElementById('meeting-platform');select.value=value;select.dispatchEvent(new w.Event('change',{bubbles:true}));assert.ok(w.document.querySelector(`#meeting-platform-links [data-tool-links="${id}"]`));}assert.ok(w.document.querySelector('#meeting-platform-note'));}finally{w.close();}
});
