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
  assert.match(css,/#ai-settings-drawer>section\[data-settings-hidden="1"\]\{display:none!important\}/);
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
  const hidden=[...drawer.querySelectorAll('section')].filter(s=>s.hasAttribute('data-settings-hidden')).length;
  assert.equal(hidden,5,'only the AI providers section is visible on the default tab');
  assert.ok(!win.document.getElementById('integration-health-summary').hasAttribute('data-settings-hidden'));
});

test('choosing a tab shows only its sections, remembers the choice, and the next open restores it',async()=>{
  const {win,drawer,tabs}=await mount();
  tabs.build(drawer);
  drawer.querySelector('[data-settings-tab="delivery"]').click();
  const visible=[...drawer.querySelectorAll('section')].filter(s=>!s.hasAttribute('data-settings-hidden')).map(s=>s.querySelector('.eyebrow').textContent);
  assert.deepEqual(visible,['Communication','Meetings']);
  assert.equal(drawer.querySelector('[data-settings-tab="delivery"]').getAttribute('aria-selected'),'true');
  assert.equal(drawer.querySelector('[data-settings-tab="engines"]').getAttribute('aria-selected'),'false');
  assert.equal(win.localStorage.getItem(tabs.STORAGE_KEY),'delivery');
  // a second open (settings-opened fires every time) keeps the current tab and does not duplicate the bar
  win.dispatchEvent(new win.Event('leadintel:settings-opened'));
  assert.equal(drawer.querySelectorAll('.settings-tabs').length,1);
  assert.equal(drawer.querySelector('[data-settings-tab="delivery"]').getAttribute('aria-selected'),'true');
});

test('a section replaced by its renderer (storage after a status refresh) is re-tagged and stays hidden on another tab',async()=>{
  const {win,drawer,tabs}=await mount();
  tabs.build(drawer);
  drawer.querySelector('[data-settings-tab="profile"]').click();
  const old=drawer.querySelector('#workspace-storage-card');
  const fresh=win.document.createElement('section');fresh.id='workspace-storage-card';fresh.className='workspace-storage-card';fresh.innerHTML='<span class="eyebrow">Your workspace</span>';
  old.replaceWith(fresh);
  assert.ok(!fresh.hasAttribute('data-settings-hidden'),'untagged on arrival');
  // a renderer that only resets className must not reveal a hidden section either
  await new Promise(r=>setTimeout(r,30));
  assert.equal(fresh.dataset.settingsTab,'storage');
  assert.ok(fresh.hasAttribute('data-settings-hidden'),'hidden again because Profile is the open tab');
  assert.equal(drawer.querySelectorAll('.settings-tabs').length,1);
});

test('the application shell locks the document and lets the panes scroll; window.scrollTo also moves the content pane',async()=>{
  const shellCss=read('app-shell.css'),shellJs=read('app-shell.js');
  assert.match(html,/<link rel="stylesheet" href="app-shell\.css\?v=[^"]+">/);
  assert.match(html,/<script defer src="app-shell\.js\?v=[^"]+"><\/script>/);
  assert.match(shellCss,/@media\(min-width:721px\)\{\s*html,body\{height:100%;overflow:hidden\}/);
  assert.match(shellCss,/main\.content\{height:100%;min-height:0;overflow:auto/);
  assert.match(shellCss,/\.progress-panel,\.utility-panel\{position:static[^}]*overflow:auto\}/);
  const {JSDOM}=await import('jsdom');
  const dom=new JSDOM('<main class="content" style="overflow:hidden"></main>',{url:'https://example.test/customer/'});
  const win=dom.window;let moved=null;win.document.querySelector('main').scrollTo=o=>{moved=o;};win.document.body.style.overflow='hidden';
  new Function('window',shellJs)(win);
  win.scrollTo({top:0,behavior:'smooth'});
  assert.deepEqual(moved,{top:0,behavior:'smooth'});
  moved=null;win.document.body.style.overflow='';win.scrollTo({top:0});
  assert.equal(moved,null,'ordinary page scrolling leaves the pane alone');
});

test('the settings drawer slides in from the right and its backdrop fades, like Ask LeadIntel',()=>{
  const css=read('app-shell.css');
  assert.match(css,/#ai-settings-drawer\{transform:translateX\(104%\);transition:transform/);
  assert.match(css,/#ai-settings-drawer\.is-open\{transform:none\}/);
  assert.match(css,/#ai-settings-backdrop\.is-open\{opacity:1\}/);
  assert.match(settings,/drawer\?\.classList\.add\('is-open'\);backdrop\?\.classList\.add\('is-open'\)/);
  assert.match(settings,/drawer\?\.classList\.remove\('is-open'\);backdrop\?\.classList\.remove\('is-open'\)/);
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
  assert.match(extension,/\['firecrawl','treg'\]\.includes\(config\.provider\)/);
  assert.match(extension,/config\.provider==='treg'\)\{card=document\.createElement\('article'\)/);
  assert.match(extension,/data-paid-contact-settings/);
  assert.match(extension,/const meta=configured\?`Saved key \$\{esc\(row\.key_hint\|\|''\)\} · \$\{sourceLabel\(row\)\}`:'';/);
  assert.match(css,/#integration-platform-grid\{grid-template-columns:1fr\}/);
  assert.match(css,/#ai-settings-drawer \.ai-provider-actions\{display:flex;flex-wrap:nowrap/);
  assert.match(css,/\.integration-subheading\{grid-column:1\/-1/);
});

test('Delivery stacks every card, and connecting Gmail pre-selects the signed-in Google account unless the member chooses another',()=>{
  const saas=fs.readFileSync(new URL('../../backend/src/saas-routes.js',import.meta.url),'utf8');
  assert.doesNotMatch(css,/#integration-communication-grid\{grid-template-columns:1fr\}/,'accounts and mailboxes stay side by side');
  assert.match(css,/\.gmail-mail-actions,\.microsoft-mail-actions\{display:grid;gap:8px/);
  assert.match(css,/#integration-communication-grid \.integration-card\{display:flex;flex-direction:column/);
  assert.match(settings,/<small class="mail-note">One Microsoft permission \(send only\)/);
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
