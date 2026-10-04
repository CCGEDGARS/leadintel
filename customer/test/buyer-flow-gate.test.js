const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function harness({kept=true,verified=true,synced=true}={}){
 const person={id:'public-second',name:'Anna Buyer',title:'COO',kept,publicLinkedinUrl:'https://linkedin.com/in/anna'};
 const candidate={company:'Example',domain:'example.com',people:[person]};let meta={},events=[],checks=0,focused=0;
 const ctx={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc:String,enrichmentResults:new Map(),enrichmentPending:new Set(),personKey:()=>person.id,discovery:{selectedProspects:[candidate]},crmAuthenticated:()=>true,crmCompanyByDomain:()=>({id:'c1'}),bridge:()=>({workspace:{id:'w1'},getCrmCompany:async()=>{checks++;return {ok:true,contacts:[{id:'contact-other',name:'Other Buyer',email_status:'verified',work_email:'other@example.com'},{id:'contact-anna',external_person_id:person.id,name:person.name,linkedin_url:person.publicLinkedinUrl,email_status:verified?'verified':'public_unverified',work_email:'anna@example.com'}]};},saveNow:async()=>({saved:synced})}),loadMeta:()=>meta,saveMeta:value=>{meta=value;},saveDiscovery(){},renderAll(){},loadOutreachModules(){},showToast(){},window:{dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail;}},button:{closest:()=>({querySelector:()=>({scrollIntoView(){},focus(){focused++;}})})}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function verifiedBuyerEmail('),source.indexOf('function prospectContactControls(')),ctx);
 return {ctx,person,candidate,get meta(){return meta;},get events(){return events;},get checks(){return checks;},get focused(){return focused;}};
}
test('single next action requires save and a verified business email, not public listings or Gmail',()=>{
 const h=harness({kept:false});assert.match(h.ctx.buyerNextAction(h.candidate,h.person,0,'selected'),/disabled/);
 assert.equal(h.ctx.verifiedBuyerEmail(h.candidate,h.person,{work_email:'anna@example.com',email_status:'public_unverified'}),'');
 assert.equal(h.ctx.verifiedBuyerEmail(h.candidate,h.person,{work_email:'anna@gmail.com',email_status:'verified'}),'');
 h.person.kept=true;h.ctx.enrichmentResults.set(h.person.id,{contact:{work_email:'anna@example.com',email_status:'verified'}});
 assert.match(h.ctx.buyerNextAction(h.candidate,h.person,0,'selected'),/Add to flow →/);
});
test('unverified saved buyer is directed to Confirm email without opening Scripts',async()=>{
 const h=harness({verified:false});assert.equal(await h.ctx.addBuyerToFlow('example.com',0,{button:h.ctx.button}),false);assert.equal(h.focused,1);assert.equal(h.events.length,0);
});
test('verified handoff preserves the exact contact and persists selection without sending',async()=>{
 const h=harness();assert.equal(await h.ctx.addBuyerToFlow('example.com',0),true);assert.equal(h.meta.scriptBuyer.personId,'public-second');assert.equal(h.meta.scriptBuyer.contactId,'contact-anna');assert.equal(h.person.flowSelected,true);assert.equal(h.events[0].type,'leadintel:buyer-for-scripts');
});
test('unsaved and failed-sync selections cannot open the next step',async()=>{
 const unsaved=harness({kept:false});assert.equal(await unsaved.ctx.addBuyerToFlow('example.com',0),false);assert.equal(unsaved.checks,0);
 const failed=harness({synced:false});assert.equal(await failed.ctx.addBuyerToFlow('example.com',0),false);assert.equal(failed.person.flowSelected,false);assert.equal(failed.events.length,0);
});
test('rendered contact controls have one next action and no enrichment checkboxes',()=>{
 const block=source.slice(source.indexOf('function prospectContactControls('),source.indexOf('async function findPublicProspectContacts('));
 assert.match(block,/buyer-four-actions/);assert.doesNotMatch(block,/buyerNextAction/);assert.doesNotMatch(block,/contactFlowControls/);assert.match(block,/Phone and LinkedIn confirmation are optional/);
 const outreach=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');assert.match(outreach,/find\(p=>p.id===choice\?\.personId\)/);assert.match(outreach,/if\(crmAuthenticated\(\)&&\(!handoffContact/);
});
test('pending identity and changed buying roles cannot open Messages even with a verified email',async()=>{
 for(const state of ['identity','roles']){
  const h=harness();if(state==='identity')h.person.identityStatus='pending';else h.candidate.buyerRolesChanged=true;
  assert.equal(h.ctx.verifiedBuyerEmail(h.candidate,h.person,{work_email:'anna@example.com',email_status:'verified'}),'');
  assert.equal(await h.ctx.addBuyerToFlow('example.com',0,{button:h.ctx.button}),false);assert.equal(h.events.length,0);
 }
});
test('navigation enables Messages only for a saved buyer with a verified company email',()=>{
 const h=harness();vm.runInContext(source.slice(source.indexOf('function readyBuyerCount('),source.indexOf('function syncBuyerStageNavigation(')),h.ctx);
 assert.equal(h.ctx.readyBuyerCount([h.candidate]),0);
 h.ctx.enrichmentResults.set(h.person.id,{contact:{work_email:'anna@gmail.com',email_status:'verified'}});assert.equal(h.ctx.readyBuyerCount([h.candidate]),0);
 h.ctx.enrichmentResults.set(h.person.id,{contact:{work_email:'anna@example.com',email_status:'verified'}});assert.equal(h.ctx.readyBuyerCount([h.candidate]),1);
 h.person.kept=false;assert.equal(h.ctx.readyBuyerCount([h.candidate]),0);
});
test('a recorded identity conflict blocks a verified-email handoff until resolved',async()=>{
 const h=harness();h.candidate.publicResearch={conflicts:[{person_id:h.person.id,reason:'Employer attribution conflict'}]};
 assert.equal(await h.ctx.addBuyerToFlow('example.com',0,{button:h.ctx.button}),false);assert.equal(h.events.length,0);
});
test('a legacy verified label without attributable provider evidence cannot open Messages',async()=>{const h=harness();h.ctx.window.LeadIntelContactPolicy=require('../contact-confirmation-policy.js');const legacy={name:h.person.name,work_email:'anna@example.com',email_status:'verified',source:'public_research'};assert.equal(h.ctx.verifiedBuyerEmail(h.candidate,h.person,legacy),'');assert.equal(h.ctx.verifiedBuyerEmail(h.candidate,h.person,{...legacy,verification_provider:'Apollo'}),'anna@example.com');assert.equal(await h.ctx.addBuyerToFlow('example.com',0),false);assert.equal(h.events.length,0);});
