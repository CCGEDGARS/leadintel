const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function runtime(automatic=false){
 const person={id:'public-anna',name:'Anna Andersson',title:'COO',publicLinkedinUrl:'https://linkedin.com/in/anna'},candidate={domain:'example.com',people:[person]};
 const context={window:{LeadIntelOutreachAutomationUI:{getPolicy:()=>({preferredMode:automatic?'automatic':'manual'})}},document:{querySelector:()=>null},LeadIntelDiscovery:D,selectedBuyerKey:()=>person.id,personKey:()=>person.id,enrichmentResults:new Map(),enrichmentPending:new Set(),buyerSelectionPending:new Set(),loadMeta:()=>({}),$:()=>null,currentJourneyFocus:()=>'buyers',buyerSelectionRows:()=>[candidate],esc:String,crmAuthenticated:()=>true,canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'w1'}})};
 vm.createContext(context);const start=source.indexOf('function buyerAutomaticMode('),end=source.indexOf('async function findPublicProspectContacts(',start);vm.runInContext(source.slice(start,end),context);
 return {context,person,candidate};
}
test('a saved profile update stays green without misrepresenting email verification or unlocking outreach',()=>{
 const {context,person,candidate}=runtime();
 person.contactData={version:1,domain:candidate.domain,personId:person.id,status:'updated',checkedAt:'2026-10-21T18:00:00Z',profile:{status:'provider_reported',city:'Riga'},phone:{status:'not_requested'}};
 const html=context.prospectContactControls(candidate,person);
 assert.match(html,/class="[^"]*buyer-confirm-needed[^"]*"[^>]*data-prospect-enrich-email[^>]*>E-mail/);
 assert.match(html,/data-prospect-enrich-email[^>]*aria-pressed="false"/);
 assert.match(html,/data-keep-buyer[^>]*disabled/);
});
test('manual buyer card presents four actions and no per-card next action',()=>{
 const {context,person,candidate}=runtime(),html=context.prospectContactControls(candidate,person);
 assert.equal((html.match(/<button /g)||[]).length,4);for(const label of ['E-mail','Phone','Recheck','Proceed'])assert.ok(html.includes(label));
 assert.ok(!html.includes('data-save-buyer-only'));assert.ok(!html.includes('data-buyer-next'));assert.ok(!html.includes('Clarify data'));
});
test('automatic workflow still allows explicit manual data confirmation without claiming verification',()=>{
 const {context,person,candidate}=runtime(true),html=context.prospectContactControls(candidate,person);assert.match(html,/aria-pressed="false"[^>]*>E-mail/);assert.match(html,/confirmed company or personal email/);
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
 assert.match(context.prospectContactControls(candidate,person),/data-keep-buyer[^>]*disabled>Proceed/);
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
 assert.match(context.prospectContactControls(candidate,person),/aria-pressed="false"[^>]*>E-mail/);
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
 assert.match(html,/data-keep-buyer[^>]*disabled>Proceed/);
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
  assert.match(html,/data-keep-buyer[^>]*>Proceed/);
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

test('Recheck opens review even for an already verified buyer and waits for Proceed',async()=>{
 const person={id:'p1',name:'Sam Buyer',organization:'Example',title:'Procurement Director',linkedin_url:'https://linkedin.com/in/sam',linkedinConfirmedUrl:'https://linkedin.com/in/sam'},candidate={domain:'example.com',company:'Example',people:[person]};let dialogs=0,starts=0;const handlers={};const dialog={querySelector:selector=>({addEventListener:(_,f)=>{handlers[selector]=f;},value:'',textContent:''}),close(){}};
 const ctx={discovery:{selectedProspects:[candidate]},LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'w1'}}),buyerReviewDialog:()=>{dialogs++;return dialog;},esc:String,crmAuthenticated:()=>true,saveBuyerLinkedInReview:async()=>true,startLinkedInBuyerMessage:async()=>{starts++;return true;},showToast(){}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function reviewBuyerLinkedIn('),source.indexOf('function selectedEmailBuyer(')),ctx);await ctx.reviewBuyerLinkedIn(candidate.domain,0);assert.equal(dialogs,1);assert.equal(starts,0);await handlers['[data-review-message]']({target:{disabled:false}});assert.equal(starts,1);
});


test('confirmed email keeps green eligibility while E-mail remains available',()=>{
 const {JSDOM}=require('jsdom');
 for(const automatic of [false,true]){
  const {context,person,candidate}=runtime(automatic);
  context.window.LeadIntelAdditionalContacts={label:()=> 'Find email with additional services'};
  let dom=new JSDOM(context.prospectContactControls(candidate,person));
  assert.equal(dom.window.document.querySelector('[data-prospect-enrich-email]').textContent,'E-mail');dom.window.close();
  context.window.LeadIntelContactPolicy=require('../contact-confirmation-policy.js');
  vm.runInContext("buyerConfirmationLevel='public_confirmed';confirmationPolicyWorkspace='w1';",context);
  const saved=JSON.parse(JSON.stringify({name:person.name,work_email:'anna@example.com',email_status:'public_confirmed',verification_provider:'Public source',public_email_url:'https://example.com/team',verified_at:new Date().toISOString()}));
  context.enrichmentResults.set(person.id,{contact:saved});
  dom=new JSDOM('<style>'+fs.readFileSync(require.resolve('../discovery.css'),'utf8')+'</style>'+context.prospectContactControls(candidate,person));
  const button=dom.window.document.querySelector('[data-prospect-enrich-email]');
  assert.equal(button.textContent,'E-mail');assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(dom.window.getComputedStyle(button).backgroundColor,'rgb(13, 100, 83)');
  assert.equal(dom.window.document.querySelector('[data-keep-buyer]').disabled,false);dom.window.close();
 }
});
test('an unconfirmed public address or another person’s saved email never paints this buyer green',()=>{
 const {context,person,candidate}=runtime();person.publicEmail='anna@example.com';person.publicEmailUrl='https://example.com/team';
 context.enrichmentResults.set('different-person',{contact:{work_email:'other@example.com',email_status:'verified'}});
 const html=context.prospectContactControls(candidate,person);
 assert.match(html,/data-prospect-enrich-email[^>]*>E-mail<\/button>/);
 assert.doesNotMatch(html,/buyer-email-confirmed|>Email confirmed</);
});

test('E-mail stays available after email confirmation and data-updated never grants an email recipient',()=>{
 const {context,person,candidate}=runtime();context.enrichmentResults.set(person.id,{contact:{work_email:'anna@example.com',email_status:'verified'}});
 let html=context.prospectContactControls(candidate,person);assert.match(html,/data-prospect-enrich-email[^>]*>E-mail/);assert.doesNotMatch(html,/data-prospect-enrich-email[^>]*disabled/);
 context.enrichmentResults.clear();person.contactData={status:'updated',profile:{city:'Riga'}};html=context.prospectContactControls(candidate,person);assert.match(html,/data-prospect-enrich-email[^>]*>E-mail/);assert.match(html,/data-keep-buyer[^>]*disabled/);assert.doesNotMatch(html,/data-prospect-enrich-email[^>]*aria-pressed="true"/);
});

test('sync-blocked buyer controls expose a working recovery action without enabling research or proceeding',()=>{
 const {JSDOM}=require('jsdom'),{context,person,candidate}=runtime();
 context.bridge=()=>({workspace:{id:'w1'},conflict:true});const doc=new JSDOM(context.prospectContactControls(candidate,person)).window.document;
 for(const selector of ['[data-prospect-enrich-email]','[data-prospect-enrich-phone]','[data-recheck-buyer]','[data-keep-buyer]'])assert.equal(doc.querySelector(selector).disabled,true);
 const review=doc.querySelector('[data-review-buyer-sync]');assert.ok(review);assert.equal(review.disabled,false);
 let handler,opens=0;context.$=()=>({addEventListener:(_name,fn)=>{handler=fn;}});context.window.LeadIntelAttention={open(){opens++;}};
 vm.runInContext(source.split('\n').find(line=>line.includes('$("customer-pipeline")?.addEventListener("click"')&&line.includes('data-review-buyer-sync')),context);
 handler({target:review});assert.equal(opens,1);
 context.bridge=()=>({workspace:{id:'w1'},conflict:false});assert.doesNotMatch(context.prospectContactControls(candidate,person),/data-review-buyer-sync/);
});

test('a rendered email button routes by stable ID even when its old array position belongs to another buyer',()=>{
 const {JSDOM}=require('jsdom'),{context,person,candidate}=runtime();
 const doc=new JSDOM(context.prospectContactControls(candidate,person)).window.document,button=doc.querySelector('[data-prospect-enrich-email]');
 assert.equal(button.dataset.personId,person.id);candidate.people.unshift({id:'klas',name:'Klas Buyer'});
 let handler,request;context.discovery={selectedProspects:[candidate]};context.$=()=>({addEventListener:(_name,fn)=>{handler=fn;}});context.confirmBuyerContact=(c,index,options)=>{request={c,index,options};};
 vm.runInContext(source.split('\n').find(line=>line.includes('$("customer-pipeline")?.addEventListener("click"')&&line.includes('prospectEnrichEmail')),context);
 handler({target:button});assert.equal(request.options.personId,person.id);assert.equal(request.options.kind,'email');assert.notEqual(candidate.people[request.index].id,person.id);
});
