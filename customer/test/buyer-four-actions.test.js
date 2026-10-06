const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function runtime(automatic=false){
 const person={id:'public-anna',name:'Anna Andersson',title:'COO',publicLinkedinUrl:'https://linkedin.com/in/anna'},candidate={domain:'example.com',people:[person]};
 const context={window:{LeadIntelOutreachAutomationUI:{getPolicy:()=>({preferredMode:automatic?'automatic':'manual'})}},document:{querySelector:()=>null},LeadIntelDiscovery:D,selectedBuyerKey:()=>person.id,personKey:()=>person.id,enrichmentResults:new Map(),enrichmentPending:new Set(),buyerSelectionPending:new Set(),loadMeta:()=>({}),$:()=>null,currentJourneyFocus:()=>'buyers',buyerSelectionRows:()=>[candidate],esc:String,crmAuthenticated:()=>true,canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'w1'}})};
 vm.createContext(context);const start=source.indexOf('function buyerAutomaticMode('),end=source.indexOf('async function findPublicProspectContacts(',start);vm.runInContext(source.slice(start,end),context);
 return {context,person,candidate};
}
test('manual buyer card presents four actions and no per-card next action',()=>{
 const {context,person,candidate}=runtime(),html=context.prospectContactControls(candidate,person);
 assert.equal((html.match(/<button /g)||[]).length,4);for(const label of ['Confirm email','Confirm phone','Confirm LinkedIn','Select &amp; proceed'])assert.ok(html.includes(label));
 assert.ok(!html.includes('data-save-buyer-only'));assert.ok(!html.includes('data-buyer-next'));assert.ok(!html.includes('Clarify data'));
});
test('automatic email confirmation is selected and locked without claiming mailbox verification',()=>{
 const {context,person,candidate}=runtime(true),html=context.prospectContactControls(candidate,person);assert.match(html,/aria-pressed="false"[^>]*disabled[^>]*>Confirm email/);assert.match(html,/verification is required/);
});
test('LinkedIn confirmation applies only to the reviewed exact profile',()=>{
 const {context,person}=runtime();person.linkedinConfirmedUrl=person.publicLinkedinUrl;assert.equal(context.buyerLinkedInStatus(person),'Manually reviewed');person.publicLinkedinUrl='https://linkedin.com/in/another';assert.equal(context.buyerLinkedInStatus(person),'Public match');
});
test('LinkedIn review confirmation survives workspace state normalization',()=>{
 const value=D.normalizeDiscoveryState({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{name:'Anna Andersson',linkedinConfirmedUrl:'https://linkedin.com/in/anna',linkedinConfirmedAt:'2026-10-04T08:00:00Z'}]}]});assert.equal(value.selectedProspects[0].people[0].linkedinConfirmedUrl,'https://linkedin.com/in/anna');
});
test('LinkedIn confirmation records CRM evidence and rolls back the UI state on failed sync',async()=>{
 for(const synced of [true,false]){
  const {context,person,candidate}=runtime();const activities=[];
  Object.assign(context,{Date,ensureCrmCompany:async()=>({id:'company'}),bridge:()=>({workspace:{id:'w1'},saveCrmContacts:async()=>({ok:true}),recordCrmActivity:async(_,activity)=>{activities.push(activity);return {ok:activity.type==='contact.linkedin_confirmed',error:'Unsupported CRM activity type'};},saveNow:async()=>({saved:synced})}),saveDiscovery(){},renderAll(){}});context.window.LeadIntelCrm={mapContacts:()=>[]};
  if(synced){assert.equal(await context.saveBuyerLinkedInReview(candidate,person,person.publicLinkedinUrl,'w1'),true);assert.equal(person.linkedinConfirmedUrl,person.publicLinkedinUrl);}
  else{await assert.rejects(context.saveBuyerLinkedInReview(candidate,person,person.publicLinkedinUrl,'w1'),/could not be synced/);assert.equal(person.linkedinConfirmedUrl,undefined);}
  assert.equal(activities[0].metadata.linkedin_url,person.publicLinkedinUrl);
 }
});
test('stale workspace/profile review cannot confirm a changed match',async()=>{
 const {context,person,candidate}=runtime();context.bridge=()=>({workspace:{id:'w2'}});
 await assert.rejects(context.saveBuyerLinkedInReview(candidate,person,person.publicLinkedinUrl,'w1'),/Workspace changed/);
 await assert.rejects(context.saveBuyerLinkedInReview(candidate,person,'https://linkedin.com/in/other','w2'),/Profile changed/);
});

test('save and proceed stays disabled until verified company email exists',()=>{
 const {context,person,candidate}=runtime();
 assert.match(context.prospectContactControls(candidate,person),/data-keep-buyer[^>]*disabled>Select &amp; proceed/);
 context.enrichmentResults.set(person.id,{contact:{work_email:'anna@example.com',email_status:'verified'}});
 assert.doesNotMatch(context.prospectContactControls(candidate,person),/data-keep-buyer[^>]*disabled/);
 context.enrichmentResults.set(person.id,{contact:{work_email:'anna@gmail.com',email_status:'verified'}});
 assert.match(context.prospectContactControls(candidate,person),/data-keep-buyer[^>]*disabled/);
});
test('save and proceed awaits save, stops on failure and never toggles an already saved buyer',async()=>{
 for(const kept of [false,true])for(const saved of [false,true]){
  const {context,person,candidate}=runtime();person.kept=kept;const calls=[];
  Object.assign(context,{discovery:{selectedProspects:[candidate]},showToast(){},renderAll(){},keepBuyer:async()=>{calls.push('save');return saved;},addBuyerToFlow:async()=>{calls.push('proceed');return true;}});
  context.enrichmentResults.set(person.id,{contact:{work_email:'anna@example.com',email_status:'verified'}});
  const result=await context.saveBuyerAndProceed('example.com',0);
  assert.deepEqual(calls,kept?['proceed']:saved?['save','proceed']:['save']);assert.equal(result,kept||saved);
 }
});

test('explicit automatic selection overrides a retained manual policy for email controls',()=>{
 const {context,person,candidate}=runtime(false);context.document.querySelector=()=>({value:'automatic'});
 assert.match(context.prospectContactControls(candidate,person),/aria-pressed="false"[^>]*disabled[^>]*>Confirm email/);
});

test('ranked display copies keep actions attached to the original buyer index',()=>{
 const {context,person,candidate}=runtime();
 candidate.people.unshift({id:'other',name:'Other Buyer'});
 const html=context.prospectContactControls(candidate,{...person,buyerRelevanceScore:100});
 assert.equal((html.match(/data-person-index="1"/g)||[]).length,4);
 assert.doesNotMatch(html,/data-person-index="-1"/);
});

test('confirmed LinkedIn never unlocks the email proceed button or email/phone confirmation',async()=>{
 const {context,person,candidate}=runtime();person.linkedinConfirmedUrl=person.publicLinkedinUrl;
 const html=context.prospectContactControls(candidate,person);
 assert.match(html,/data-keep-buyer[^>]*disabled>Select &amp; proceed/);
 assert.match(html,/class="secondary-btn small buyer-confirm-needed"[^>]*data-prospect-enrich-email/);
 assert.doesNotMatch(html,/data-prospect-enrich-email[^>]*aria-pressed="true"/);
 Object.assign(context,{discovery:{selectedProspects:[candidate]},showToast(){},renderAll(){},saveBuyerLinkedInReview:async()=>{throw Error('LinkedIn must stay separate');},startLinkedInBuyerMessage:async()=>{throw Error('LinkedIn must stay separate');}});
 assert.equal(await context.saveBuyerAndProceed('example.com',0),false);
});
test('only an eligible email makes proceed green; pending and phone do not',()=>{
 const {context,person,candidate}=runtime();
 context.enrichmentResults.set(person.id,{contact:{work_email:'anna@example.com',email_status:'verified',phone_number:'+37112345678'}});
 assert.match(context.prospectContactControls(candidate,person),/class="primary-btn small buyer-proceed-ready"[^>]*data-keep-buyer/);
 context.enrichmentPending.add(person.id);
 assert.match(context.prospectContactControls(candidate,person),/data-keep-buyer[^>]*disabled/);
 context.enrichmentResults.set(person.id,{contact:{phone_number:'+37112345678'}});context.enrichmentPending.clear();
 assert.match(context.prospectContactControls(candidate,person),/data-keep-buyer[^>]*disabled/);
});

test('proceed keeps its label through ready, selecting and selected states with a separate check',()=>{
 const {context,person,candidate}=runtime();
 context.enrichmentResults.set(person.id,{contact:{work_email:'anna@example.com',email_status:'verified'}});
 for(const state of ['ready','selecting','selected']){
  context.buyerSelectionPending.clear();
  context.loadMeta=()=>state==='selected'?{selectedEmailBuyer:{workspaceId:'w1',domain:candidate.domain,personId:person.id}}:{};
  if(state==='selecting')context.buyerSelectionPending.add(person.id);
  const html=context.prospectContactControls(candidate,person);
  assert.match(html,/data-keep-buyer[^>]*>Select &amp; proceed/);
  assert.doesNotMatch(html,/Selected ✓ · Continue below|Selecting…/);
  if(state==='selected')assert.match(html,/data-buyer-selection-check/);
 }
});

test('unconfirmed public listing cannot unlock proceed even under public confirmation policy',()=>{
 const {context,person,candidate}=runtime();context.window.LeadIntelContactPolicy=require('../contact-confirmation-policy.js');
 vm.runInContext("buyerConfirmationLevel='public_confirmed';confirmationPolicyWorkspace='w1';",context);
 person.publicEmail='anna@example.com';person.publicEmailUrl='https://example.com/team';
 assert.match(context.prospectContactControls(candidate,person),/data-keep-buyer[^>]*disabled/);
});

test('Confirm LinkedIn opens review even for an already verified buyer and waits for Proceed',async()=>{
 const person={id:'p1',name:'Sam Buyer',organization:'Example',title:'Procurement Director',linkedin_url:'https://linkedin.com/in/sam',linkedinConfirmedUrl:'https://linkedin.com/in/sam'},candidate={domain:'example.com',company:'Example',people:[person]};let dialogs=0,starts=0;const handlers={};const dialog={querySelector:selector=>({addEventListener:(_,f)=>{handlers[selector]=f;},value:'',textContent:''}),close(){}};
 const ctx={discovery:{selectedProspects:[candidate]},LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'w1'}}),buyerReviewDialog:()=>{dialogs++;return dialog;},esc:String,crmAuthenticated:()=>true,saveBuyerLinkedInReview:async()=>true,startLinkedInBuyerMessage:async()=>{starts++;return true;},showToast(){}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function reviewBuyerLinkedIn('),source.indexOf('function selectedEmailBuyer(')),ctx);await ctx.reviewBuyerLinkedIn(candidate.domain,0);assert.equal(dialogs,1);assert.equal(starts,0);await handlers['[data-review-message]']({target:{disabled:false}});assert.equal(starts,1);
});
