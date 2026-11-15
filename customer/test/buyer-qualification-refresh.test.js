const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Display=require('../qualification-display.js'),{runtime,gate}=require('./helpers/buyer-controls-runtime.cjs');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function install(r,name){const marker='function '+name+'(',at=source.indexOf(marker),start=source.slice(at-6,at)==='async '?at-6:at,end=source.slice(start+1).search(/\n(?:async )?function /);vm.runInContext(source.slice(start,start+1+end),r.c);}
test('pending company scoring still repaints exact buyer identities after CRM hydration',async()=>{
 const pending=gate(),r=runtime({qualificationDisplay:{create:options=>Display.create({...options,request:()=>pending.promise})}});
 try{
  r.dom.window.document.body.insertAdjacentHTML('beforeend','<div id="company-qualification-summary"></div>');
  const render=()=>{const b=r.dom.window.document.createElement('button');b.dataset.keepBuyer=r.candidate.domain;b.dataset.personId=r.person.id;r.c.fixtureCandidate=r.candidate;r.c.fixturePerson=r.person;b.dataset.personIdentity=r.eval('buyerActionIdentity(fixtureCandidate,fixturePerson,true)');r.dom.window.document.getElementById('customer-pipeline').replaceChildren(b);return b;};
  r.c.renderPipeline=render;r.c.refreshResearchBriefViews=()=>{};
  for(const fn of ['renderStatus','renderTargetList','renderSearchPreferences','renderDiscoveryFunnel','renderCandidates','renderPotentialMatches'])r.c[fn]=()=>{};
  install(r,'renderAll');r.eval('discoveryMounted=true;qualificationDisplay.read(qualificationContext(),{domain:"company.example"},{});');
  const prior=render();assert.equal(r.c.buyerControlTargetCurrent(prior),true);
  // Matching CRM data adds the same already-displayed public profile as its
  // provider alias. The card must repaint; exact stale-action guards stay strict.
  r.person.publicLinkedinUrl='https://www.linkedin.com/in/avery-buyer';render();
  r.b.listCrmCompanies=async()=>({ok:true,companies:[{id:'company',normalized_domain:r.candidate.domain}]});
  r.b.getCrmCompany=async()=>r.detail([r.contact({linkedin_url:r.person.publicLinkedinUrl})]);
  install(r,'refreshCrmState');await r.c.refreshCrmState();
  assert.equal(r.person.linkedin_url,r.person.publicLinkedinUrl,'actual CRM hydration fills the matching profile alias');
  const current=r.dom.window.document.querySelector('[data-keep-buyer]');
  assert.equal(r.c.buyerControlTargetCurrent(current),true,'company scoring must not leave an enabled stale buyer card');
  const completed=r.calls.filter(event=>event?.type==='leadintel:crm-refreshed');assert.equal(completed.length,1);assert.equal(completed[0].detail.workspaceId,'w');assert.equal(r.eval('crmRefreshing'),false,'the refresh owner releases before downstream revalidation');
  r.person.name='Different Buyer';assert.equal(r.c.buyerControlTargetCurrent(current),false,'genuine identity changes remain blocked');
 }finally{pending.resolve([]);await new Promise(resolve=>setTimeout(resolve,10));r.close();}
});
test('a failed CRM read does not advertise completed hydration',async()=>{
 const r=runtime();try{r.eval('discoveryMounted=true');r.b.listCrmCompanies=async()=>({ok:false});install(r,'refreshCrmState');assert.equal(await r.c.refreshCrmState(),false);assert.equal(r.calls.some(event=>event?.type==='leadintel:crm-refreshed'),false);assert.equal(r.eval('crmRefreshing'),false);}finally{r.close();}
});
