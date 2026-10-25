import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const source=read('topbar.js'),html=read('index.html'),css=read('app-shell.css');

const PAGE=`<div class="page-shell"><header class="topbar"><a class="brand"></a><div class="top-actions">
  <button id="open-crm" class="ghost-btn">CRM</button>
  <div id="server-account"><span id="server-account-label">Jonathan</span><span id="server-auth-provider">Google · montesuntzu@gmail.com</span><span id="server-sync-status">SYNCED TO LEADINTEL</span><button id="server-signout">Sign out</button></div>
  <span class="autosave">Saved automatically to LeadIntel</span>
  <button id="save-workspace" class="ghost-btn">Save now</button>
  <button id="reset-workspace" class="ghost-btn">Reset workspace</button>
</div></header>
<aside class="utility-panel"><button id="workspace-attention"><strong>Workspace status</strong><em data-attention-summary>1 item need attention</em><b data-attention-count>1</b></button><button id="open-settings">Open settings</button></aside></div>`;

async function mount({authenticated=true,platformAdmin=false}={}){
  const {JSDOM}=await import('jsdom');
  const dom=new JSDOM(PAGE,{url:'https://example.test/customer/'});
  const win=dom.window;win.LeadIntelServerBridge={session:{authenticated,user:{platform_admin:platformAdmin}}};
  const clicks=[];for(const id of ['open-settings','server-signout','reset-workspace','workspace-attention','save-workspace'])win.document.getElementById(id).addEventListener('click',()=>clicks.push(id));
  new Function('window',source)(win);
  return {win,doc:win.document,clicks};
}

test('the page loads topbar.js and the shell stylesheet hides the bridge texts it replaces',()=>{
  assert.match(html,/<script defer src="topbar\.js\?v=[^"]+"><\/script>/);
  assert.match(css,/#server-account-label,#server-auth-provider,#server-sync-status,\.top-actions>\.autosave,\.top-actions>#server-signout,\.top-actions>#reset-workspace,#server-account>#server-signout\{display:none!important\}/);
  assert.match(css,/\.page-shell \.utility-panel\{display:none\}/);
  assert.match(css,/\.page-shell main\.content::-webkit-scrollbar\{width:6px\}/);
  assert.match(css,/\.page-shell \.progress-panel\{padding:24px 20px 24px 24px/);
});

test('three controls replace seven texts: save status, Workspace status with badge, account menu',async()=>{
  const {doc}=await mount();
  const items=[...doc.querySelector('.top-actions').children].map(c=>c.id);
  assert.deepEqual(items.slice(0,5),['open-crm','topbar-status','topbar-save','topbar-workspace-status','topbar-account']);
  assert.equal(doc.getElementById('topbar-save').hidden,true,'Save now stays hidden while everything is saved');
  assert.equal(doc.getElementById('topbar-status').textContent,'Saved');
  assert.equal(doc.getElementById('topbar-status').dataset.tone,'ok');
  const ws=doc.getElementById('topbar-workspace-status');
  assert.equal(ws.querySelector('[data-topbar-badge]').textContent,'1');assert.equal(ws.querySelector('[data-topbar-badge]').hidden,false);
  const account=doc.getElementById('topbar-account');
  assert.equal(account.querySelector('.account-menu-btn [data-topbar-name]').textContent,'Jonathan');
  assert.equal(account.querySelector('[data-topbar-initial]').textContent,'J');
  assert.equal(account.querySelector('[data-topbar-provider]').textContent,'Google · montesuntzu@gmail.com');
  assert.equal(account.hidden,false);
});

test('menu items click the original buttons; Workspace status opens the attention drawer; outside click and Escape close the menu',async()=>{
  const {win,doc,clicks}=await mount();
  const btn=doc.getElementById('topbar-account-btn'),panel=doc.getElementById('topbar-account-panel');
  assert.equal(panel.hidden,true);btn.click();assert.equal(panel.hidden,false);assert.equal(btn.getAttribute('aria-expanded'),'true');
  panel.querySelector('[data-topbar-action="settings"]').click();assert.deepEqual(clicks,['open-settings']);assert.equal(panel.hidden,true);
  btn.click();panel.querySelector('[data-topbar-action="signout"]').click();assert.deepEqual(clicks,['open-settings','server-signout']);
  btn.click();panel.querySelector('[data-topbar-action="reset"]').click();assert.deepEqual(clicks,['open-settings','server-signout','reset-workspace']);
  doc.getElementById('topbar-workspace-status').click();assert.equal(clicks.at(-1),'workspace-attention');
  btn.click();assert.equal(panel.hidden,false);doc.body.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));assert.equal(panel.hidden,true);
  btn.click();doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(panel.hidden,true);
});

test('the status pill follows the bridge text and the badge follows the attention count',async()=>{
  const {win,doc}=await mount();
  const {statusFor}=win.LeadIntelTopbar;
  assert.deepEqual(statusFor('UNSYNCED CHANGES · SAVING'),{label:'Saving…',tone:'busy'});
  assert.deepEqual(statusFor('UNSYNCED CHANGES'),{label:'Unsynced changes',tone:'busy'});
  assert.deepEqual(statusFor('SYNC CONFLICT'),{label:'Needs attention',tone:'attention'});
  assert.deepEqual(statusFor('LOCAL CACHE · SERVER UNAVAILABLE'),{label:'Needs attention',tone:'attention'});
  assert.deepEqual(statusFor(''),{label:'Local only',tone:'busy'});
  doc.getElementById('server-sync-status').textContent='UNSYNCED CHANGES · SAVING';doc.querySelector('[data-attention-count]').textContent='0';
  await new Promise(r=>setTimeout(r,20));
  assert.equal(doc.getElementById('topbar-status').textContent,'Saving…');
  assert.equal(doc.getElementById('topbar-workspace-status').querySelector('[data-topbar-badge]').hidden,true);
});

test('signed out, the account menu is hidden and building twice does not duplicate controls',async()=>{
  const {win,doc}=await mount({authenticated:false});
  doc.getElementById('server-account-label').textContent='';
  win.LeadIntelTopbar.update();
  assert.equal(doc.getElementById('topbar-account').hidden,true);
  win.LeadIntelTopbar.build();
  assert.equal(doc.querySelectorAll('#topbar-status').length,1);
});

test('the status pill trusts the persistence label over the bridge text, and Save now appears only while changes are unsynced',async()=>{
  const {win,doc,clicks}=await mount();
  const {statusFor}=win.LeadIntelTopbar;
  assert.deepEqual(statusFor('SYNCED TO LEADINTEL','Unsaved changes · saving shortly'),{label:'Unsynced changes',tone:'busy'});
  assert.deepEqual(statusFor('SYNCED TO LEADINTEL','Saving workspace…'),{label:'Saving…',tone:'busy'});
  assert.deepEqual(statusFor('SYNCED TO LEADINTEL','Sync conflict · local and server versions preserved'),{label:'Needs attention',tone:'attention'});
  assert.deepEqual(statusFor('SYNCED TO LEADINTEL','Sync timed out · retry save · changes kept in this browser'),{label:'Needs attention',tone:'attention'});
  assert.deepEqual(statusFor('SYNCED TO LEADINTEL','Saved in this browser · cloud sync pending'),{label:'Unsynced changes',tone:'busy'});
  assert.deepEqual(statusFor('SYNCED TO LEADINTEL','Saved automatically to LeadIntel'),{label:'Saved',tone:'ok'});
  assert.deepEqual(statusFor('SYNCED TO LEADINTEL','New workspace · ready'),{label:'Saved',tone:'ok'});
  const autosave=doc.querySelector('.top-actions>.autosave'),pill=doc.getElementById('topbar-status'),save=doc.getElementById('topbar-save');
  autosave.textContent='Unsaved changes · saving shortly';
  await new Promise(r=>setTimeout(r,20));
  assert.equal(pill.textContent,'Unsynced changes');assert.equal(pill.dataset.tone,'busy');
  assert.equal(save.hidden,false);assert.equal(save.textContent,'Save now');
  save.click();assert.equal(clicks.at(-1),'save-workspace');
  autosave.textContent='Sync conflict · local and server versions preserved';doc.getElementById('save-workspace').textContent='Keep my local changes';
  await new Promise(r=>setTimeout(r,20));
  assert.equal(pill.textContent,'Needs attention');assert.equal(save.hidden,false);assert.equal(save.textContent,'Keep my local changes');
  autosave.textContent='Saved automatically to LeadIntel';doc.getElementById('save-workspace').textContent='Save now';
  await new Promise(r=>setTimeout(r,20));
  assert.equal(pill.textContent,'Saved');assert.equal(save.hidden,true);
});

test('the shell stylesheet styles the Save now control next to the status pill',()=>{
  assert.match(css,/\.topbar-save\{/);
});

test('no stylesheet gives the workspace grid a third column above 720px now that the tools column is gone',()=>{
  // 2026-10-26: on step 6 message-workspace.css kept `225px 1fr 258px` with a selector (`body:has(#step-6.active)`)
  // more specific than the shell's `.page-shell .workspace`, so the hidden tools column still took 258px of blank space.
  const dir=new URL('../',import.meta.url);
  const tracks=value=>{const out=[];let depth=0,cur='';for(const ch of value){if(ch==='(')depth++;if(ch===')')depth--;if(ch===' '&&depth===0){if(cur)out.push(cur);cur='';}else cur+=ch;}if(cur)out.push(cur);return out;};
  const offenders=[];
  for(const file of fs.readdirSync(dir).filter(name=>name.endsWith('.css'))){
    const text=fs.readFileSync(new URL(file,dir),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
    for(const match of text.matchAll(/([^{}]+)\{([^{}]*grid-template-columns:([^;}]+)[^{}]*)\}/g)){
      const selector=match[1].trim();
      if(!selector.split(',').some(part=>part.trim().split(/\s+/).pop()==='.workspace'))continue;
      if(tracks(match[3].trim()).length<3)continue;
      if(selector==='.workspace')continue; // the plain selector loses to the shell's `.page-shell .workspace`
      offenders.push(`${file}: ${selector} -> ${match[3].trim()}`);
    }
  }
  assert.deepEqual(offenders,[]);
  const step6=read('message-workspace.css');
  assert.match(step6,/body:has\(#step-6\.active\) \.workspace\{grid-template-columns:225px minmax\(0,1fr\)\}/);
  assert.doesNotMatch(step6,/body:has\(#step-6\.active\) \.workspace\{[^}]*(258px|max-width)/);
});

test('on phones the shell owns a two-row top bar, keeps the launcher clear of the last control and scrolls the Settings tabs sideways (2026-10-26)',()=>{
  const phone=css.match(/@media\(max-width:720px\)\{[\s\S]*?\n\}/);
  assert.ok(phone,'a <=720px block exists in app-shell.css');
  const block=phone[0];
  assert.match(block,/\.page-shell \.topbar\{height:auto;min-height:0;display:flex;flex-wrap:wrap/);
  assert.match(block,/\.page-shell \.top-actions\{display:contents\}/);
  assert.match(block,/\.page-shell \.topbar::after\{content:"";flex-basis:100%;height:0;order:2\}/);
  assert.match(block,/\.page-shell #topbar-account\{order:1;margin-left:auto\}/);
  assert.match(block,/\.page-shell \.brand small\{display:none\}/);
  assert.match(block,/\.topbar-ws>span:first-child::before\{content:"Status"/);
  assert.match(block,/\.page-shell main\.content\{padding-bottom:110px\}/);
  assert.match(block,/\.settings-tabs\{display:flex;flex-wrap:nowrap;overflow-x:auto/);
  assert.match(html,/app-shell\.css\?[^"]*phones=20261026-v1/);
  const copilot=read('copilot.css');
  assert.match(copilot,/\.leadintel-copilot-entry\{[^}]*z-index:1090/,'the launcher sits under the Settings backdrop (1100) and every drawer');
  assert.match(copilot,/@media\(max-width:720px\)\{\.leadintel-copilot-entry\{right:14px;bottom:calc\(14px \+ env\(safe-area-inset-bottom,0px\)\)/);
});

test('the Admin entry exists only for a platform administrator: a link to /admin/ above Settings, absent from the DOM for everyone else (2026-10-25)',async()=>{
  const member=await mount();
  assert.equal(member.doc.querySelector('#topbar-account-panel [data-topbar-action="admin"]'),null,'a member has no Admin entry at all');
  const admin=await mount({platformAdmin:true});
  const entry=admin.doc.querySelector('#topbar-account-panel [data-topbar-action="admin"]');
  assert.ok(entry,'an administrator gets the Admin entry');
  assert.equal(entry.tagName,'A');assert.equal(entry.getAttribute('href'),'/admin/');assert.equal(entry.getAttribute('role'),'menuitem');assert.equal(entry.textContent,'Admin');
  assert.equal(entry.nextElementSibling.dataset.topbarAction,'settings','Admin sits directly above Settings');
  admin.win.LeadIntelServerBridge.session.user.platform_admin=false;admin.win.LeadIntelTopbar.update();
  assert.equal(admin.doc.querySelector('[data-topbar-action="admin"]'),null,'the entry leaves when the session stops being an administrator');
  admin.win.LeadIntelServerBridge.session.user.platform_admin=true;admin.win.LeadIntelTopbar.update();admin.win.LeadIntelTopbar.update();
  assert.equal(admin.doc.querySelectorAll('[data-topbar-action="admin"]').length,1,'repeated updates never duplicate it');
  assert.match(css,/\.account-menu-panel>a\{all:unset;display:block;width:100%/,'the shell stylesheet styles the link like the other menu items');
  assert.match(html,/topbar\.js\?v=[^"]*admin-entry=\d{8}-v\d+/);assert.match(html,/app-shell\.css\?v=[^"]*admin-entry=\d{8}-v\d+/);
});
