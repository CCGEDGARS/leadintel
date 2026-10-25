import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const source=read('settings-tabs.js'),css=read('settings-tabs.css'),html=read('index.html'),settings=read('ai-settings.js'),bridge=read('server-bridge.js'),backend=fs.readFileSync(new URL('../../backend/src/index.js',import.meta.url),'utf8');

const DRAWER=`<aside id="ai-settings-drawer">
  <div class="ai-settings-head"><span class="eyebrow">Workspace settings</span></div>
  <div id="integration-health-summary"></div>
  <div id="ai-engine-summary"></div>
  <section class="ai-settings-section"><span class="eyebrow">Communication</span></section>
  <section id="workspace-storage-card" class="workspace-storage-card"><span class="eyebrow">Your workspace</span></section>
  <section class="ai-settings-section"><span class="eyebrow">AI providers</span></section>
  <section class="ai-settings-section"><span class="eyebrow">Data &amp; intelligence</span></section>
  <section class="ai-settings-section"><span class="eyebrow">Meetings</span></section>
  <section class="ai-settings-section"><span class="eyebrow">Your professional profile</span></section>
  <div class="ai-security-note"></div>
</aside>`;

async function mount(){
  const {JSDOM}=await import('jsdom');
  const dom=new JSDOM(DRAWER,{url:'https://example.test/customer/'});
  const win=dom.window;
  new Function('window','document',source)(win,win.document);
  return {dom,win,drawer:win.document.getElementById('ai-settings-drawer'),tabs:win.LeadIntelSettingsTabs};
}

test('the settings drawer loads the tabs module and the tabs stylesheet is scoped',()=>{
  assert.match(html,/<script defer src="settings-tabs\.js\?v=[^"]+"><\/script>/);
  assert.match(settings,/leadintel:settings-opened/);
  assert.match(css,/\.settings-tab-hidden\{display:none!important\}/);
  assert.match(css,/\.settings-tab\[aria-selected="true"\]/);
});

test('sections are grouped into five tabs by their eyebrow, the head and summaries stay visible',async()=>{
  const {win,drawer,tabs}=await mount();
  const selected=tabs.build(drawer);
  assert.equal(selected,'engines');
  const bar=drawer.querySelector('.settings-tabs');
  assert.equal(bar.getAttribute('role'),'tablist');
  assert.deepEqual([...bar.querySelectorAll('[data-settings-tab]')].map(b=>b.textContent),['AI engines','Data sources','Delivery','Profile','Storage']);
  assert.equal(drawer.children[3],bar,'the bar sits right before the first section');
  const byTab=id=>[...drawer.querySelectorAll('section')].filter(s=>s.dataset.settingsTab===id).map(s=>s.querySelector('.eyebrow').textContent);
  assert.deepEqual(byTab('engines'),['AI providers']);
  assert.deepEqual(byTab('data'),['Data & intelligence']);
  assert.deepEqual(byTab('delivery'),['Communication','Meetings']);
  assert.deepEqual(byTab('profile'),['Your professional profile']);
  assert.deepEqual(byTab('storage'),['Your workspace']);
  const hidden=[...drawer.querySelectorAll('section')].filter(s=>s.classList.contains('settings-tab-hidden')).length;
  assert.equal(hidden,5,'only the AI providers section is visible on the default tab');
  assert.ok(!win.document.getElementById('integration-health-summary').classList.contains('settings-tab-hidden'));
});

test('choosing a tab shows only its sections, remembers the choice, and the next open restores it',async()=>{
  const {win,drawer,tabs}=await mount();
  tabs.build(drawer);
  drawer.querySelector('[data-settings-tab="delivery"]').click();
  const visible=[...drawer.querySelectorAll('section')].filter(s=>!s.classList.contains('settings-tab-hidden')).map(s=>s.querySelector('.eyebrow').textContent);
  assert.deepEqual(visible,['Communication','Meetings']);
  assert.equal(drawer.querySelector('[data-settings-tab="delivery"]').getAttribute('aria-selected'),'true');
  assert.equal(drawer.querySelector('[data-settings-tab="engines"]').getAttribute('aria-selected'),'false');
  assert.equal(win.localStorage.getItem(tabs.STORAGE_KEY),'delivery');
  // a second open (settings-opened fires every time) keeps the current tab and does not duplicate the bar
  win.dispatchEvent(new win.Event('leadintel:settings-opened'));
  assert.equal(drawer.querySelectorAll('.settings-tabs').length,1);
  assert.equal(drawer.querySelector('[data-settings-tab="delivery"]').getAttribute('aria-selected'),'true');
});

test('arrow keys move between tabs and a tab without sections is not offered',async()=>{
  const {win,drawer,tabs}=await mount();
  drawer.querySelector('#workspace-storage-card').remove();
  tabs.build(drawer);
  assert.equal(drawer.querySelector('[data-settings-tab="storage"]').hidden,true);
  const bar=drawer.querySelector('.settings-tabs');
  bar.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(drawer.querySelector('[data-settings-tab="data"]').getAttribute('aria-selected'),'true');
  bar.dispatchEvent(new win.KeyboardEvent('keydown',{key:'End',bubbles:true}));
  assert.equal(drawer.querySelector('[data-settings-tab="profile"]').getAttribute('aria-selected'),'true');
});

test('Delivery tab separates the sign-in account from the sending mailbox; Data sources offers Firecrawl, Treg and optional Hunter in one column',()=>{
  const extension=read('service-settings-extension.js');
  assert.match(settings,/gives LeadIntel no access to your mail/);
  assert.match(settings,/<div class="integration-subheading" role="heading" aria-level="4"><strong>Sending mailbox<\/strong>/);
  assert.match(settings,/providerCardClass\('google'\)/);assert.match(settings,/providerCardClass\('microsoft'\)/);
  assert.match(settings,/\?\(authProvider\(\)===provider\?'is-active':'is-alternate'\):''/);
  assert.doesNotMatch(settings,/Optional outbound delivery|Optional human-approved outbound/);
  assert.match(extension,/\['firecrawl','treg','hunter'\]\.includes\(config\.provider\)/);
  assert.match(extension,/\['treg','hunter'\]\.includes\(config\.provider\)\)\{card=document\.createElement\('article'\)/);
  assert.match(extension,/Optional · only if you already use Hunter/);
  assert.match(extension,/const meta=configured\?`Saved key \$\{esc\(row\.key_hint\|\|''\)\} · \$\{sourceLabel\(row\)\}`:'';/);
  assert.match(css,/#integration-platform-grid\{grid-template-columns:1fr\}/);
  assert.match(css,/\.workspace-provider-card\.is-active\{grid-column:1\/-1\}/);
  assert.match(css,/\.integration-subheading\{grid-column:1\/-1/);
});

test('Delivery stacks every card, and connecting Gmail pre-selects the signed-in Google account unless the member chooses another',()=>{
  const saas=fs.readFileSync(new URL('../../backend/src/saas-routes.js',import.meta.url),'utf8');
  assert.match(css,/#integration-communication-grid\{grid-template-columns:1fr\}/);
  assert.match(css,/\.service-source\.managed\{display:none\}/);
  assert.match(saas,/const choose=url\.searchParams\.get\('choose'\)==='1';const loginHint=choose\?'':String\(access\.user\.email\|\|''\)\.trim\(\);/);
  assert.match(saas,/prompt:loginHint\?'consent':'select_account consent',loginHint\}/);
  assert.match(bridge,/function connectGmail\(options=\{\}\)/);
  assert.match(bridge,/options\.choose===true\?'&choose=1':''/);
  assert.match(settings,/Connect Gmail for \$\{esc\(account\)\}/);
  assert.match(settings,/data-gmail-action="connect" data-gmail-choose="1"/);
  assert.match(settings,/connectGmail\?\.\(\{choose:mailButton\.dataset\.gmailChoose==='1'\}\)/);
});

test('identity cards: the server names the sign-in providers, the bridge adopts them, the copy no longer says "Not identified"',()=>{
  assert.match(backend,/SELECT provider FROM user_identities WHERE user_id=\?/);
  assert.match(backend,/providers:identities\.map\(row=>row\.provider\)/);
  assert.match(bridge,/payload\.user\.providers/);
  assert.match(bridge,/!bridge\.authProvider&&providers\.length/);
  assert.doesNotMatch(settings,/Not identified|sign-in provider is unavailable|Optional workspace sign-in/);
  assert.match(settings,/label:'Signed in'/);
  assert.match(settings,/Use \$\{providerLabel\(provider\)\} instead/);
  assert.match(settings,/<small>Workspace sign-in<\/small>/);
});
