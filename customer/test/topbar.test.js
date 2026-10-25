import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const source=read('topbar.js'),html=read('index.html'),css=read('app-shell.css');

const PAGE=`<div class="page-shell"><header class="topbar"><a class="brand"></a><div class="top-actions">
  <button id="open-crm" class="ghost-btn">CRM</button>
  <div id="server-account"><span id="server-account-label">Jonathan</span><span id="server-auth-provider">Google · montesuntzu@gmail.com</span><span id="server-sync-status">SYNCED TO LEADINTEL</span><button id="server-signout">Sign out</button></div>
  <span class="autosave">Saved automatically to LeadIntel</span>
  <button id="reset-workspace" class="ghost-btn">Reset workspace</button>
</div></header>
<aside class="utility-panel"><button id="workspace-attention"><strong>Workspace status</strong><em data-attention-summary>1 item need attention</em><b data-attention-count>1</b></button><button id="open-settings">Open settings</button></aside></div>`;

async function mount({authenticated=true}={}){
  const {JSDOM}=await import('jsdom');
  const dom=new JSDOM(PAGE,{url:'https://example.test/customer/'});
  const win=dom.window;win.LeadIntelServerBridge={session:{authenticated}};
  const clicks=[];for(const id of ['open-settings','server-signout','reset-workspace','workspace-attention'])win.document.getElementById(id).addEventListener('click',()=>clicks.push(id));
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
  assert.deepEqual(items.slice(0,4),['open-crm','topbar-status','topbar-workspace-status','topbar-account']);
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
