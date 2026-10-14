const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,30));
async function mount({connected=false,role='owner',configured=true,authenticated=true}={}){
 const w=new JSDOM('<div class="top-actions"></div><div id="toast"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 const calls=[];let gmail={configured,connected,email:connected?'mailbox@example.com':'',role},microsoft={...gmail};
 w.confirm=()=>true;w.eval(read('personal-linkedin.js'));w.eval(read('tool-account-links.js'));
 w.LeadIntelServerBridge={session:{authenticated,user:{email:'login@example.com'}},workspace:{id:'w1',role},gmail,microsoftMail:microsoft,signIn:provider=>calls.push('signin-'+provider),switchProvider:provider=>calls.push('switch-'+provider),connectGmail:()=>calls.push('gmail-connect'),connectMicrosoftMail:()=>calls.push('microsoft-connect'),disconnectGmail:async()=>{calls.push('gmail-disconnect');gmail={...gmail,connected:false,email:''};w.LeadIntelServerBridge.gmail=gmail;return {ok:true};},disconnectMicrosoftMail:async()=>{calls.push('microsoft-disconnect');w.LeadIntelServerBridge.microsoftMail={...microsoft,connected:false,email:''};return {ok:true};}};
 w.fetch=async input=>({ok:true,json:async()=>new URL(input).pathname.endsWith('/gmail/status')?gmail:{role,providers:[]}});
 w.eval(read('ai-settings.js').replace(/^import .*;\s*$/gm,''));w.document.getElementById('open-settings').click();await settle();return {w,calls};
}
test('mailbox cards expose connection buttons instead of account creation or provider links on reopen',async()=>{
 const {w,calls}=await mount();try{for(let i=0;i<2;i++){
  for(const id of ['gmail','microsoft-mail']){const card=w.document.querySelector(`[data-integration="${id}"]`);assert.equal(card.querySelector('a'),null);assert.doesNotMatch(card.textContent,/Create account|Open Gmail|Open Microsoft 365/);assert.match(card.textContent,/Connect/);}
  w.document.querySelector('[data-gmail-action="connect"]').click();w.document.querySelector('[data-microsoft-mail-action="connect"]').click();assert.equal(calls.at(-1),'gmail-connect');w.document.querySelector('[data-continue-microsoft]').click();w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await settle();
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

test('one Microsoft action opens guidance before continuing, with collapsed troubleshooting and safe cancel',async()=>{
 const {w,calls}=await mount();try{
 const card=w.document.querySelector('[data-integration="microsoft-account"]');assert.equal(card.querySelector('[data-microsoft-help]'),null);const trigger=card.querySelector('[data-settings-switch="microsoft"]');assert.ok(trigger);trigger.focus();trigger.click();
 const dialog=w.document.getElementById('microsoft-connection-help');assert.equal(dialog.hidden,false);assert.equal(dialog.querySelector('details').open,false);assert.match(dialog.textContent,/AADSTS700016/);assert.match(dialog.textContent,/LeadIntel support/);assert.deepEqual(calls,[]);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(dialog.hidden,true);assert.equal(w.document.getElementById('ai-settings-drawer').hidden,false);assert.equal(w.document.activeElement,trigger);
 const mail=w.document.querySelector('[data-microsoft-mail-action="connect"]');mail.click();assert.deepEqual(calls,[]);dialog.querySelector('[data-continue-microsoft]').click();assert.deepEqual(calls,['microsoft-connect']);assert.equal(dialog.hidden,true);
 }finally{w.close();}
});

test('signed-out Microsoft sign-in waits for explicit popup confirmation',async()=>{
 const {w,calls}=await mount({authenticated:false});try{
 const card=w.document.querySelector('[data-integration="microsoft-account"]');assert.equal(card.querySelectorAll('button').length,1);assert.match(card.textContent,/Sign in with Microsoft/);card.querySelector('[data-settings-signin]').click();assert.deepEqual(calls,[]);
 const dialog=w.document.getElementById('microsoft-connection-help');dialog.querySelector('[data-continue-microsoft]').click();assert.deepEqual(calls,['signin-microsoft']);assert.equal(dialog.hidden,true);
 }finally{w.close();}
});
test('popup continuation rejects an account or workspace change',async()=>{
 const {w,calls}=await mount();try{
 w.document.querySelector('[data-settings-switch="microsoft"]').click();w.document.querySelector('[data-continue-microsoft]').click();assert.deepEqual(calls,['switch-microsoft']);
 w.document.querySelector('[data-microsoft-mail-action="connect"]').click();w.LeadIntelServerBridge.workspace={id:'w2',role:'owner'};w.document.querySelector('[data-continue-microsoft]').click();assert.deepEqual(calls,['switch-microsoft']);assert.match(w.document.getElementById('toast').textContent,/account changed/);
 }finally{w.close();}
});
test('Microsoft guide gives action-specific steps, approval request and a usable support handoff',async()=>{
 const {w,calls}=await mount();try{
 w.document.querySelector('[data-settings-switch="microsoft"]').click();const dialog=w.document.getElementById('microsoft-connection-help');assert.equal(dialog.querySelector('#microsoft-help-steps').children.length,6);assert.match(dialog.querySelector('#microsoft-help-steps').textContent,/Selected/);assert.equal(dialog.querySelector('details').open,false);
 assert.match(dialog.textContent,/Request approval/);assert.match(dialog.textContent,/Copy to clipboard/);assert.match(dialog.querySelector('#microsoft-admin-request').value,/review the requested permissions/);dialog.querySelector('details').open=true;dialog.querySelector('[data-select-microsoft-message]').click();const request=dialog.querySelector('#microsoft-admin-request');assert.equal(request.selectionStart,0);assert.equal(request.selectionEnd,request.value.length);const tab=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});request.dispatchEvent(tab);assert.equal(tab.defaultPrevented,false);const support=dialog.querySelector('[data-microsoft-support-email]');assert.ok(support.getAttribute('href').startsWith('mailto:'));assert.match(decodeURIComponent(support.href),/AADSTS700016/);
 dialog.querySelector('[data-close-microsoft-help]').click();w.document.querySelector('[data-microsoft-mail-action="connect"]').click();assert.match(dialog.querySelector('#microsoft-help-steps').textContent,/Connected/);assert.match(dialog.querySelector('#microsoft-help-steps').textContent,/send/);assert.doesNotMatch(dialog.querySelector('#microsoft-help-steps').textContent,/Selected/);assert.deepEqual(calls,[]);
 }finally{w.close();}
});
test('complete Microsoft popup includes both setup flows and official clickable password recovery links',async()=>{
 const {w}=await mount({authenticated:false});try{
 w.document.querySelector('[data-settings-signin="microsoft"]').click();const dialog=w.document.getElementById('microsoft-connection-help');assert.match(dialog.querySelector('#microsoft-help-other-steps').textContent,/Microsoft 365/);
 const urls=[...dialog.querySelectorAll('a[href]')].map(a=>a.href);assert.ok(urls.includes('https://account.live.com/ResetPassword.aspx'));assert.ok(urls.includes('https://passwordreset.microsoftonline.com/'));assert.match(dialog.textContent,/self-service recovery/);assert.match(dialog.textContent,/cannot be bypassed/);
 }finally{w.close();}
});
