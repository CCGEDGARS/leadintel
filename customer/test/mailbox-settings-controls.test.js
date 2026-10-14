const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,30));
async function mount({connected=false,role='owner',configured=true}={}){
 const w=new JSDOM('<div class="top-actions"></div><div id="toast"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 const calls=[];let gmail={configured,connected,email:connected?'mailbox@example.com':'',role},microsoft={...gmail};
 w.confirm=()=>true;w.eval(read('personal-linkedin.js'));w.eval(read('tool-account-links.js'));
 w.LeadIntelServerBridge={session:{authenticated:true,user:{email:'login@example.com'}},workspace:{id:'w1',role},gmail,microsoftMail:microsoft,connectGmail:()=>calls.push('gmail-connect'),connectMicrosoftMail:()=>calls.push('microsoft-connect'),disconnectGmail:async()=>{calls.push('gmail-disconnect');gmail={...gmail,connected:false,email:''};w.LeadIntelServerBridge.gmail=gmail;return {ok:true};},disconnectMicrosoftMail:async()=>{calls.push('microsoft-disconnect');w.LeadIntelServerBridge.microsoftMail={...microsoft,connected:false,email:''};return {ok:true};}};
 w.fetch=async input=>({ok:true,json:async()=>new URL(input).pathname.endsWith('/gmail/status')?gmail:{role,providers:[]}});
 w.eval(read('ai-settings.js').replace(/^import .*;\s*$/gm,''));w.document.getElementById('open-settings').click();await settle();return {w,calls};
}
test('mailbox cards expose connection buttons instead of account creation or provider links on reopen',async()=>{
 const {w,calls}=await mount();try{for(let i=0;i<2;i++){
  for(const id of ['gmail','microsoft-mail']){const card=w.document.querySelector(`[data-integration="${id}"]`);assert.equal(card.querySelector('a'),null);assert.doesNotMatch(card.textContent,/Create account|Open Gmail|Open Microsoft 365/);assert.match(card.textContent,/Connect/);}
  w.document.querySelector('[data-gmail-action="connect"]').click();w.document.querySelector('[data-microsoft-mail-action="connect"]').click();w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await settle();
 }assert.deepEqual(calls,['gmail-connect','microsoft-connect','gmail-connect','microsoft-connect']);}finally{w.close();}
});
test('connected cards show the mailbox email and owner disconnect works without signing out',async()=>{
 const {w,calls}=await mount({connected:true});try{
  for(const id of ['gmail','microsoft-mail'])assert.match(w.document.querySelector(`[data-integration="${id}"]`).textContent,/mailbox@example.com/);
  w.document.querySelector('[data-gmail-action="disconnect"]').click();await settle();assert.ok(w.document.querySelector('[data-gmail-action="connect"]'));
  w.document.querySelector('[data-microsoft-mail-action="disconnect"]').click();await settle();assert.ok(w.document.querySelector('[data-microsoft-mail-action="connect"]'));
  assert.deepEqual(calls,['gmail-disconnect','microsoft-disconnect']);assert.equal(w.LeadIntelServerBridge.session.authenticated,true);
 }finally{w.close();}
});
test('non-owner connected cards do not offer destructive disconnect',async()=>{
 const {w}=await mount({connected:true,role:'sales'});try{assert.equal(w.document.querySelector('[data-gmail-action="disconnect"]'),null);assert.equal(w.document.querySelector('[data-microsoft-mail-action="disconnect"]'),null);}finally{w.close();}
});
test('unavailable mailbox configuration keeps a visible disabled Connect action',async()=>{
 const {w}=await mount({configured:false});try{assert.equal(w.document.querySelector('[data-gmail-action="connect"]').disabled,true);assert.equal(w.document.querySelector('[data-microsoft-mail-action="connect"]').disabled,true);}finally{w.close();}
});

 test('Microsoft help opens without authentication redirects and closes back to its trigger',async()=>{
 const {w,calls}=await mount();try{
 for(const id of ['microsoft-account','microsoft-mail']){
 const trigger=w.document.querySelector(`[data-integration="${id}"] [data-microsoft-help]`);assert.ok(trigger,'Microsoft cards need connection help');trigger.focus();trigger.click();
 const dialog=w.document.getElementById('microsoft-connection-help');assert.equal(dialog.hidden,false);assert.match(dialog.textContent,/AADSTS700016/);assert.match(dialog.textContent,/LeadIntel support/);assert.match(dialog.textContent,/IT administrator/);assert.match(dialog.textContent,/do not need to create an app registration/);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(dialog.hidden,true);assert.equal(w.document.getElementById('ai-settings-drawer').hidden,false);assert.equal(w.document.activeElement,trigger);
 }assert.deepEqual(calls,[]);
 }finally{w.close();}
 });
