const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function harness({kept=true,verified=true,synced=true}={}){
 const person={id:'public-second',name:'Anna Buyer',organization:'Example',title:'COO',kept,publicLinkedinUrl:'https://linkedin.com/in/anna'};
 const candidate={company:'Example',domain:'example.com',people:[person]};let meta={},events=[],checks=0,focused=0;
 const ctx={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc:String,enrichmentResults:new Map(),enrichmentPending:new Set(),buyerSelectionPending:new Set(),$:()=>null,buyerSelectionRows:()=>[candidate],currentJourneyFocus:()=>'buyers',personKey:()=>person.id,discovery:{selectedProspects:[candidate]},crmAuthenticated:()=>true,crmCompanyByDomain:()=>({id:'c1'}),bridge:()=>({workspace:{id:'w1'},getCrmCompany:async()=>{checks++;return {ok:true,contacts:[{id:'contact-other',name:'Other Buyer',email_status:'verified',work_email:'other@example.com'},{id:'contact-anna',external_person_id:person.id,name:person.name,linkedin_url:person.publicLinkedinUrl,email_status:verified?'verified':'public_unverified',work_email:'anna@example.com'}]};},saveNow:async()=>({saved:synced})}),loadMeta:()=>meta,saveMeta:value=>{meta=value;},saveDiscovery(){},renderAll(){},loadOutreachModules(){},showToast(){},window:{dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail;}},button:{closest:()=>({querySelector:()=>({scrollIntoView(){},focus(){focused++;}})})}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function selectedEmailBuyer('),source.indexOf('let buyerConfirmationLevel=')),ctx);vm.runInContext(source.slice(source.indexOf('function verifiedBuyerEmail('),source.indexOf('function prospectContactControls(')),ctx);
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
 assert.match(block,/buyer-four-actions/);assert.doesNotMatch(block,/buyerNextAction/);assert.doesNotMatch(block,/contactFlowControls/);assert.match(block,/Phone is optional/);
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

test('stale/future employment and wrong employers cannot proceed on a verified email',async()=>{
 for(const update of [{identityEvidenceDate:'2013-05-01'},{identityEvidenceDate:'2099-01-01'},{organization:'Other'}]){
  const h=harness();Object.assign(h.person,update);
  assert.equal(h.ctx.verifiedBuyerEmail(h.candidate,h.person,{work_email:'anna@example.com',email_status:'verified'}),'');
  assert.equal(await h.ctx.addBuyerToFlow('example.com',0),false);assert.equal(h.events.length,0);assert.notEqual(h.person.flowSelected,true);
 }
});

test('LinkedIn handoff needs exact profile confirmation and qualification, but no email',async()=>{
 const h=harness({verified:false});h.person.linkedinConfirmedUrl=h.person.publicLinkedinUrl;
 h.ctx.ensureCrmCompany=async()=>({id:'c1'});
 assert.equal(await h.ctx.startLinkedInBuyerMessage('example.com',0),true);
 assert.equal(h.meta.scriptBuyer.channel,'linkedin');assert.equal(h.meta.scriptBuyer.personId,h.person.id);assert.equal(h.meta.scriptBuyer.linkedinUrl,h.person.publicLinkedinUrl);
 assert.equal(h.events.length,1);assert.equal(h.events[0].type,'leadintel:buyer-for-scripts');
});
test('LinkedIn profile changes, holds and failed persistence stop message creation',async()=>{
 for(const mode of ['changed','hold','stale','failed-sync']){
  const h=harness({verified:false,synced:mode!=='failed-sync'});h.person.linkedinConfirmedUrl=h.person.publicLinkedinUrl;h.ctx.ensureCrmCompany=async()=>({id:'c1'});
  if(mode==='changed')h.person.publicLinkedinUrl='https://linkedin.com/in/different-person';
  if(mode==='hold')h.person.opportunityScope={status:'review_required',reason:'Different subsidiary'};
  if(mode==='stale')h.person.identityEvidenceDate='2013-01-01';
  assert.equal(await h.ctx.startLinkedInBuyerMessage('example.com',0),false);assert.equal(h.events.length,0);
 }
});
test('LinkedIn selection cannot cross workspaces or enter email delivery',()=>{
 const h=harness({verified:false});h.person.linkedinConfirmedUrl=h.person.publicLinkedinUrl;
 const choice={domain:h.candidate.domain,personId:h.person.id,linkedinUrl:h.person.linkedinConfirmedUrl,workspaceId:'w1'};
 assert.equal(D.confirmedLinkedInBuyer(h.person,h.candidate,choice,'w1'),true);assert.equal(D.confirmedLinkedInBuyer(h.person,h.candidate,choice,'w2'),false);
 const O=require('../outreach-engine.js');const saved=O.normalizeOutreachState({items:[{domain:'example.com',channel:'linkedin',selectedPersonId:h.person.id,drafts:{linkedinMessage:'Hello Anna'}}]}).items[0];assert.equal(saved.channel,'linkedin');assert.equal(saved.selectedPersonId,h.person.id);
 assert.equal(O.buildApprovedSendPayload({...saved,approved:true}),null);assert.equal(O.approveOutreachItem(saved,{}).approved,false);
});

test('Select & proceed saves the exact email recipient and opens Content Creation immediately',async()=>{
 const h=harness();h.ctx.enrichmentResults.set(h.person.id,{contact:{work_email:'anna@example.com',email_status:'verified'}});
 assert.equal(await h.ctx.saveBuyerAndProceed('example.com',0),true);
 assert.equal(h.meta.selectedEmailBuyer.personId,h.person.id);assert.equal(h.meta.selectedEmailBuyer.contactId,'contact-anna');
 assert.equal(h.meta.selectedEmailBuyer.email,'anna@example.com');assert.equal(h.meta.activeJourneyStage,6);assert.equal(h.meta.scriptBuyer.personId,h.person.id);assert.equal(h.events.length,1);
 assert.equal(h.ctx.enrichmentPending.size,0);assert.equal(h.ctx.buyerSelectionPending.size,0);
});
test('selecting a second recipient clears the first active flag while keeping both contacts',async()=>{
 const h=harness();const other={...h.person,id:'first',name:'Previous Buyer',kept:true,flowSelected:true};h.candidate.people.push(other);
 assert.equal(await h.ctx.addBuyerToFlow('example.com',0,{selectOnly:true}),true);
 assert.equal(other.flowSelected,false);assert.equal(other.kept,true);assert.equal(h.person.flowSelected,true);
});
test('failed selection restores the previous recipient and never advances the stage',async()=>{
 const h=harness({synced:false});h.ctx.saveMeta({selectedEmailBuyer:{personId:'previous'},activeJourneyStage:5});
 assert.equal(await h.ctx.addBuyerToFlow('example.com',0,{selectOnly:true}),false);
 assert.equal(h.meta.selectedEmailBuyer.personId,'previous');assert.equal(h.meta.activeJourneyStage,5);assert.equal(h.events.length,0);
});
test('sync conflicts block selection before any CRM lookup or progress handoff',async()=>{
 const h=harness(),original=h.ctx.bridge;h.ctx.bridge=()=>({...original(),conflict:true});
 assert.equal(await h.ctx.saveBuyerAndProceed('example.com',0),false);assert.equal(h.checks,0);assert.equal(h.events.length,0);assert.equal(h.meta.selectedEmailBuyer,undefined);
});
test('opening Content Creation waits until its listener has loaded',async()=>{
 const h=harness();let release;h.ctx.loadOutreachModules=()=>new Promise(resolve=>{release=resolve;});
 const running=h.ctx.addBuyerToFlow('example.com',0);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.events.length,0);release();assert.equal(await running,true);assert.equal(h.events.length,1);
});
test('selected recipient is invalidated by a workspace change or revoked email',async()=>{
 const h=harness();await h.ctx.addBuyerToFlow('example.com',0,{selectOnly:true});assert.equal(h.ctx.selectedEmailBuyer().person.id,h.person.id);
 h.ctx.enrichmentResults.clear();assert.equal(h.ctx.selectedEmailBuyer(),null);
});

test('Continue to messages revalidates and opens only the explicitly selected contact',async()=>{
 const h=harness();await h.ctx.addBuyerToFlow('example.com',0,{selectOnly:true});
 assert.equal(h.events.length,0);assert.equal(await h.ctx.continueBuyerMessages(),true);
 assert.equal(h.events.length,1);assert.equal(h.events[0].detail.personId,h.person.id);assert.equal(h.events[0].detail.contactId,'contact-anna');
});
test('selection bridge scrolls and focuses the highlighted footer with the recipient email',async()=>{
 const h=harness();await h.ctx.addBuyerToFlow('example.com',0,{selectOnly:true});let scrolls=0,focus=0;
 const footer={hidden:true},status={},gate={dataset:{},setAttribute(){},classList:{toggle(){}},closest:()=>footer,scrollIntoView(){scrolls++;},focus(){focus++;}};
 h.ctx.$=id=>id==='continue-to-outreach'?gate:id==='selected-email-recipient'?status:null;
 h.ctx.renderSelectedEmailBuyer({scroll:true});assert.equal(gate.disabled,false);assert.equal(footer.hidden,false);assert.match(status.textContent,/Anna Buyer.*anna@example.com/);assert.equal(scrolls,1);assert.equal(focus,1);
});

test('sync conflict keeps confirmed email evidence but disables proceed until ready',async()=>{
 const h=harness(),original=h.ctx.bridge;h.ctx.bridge=()=>({...original(),conflict:true});
 h.ctx.selectedBuyerKey=()=>h.person.id;h.ctx.buyerAutomaticMode=()=>false;
 h.ctx.enrichmentResults.set(h.person.id,{contact:{work_email:'anna@example.com',email_status:'verified'}});
 vm.runInContext(source.slice(source.indexOf('function prospectContactControls('),source.indexOf('async function findPublicProspectContacts(')),h.ctx);
 const html=h.ctx.prospectContactControls(h.candidate,h.person);
 assert.doesNotMatch(html,/primary-btn small buyer-proceed-ready/);assert.match(html,/Company email is ready.*synchronization conflict/);
 const proceed=html.match(/<button[^>]*data-keep-buyer[^>]*>/)[0];assert.match(proceed,/disabled/);
 assert.equal(await h.ctx.saveBuyerAndProceed('example.com',0),false);assert.equal(h.ctx.selectedEmailBuyer(),null);assert.equal(h.checks,0);assert.equal(h.events.length,0);
});

test('failed Messages initialization restores Buyers while preserving the saved recipient',async()=>{
 const h=harness();let focus;h.ctx.renderDiscoveryFocus=value=>{focus=value;};h.ctx.loadOutreachModules=async()=>{throw Error('Messages did not initialize');};
 assert.equal(await h.ctx.addBuyerToFlow('example.com',0),false);assert.equal(h.meta.activeJourneyStage,5);assert.equal(h.meta.visibleStep,5);assert.equal(focus,'buyers');assert.equal(h.meta.selectedEmailBuyer.personId,h.person.id);assert.equal(h.person.flowSelected,true);assert.equal(h.events.length,0);
});


test('a capacity failure can reopen only the exact previously saved and freshly verified email message',async()=>{
 const h=harness();assert.equal(await h.ctx.addBuyerToFlow('example.com',0),true);const previous={...h.meta.scriptBuyer};const original=h.ctx.bridge;h.ctx.bridge=()=>({...original(),saveNow:async()=>{throw Error('Workspace exceeds 500 KB sync limit');}});
 assert.equal(await h.ctx.continueBuyerMessages(),true);assert.deepEqual({...h.meta.scriptBuyer},previous);assert.equal(h.events.length,2);assert.equal(h.meta.activeJourneyStage,6);
});
test('capacity failures still block new recipients, select-only changes and revoked confirmations',async()=>{
 for(const mode of ['new','select-only','revoked']){const h=harness();if(mode!=='new')await h.ctx.addBuyerToFlow('example.com',0);const original=h.ctx.bridge;h.ctx.bridge=()=>({...original(),saveNow:async()=>{throw Error('Workspace exceeds 500 KB sync limit');},...(mode==='revoked'?{getCrmCompany:async()=>({ok:true,contacts:[]})}:{})});const before=h.events.length;assert.equal(await h.ctx.addBuyerToFlow('example.com',0,{selectOnly:mode==='select-only'}),false);assert.equal(h.events.length,before);}
});
test('ordinary failed sync never reopens a previously saved message',async()=>{const h=harness();await h.ctx.addBuyerToFlow('example.com',0);const original=h.ctx.bridge;h.ctx.bridge=()=>({...original(),saveNow:async()=>{throw Error('Network request failed');}});assert.equal(await h.ctx.continueBuyerMessages(),false);assert.equal(h.events.length,1);});
