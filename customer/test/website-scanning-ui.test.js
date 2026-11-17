const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const wait=()=>new Promise(r=>setTimeout(r,15));
test('approval return opens the real monitoring wrapper without starting a scan',async()=>{
 const w=runtime();await wait();let requests=0,opened=0;w.fetch=async()=>{requests++;throw Error('No research expected');};w.addEventListener('leadintel:monitoring-opened',()=>opened++);
 assert.equal(w.LeadIntelWebsiteScanUI.openMonitoring(),true);assert.equal(w.document.getElementById('website-scanning-workspace').hidden,false);assert.equal(w.document.getElementById('website-scanning-monitor').hidden,false);assert.equal(w.document.getElementById('monitoring-settings').hidden,false);assert.equal(requests,0);assert.equal(opened,1);w.close();
});
test('returning to monitoring announces visibility even when its settings were already open',async()=>{
 const w=runtime();await wait();let shown=0;w.addEventListener('leadintel:monitoring-opened',()=>shown++);
 w.document.querySelector('#website-scanning-open').click();w.document.querySelector('[data-scan-mode="monitor"]').click();
 w.document.querySelector('[data-scan-mode="find"]').click();w.document.querySelector('[data-scan-mode="monitor"]').click();
 assert.equal(shown,2);w.close();
});
function runtime(){const w=new JSDOM('<section id="step-2"><section data-reference-intelligence-card></section><section id="campaign-planning-host"><details id="event-campaign-panel"></details><details id="email-campaign-panel"></details></section><div class="stage-next-action"></div></section><section id="step-4"><section id="monitoring-panel"><div class="monitoring-card-head"><button id="toggle-monitoring-settings"></button><span id="monitoring-summary-status">Off</span></div><div id="monitoring-settings" hidden><button id="close-monitoring-settings"></button></div></section></section>',{url:'https://app.example',runScripts:'outside-only'}).window;w.LeadIntelWebsiteScanning=require('../website-scanning.js');w.LeadIntelWebsiteScanHandoff=require('../website-scanning-handoff.js');w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'u'}},workspace:{id:'w'}};w.LeadIntelDialogs={confirm:async()=>true};w.document.querySelector('#toggle-monitoring-settings').onclick=()=>{w.document.querySelector('#monitoring-settings').hidden=false;};w.document.querySelector('#close-monitoring-settings').onclick=()=>{w.document.querySelector('#monitoring-settings').hidden=true;};w.fetch=async url=>({ok:true,json:async()=>url.includes('ai/generate')?{text:JSON.stringify({companies:[{name:'Alpha Tools',website:'https://alpha.example',quote:'Alpha Tools makes equipment for exporters.',fit:'match'}]})}:{data:{markdown:'Alpha Tools makes equipment for exporters. Manufacturing company directory and reference information.',metadata:{title:'Top manufacturers'},links:['https://alpha.example']}}});w.eval(fs.readFileSync(require.resolve('../website-scanning-ui.js'),'utf8').replace(/^import .*?;\s*/gm,''));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));return w;}
test('card mounts below company intelligence, uses two modes and preserves monitoring controls',async()=>{const w=runtime();await wait();const d=w.document,card=d.querySelector('#website-scanning-card');assert.equal(d.querySelector('[data-reference-intelligence-card]').nextElementSibling,card);assert.equal(card.nextElementSibling.id,'campaign-planning-host');d.querySelector('#website-scanning-open').click();assert.equal(d.querySelector('#website-scanning-workspace').hidden,false);d.querySelector('[data-scan-mode="monitor"]').click();assert.equal(d.querySelector('#monitoring-panel').closest('#website-scanning-card'),card);assert.equal(d.querySelector('#monitoring-settings').hidden,false);d.querySelector('[data-scan-mode="find"]').click();assert.equal(d.querySelector('#website-scanning-results').hidden,false);w.close();});
test('scan persists grounded rows across remount; changing a checked website invalidates identity',async()=>{const w=runtime();await wait();const d=w.document;d.querySelector('#website-scanning-open').click();const input=d.querySelector('#website-scanning-url');input.value='https://list.example/top';input.dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('[data-scan-action="scan"]').click();await wait();await wait();assert.match(d.querySelector('#website-scanning-results').textContent,/Alpha Tools/);const state=JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state'));assert.equal(state.websiteScans.items[0].rows.length,1);state.websiteScans.items[0].rows[0].identityStatus='verified';state.websiteScans.items[0].rows[0].identityUrl='https://alpha.example/';w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(state));w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));await wait();d.querySelector('#website-scanning-open').click();const site=d.querySelector('[data-scan-website]');site.value='https://other.example';site.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state')).websiteScans.items[0].rows[0].identityStatus,'unchecked');w.close();});
test('background app normalization preserves saved scan results',()=>{const P=require('../profile-engine.js');const input={website:'https://seller.example',websiteScans:{version:1,activeId:'x',items:[{id:'x',rows:[]}]}};assert.deepEqual(P.normalizeSavedState(input).websiteScans,input.websiteScans);});
test('reference-card refresh preserves the approved scanner placement',async()=>{const w=runtime();await wait();const source=fs.readFileSync(require.resolve('../process-map.js'),'utf8');const start=source.indexOf('function ensureReferenceCustomerTool(){'),end=source.indexOf('function patchMarketLookalikeIsolation',start);w.eval(source.slice(start,end)+'\nensureReferenceCustomerTool();');const d=w.document;assert.equal(d.querySelector('[data-reference-intelligence-card]').nextElementSibling.id,'website-scanning-card');w.close();});
test('scan, website verification, CRM provenance and scan deletion work together without deleting companies',async()=>{
 const w=runtime(),saved=[],activities=[];w.LeadIntelServerBridge.saveCrmCompany=async body=>{saved.push(body);return {company:{id:'crm-alpha',lifecycle_status:'prospect'}};};w.LeadIntelServerBridge.recordCrmActivity=async(id,body)=>activities.push(body);
 const original=w.fetch;w.fetch=async(url,opts)=>url.includes('/scrape')&&JSON.parse(opts.body).url.includes('alpha.example')?{ok:true,json:async()=>({data:{metadata:{title:'Alpha Tools'},markdown:'Alpha Tools manufactures equipment for export companies.'}})}:original(url,opts);
 await wait();const d=w.document;d.querySelector('#website-scanning-open').click();const input=d.querySelector('#website-scanning-url');input.value='https://list.example/top';input.dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('[data-scan-action="scan"]').click();await wait();await wait();d.querySelector('[data-scan-action="verify"]').click();await wait();await wait();assert.match(d.querySelector('#website-scanning-results').textContent,/Website checked/);d.querySelector('[data-scan-action="save"]').click();await wait();await wait();assert.equal(saved.length,1);assert.equal(activities[0].metadata.sourceUrl,'https://list.example/top');assert.match(d.querySelector('#website-scanning-status').textContent,/1 companies saved/);d.querySelector('[data-scan-action="delete"]').click();await wait();assert.equal(JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state')).websiteScans.items.length,0);assert.equal(saved.length,1);w.close();
});
test('canceling a stalled scan releases controls and does not accept late results',async()=>{const w=runtime();await wait();let resolve;w.fetch=()=>new Promise(r=>{resolve=r;});const d=w.document;d.querySelector('#website-scanning-open').click();const input=d.querySelector('#website-scanning-url');input.value='https://list.example/top';input.dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('[data-scan-action="scan"]').click();await wait();d.querySelector('[data-scan-action="cancel"]').click();await wait();assert.equal(d.querySelector('[data-scan-action="scan"]').disabled,false);assert.match(d.querySelector('#website-scanning-status').textContent,/canceled/);resolve({ok:true,json:async()=>({data:{markdown:'Late evidence'}})});await wait();assert.equal(w.LeadIntelWebsiteScanUI.active(),null);w.close();});
test('delete confirmation cannot remove a scan after switching workspaces',async()=>{const w=runtime();await wait();let confirm;w.LeadIntelDialogs.confirm=()=>new Promise(r=>confirm=r);w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({websiteScans:{activeId:'a',items:[{id:'a',name:'Workspace A',url:'https://a.example',rows:[]}]}}));w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));w.document.querySelector('#website-scanning-open').click();w.document.querySelector('[data-scan-action="delete"]').click();w.LeadIntelServerBridge.workspace.id='w2';w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({websiteScans:{activeId:'b',items:[{id:'b',name:'Workspace B',url:'https://b.example',rows:[]}]}}));w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));confirm(true);await wait();assert.equal(JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state')).websiteScans.items[0].id,'b');w.close();});

// Exercise the real scan runner, CRM handoff and contact UI; only remote services are fixtures.
function contactJourney({verified=false,unresolved=false,stalled=false}={}){
 const w=runtime(),events=[];let release;
 const row={id:'scan-liljas',name:'Liljas Svets & Mekaniska AB',website:'https://www.liljassvets.se/',sourceUrl:'https://www.liljassvets.se/',quote:'Liljas Svets & Mekaniska AB erbjuder kompletta lösningar.',selected:true,identityStatus:verified?'verified':'unchecked',identityUrl:verified?'https://www.liljassvets.se/':''};
 w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({websiteScans:{activeId:'scan',items:[{id:'scan',url:row.website,rows:[row]}]}}));
 w.LeadIntelWebsiteScanUI.refresh();
 w.LeadIntelServerBridge.saveCrmCompany=async body=>{events.push(['save',body]);return {company:{id:'crm-liljas',lifecycle_status:'prospect'}};};
 w.LeadIntelServerBridge.recordCrmActivity=async(id,body)=>{events.push(['activity',id,body]);return {ok:true};};
 const job={id:'contacts-liljas',companyId:'crm-liljas',company:row.name,domain:'liljassvets.se',status:'complete',revision:1,label:'Checked accessible sources',people:[],channels:[],routes:[],sources:[],gaps:[],coverage:{},counts:{discovered:0,checked:0,pending:0,reads:1}};
 const response=data=>({ok:true,json:async()=>data});
 w.fetch=async(url,options)=>{
  if(url.includes('/scrape')){events.push(['verify',JSON.parse(options.body).url]);if(stalled)await new Promise(r=>release=r);return response({data:{metadata:{title:unresolved?'Unrelated directory':row.name},markdown:unresolved?'No company evidence.':row.quote}});}
  if(url.includes('/api/websites/contacts')){if(options.method==='GET'){events.push(['get',url]);return response({job:null});}const body=JSON.parse(options.body);events.push(['research',body]);return response({job});}
  throw Error('Unexpected request '+url);
 };
 w.eval(fs.readFileSync(require.resolve('../website-contact-ui.js'),'utf8'));
 return {w,events,release:()=>release?.()};
}
async function settled(w){for(let i=0;i<100;i++){await wait();if(!w.document.querySelector('[data-scan-action="buyers"]').disabled)return;}assert.fail('Find contacts did not settle');}

test('Find contacts verifies an unchecked company, saves provenance and opens its research; reopening reuses verification',async()=>{
 const {w,events}=contactJourney();try{
  await wait();w.document.querySelector('#website-scanning-open').click();w.document.querySelector('[data-scan-action="buyers"]').click();await settled(w);
  assert.deepEqual(events.map(e=>e[0]),['verify','save','activity','get','research']);
  assert.deepEqual(events.find(e=>e[0]==='research')[1],{action:'start',companyId:'crm-liljas'});
  assert.equal(events[2][2].metadata.identityUrl,'https://www.liljassvets.se/');
  assert.equal(w.document.querySelector('#website-contact-results').hidden,false);
  assert.match(w.document.querySelector('#website-contact-results').textContent,/Liljas Svets/);
  const saved=JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state')).websiteScans.items[0].rows[0];
  assert.equal(saved.identityStatus,'verified');assert.equal(saved.crmId,'crm-liljas');
  w.LeadIntelWebsiteContacts.close();w.LeadIntelWebsiteScanUI.refresh();events.length=0;
  w.document.querySelector('[data-scan-action="buyers"]').click();await settled(w);
  assert.deepEqual(events.map(e=>e[0]),['save','activity','get','research']);
 }finally{w.LeadIntelWebsiteContacts.close();w.close();}
});
test('Find contacts preserves unresolved companies and explains why no CRM or research request can start',async()=>{
 const {w,events}=contactJourney({unresolved:true});try{
  await wait();w.document.querySelector('[data-scan-action="buyers"]').click();await settled(w);
  assert.deepEqual(events.map(e=>e[0]),['verify']);
  assert.equal(w.LeadIntelWebsiteScanUI.active().rows[0].identityStatus,'unresolved');
  assert.match(w.document.querySelector('#website-scanning-status').textContent,/contact research.*not started/i);
  assert.equal(w.document.querySelector('#website-contact-results'),null);
 }finally{w.close();}
});
test('canceling automatic verification prevents CRM save and research even if a late read succeeds',async()=>{
 const {w,events,release}=contactJourney({stalled:true});try{
  await wait();w.document.querySelector('[data-scan-action="buyers"]').click();await wait();
  assert.deepEqual(events.map(e=>e[0]),['verify']);
  w.document.querySelector('[data-scan-action="cancel"]').click();await settled(w);release();await wait();
  assert.equal(w.LeadIntelWebsiteScanUI.active().rows[0].identityStatus,'unchecked');assert.equal(events.length,1);
 }finally{release();w.close();}
});
test('switching workspace during automatic verification cannot save or start contact research',async()=>{
 const {w,events,release}=contactJourney({stalled:true});try{
  await wait();w.document.querySelector('[data-scan-action="buyers"]').click();await wait();
  assert.deepEqual(events.map(e=>e[0]),['verify']);
  w.LeadIntelServerBridge.workspace.id='other-workspace';w.localStorage.setItem('leadintel_customer_v2_state','{}');w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));
  release();await wait();assert.equal(events.length,1);assert.equal(w.LeadIntelWebsiteScanUI.active(),null);
 }finally{release();w.close();}
});
test('a failed CRM save after automatic verification keeps the checked scan retryable without starting research',async()=>{
 const {w,events}=contactJourney();try{
  w.LeadIntelServerBridge.saveCrmCompany=async()=>({ok:false,error:'CRM temporarily unavailable'});
  await wait();w.document.querySelector('[data-scan-action="buyers"]').click();await settled(w);
  assert.deepEqual(events.map(e=>e[0]),['verify']);assert.equal(w.LeadIntelWebsiteScanUI.active().rows[0].identityStatus,'verified');
  assert.match(w.document.querySelector('#website-scanning-status').textContent,/CRM temporarily unavailable/);
  assert.equal(w.document.querySelector('#website-contact-results'),null);
 }finally{w.close();}
});
test('a mixed selection retains completed checks and starts research after the unresolved row is deselected',async()=>{
 const {w,events}=contactJourney();try{
  await wait();const state=JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state'));
  state.websiteScans.items[0].rows.push({...state.websiteScans.items[0].rows[0],id:'unresolved',name:'Other Company',website:'https://other.example/'});
  w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(state));w.LeadIntelWebsiteScanUI.refresh();
  w.document.querySelector('[data-scan-action="buyers"]').click();await settled(w);
  assert.deepEqual(events.map(e=>e[0]),['verify','verify']);
  assert.deepEqual(Array.from(w.LeadIntelWebsiteScanUI.active().rows,r=>r.identityStatus),['verified','unresolved']);
  const checkbox=w.document.querySelector('[data-scan-selected="unresolved"]');checkbox.checked=false;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));events.length=0;
  w.document.querySelector('[data-scan-action="buyers"]').click();await settled(w);
  assert.deepEqual(events.map(e=>e[0]),['save','activity','get','research']);assert.equal(events[0][1].company_name,'Liljas Svets & Mekaniska AB');
 }finally{w.LeadIntelWebsiteContacts.close();w.close();}
});
