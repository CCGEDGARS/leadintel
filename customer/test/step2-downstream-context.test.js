const test=require('node:test'),assert=require('node:assert/strict');
const Brief=require('../step2-brief-schema.js'),Profile=require('../profile-engine.js'),Discovery=require('../discovery-engine.js'),Outreach=require('../outreach-engine.js');
test('all edited answers update profile and survive reload including explicit clearing',()=>{
 const state={website:'https://seller.example',targetMarkets:['Sweden'],answers:{},profile:{companyName:'Seller',proofPoints:'Old proof'},approved:true};
 for(const id of Brief.FIELD_IDS)state.answers[id]=`updated ${id}`;
 const next=Brief.applyAnswers(state,Brief.FIELD_IDS);assert.deepEqual(Object.fromEntries(Object.keys(Brief.profileFields(state.answers)).map(k=>[k,next.profile[k]])),Brief.profileFields(state.answers));assert.equal(next.approved,false);
 assert.equal(Profile.normalizeSavedState(JSON.parse(JSON.stringify(next))).profile.proofPoints,'updated proof_points');next.answers.proof_points='';assert.equal(Brief.applyAnswers(next,['proof_points']).profile.proofPoints,'');
});
test('exclusions block evidenced violations and retain unknown constraints for review',()=>{
 assert.equal(Discovery.evaluateExclusions({evidence:[{text:'We serve private consumers only',url:'https://buyer.example'}]},'private consumers').status,'excluded');
 assert.equal(Discovery.evaluateExclusions({evidence:[{text:'Manufacturer of furniture',url:'https://buyer.example'}]},'minimum deal €20000; ISO 9001 required').status,'unverified');
 assert.equal(Discovery.evaluateExclusions({},'No specific exclusions').status,'clear');
});
test('approved proof and objections change scripts without inventing prospect concerns',()=>{
 const profile={priorityOffers:'Furniture',proofPoints:'120 completed projects',commonObjections:'Installation downtime',differentiation:'One accountable project team'};
 const d=Outreach.buildOutreachDrafts({company:'Buyer',evidence:[]},{title:'Owner'},profile);
 assert.match(d.emailBody,/120 completed projects/);assert.match(d.objectionReply,/Installation downtime/);assert.match(d.objectionReply,/if|whether/i);assert.match(d.emailBody,/One accountable project team/);
 const empty=Outreach.buildOutreachDrafts({company:'Buyer'}, {}, {});assert.doesNotMatch(empty.emailBody,/120 completed projects/);
});

test('stale script packages cannot be reapproved after commercial edits',()=>{assert.equal(Outreach.approveOutreachItem({contextNeedsRefresh:true},{emailSubject:'Hello',emailBody:'Old offer',linkedinMessage:'Old message'}).approved,false);});

test('requirements are checked against evidence rather than treated as banned words',()=>{
 assert.equal(Discovery.evaluateExclusions({evidence:[{text:'ISO 9001 certified. Project budget €50,000.'}]},'ISO 9001 certification required; projects below €20,000').status,'clear');
 assert.equal(Discovery.evaluateExclusions({evidence:[{text:'Project budget €10,000.'}]},'projects below €20,000').status,'excluded');
 assert.equal(Discovery.evaluateExclusions({evidence:[{text:'Annual revenue €50,000,000.'}]},'projects below €20,000').status,'unverified');
});
test('profile propagation is portable across unrelated industries and seller names',()=>{
 for(const offer of ['Legal representation','Office furniture','Sales coaching'])for(const companyName of ['Alpha','Beta']){
  const state={profile:{companyName,priorityOffers:'old'},answers:{priority_offers:offer,ideal_customer:'B2B organisations',buyer_roles:'Owner',exclusions:'No specific exclusions'}};
  const next=Brief.applyAnswers(state);assert.equal(next.profile.priorityOffers,offer);assert.equal(next.profile.companyName,companyName);
 }
});

test('user buying outcomes survive Company Brain hydration and core ICP uses revised answers',()=>{
 const state={website:'https://seller.example',targetMarkets:['Sweden'],profile:{companyName:'Seller',priorityOffers:'Furniture'},answers:{buying_outcomes:'Fit office layouts into limited space',ideal_customer:'Small offices'},market:{icps:[{id:'icp-core',type:'core',description:'Old segment'}]}};
 const next=Brief.applyAnswers(state,['buying_outcomes','ideal_customer']);assert.equal(next.market.icps[0].description,'Small offices');
 const root={LeadIntelProfile:{...Profile}};require('../company-brain.js').install(root);assert.equal(root.LeadIntelProfile.normalizeSavedState(next).profile.customerPainPoints,'Fit office layouts into limited space');
});

test('answer input saves synchronized state, revokes scripts and preserves company records',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../app.js'),'utf8');
 const state={profile:{companyName:'Seller',proofPoints:'old'},answers:{proof_points:'old'},answerStatus:{},market:{}};
 const entries=new Map([['leadintel_customer_v2_discovery',JSON.stringify({candidates:[{domain:'buyer.example'}],pipeline:[{domain:'saved.example'}]})],['leadintel_customer_v2_outreach',JSON.stringify({items:[{approved:true,approvedAt:'yesterday',drafts:{emailBody:'Old proof'}}]})]]);
 let saved,event;
 const context={state,LeadIntelStep2Brief:Brief,globalThis:null,document:{querySelectorAll:()=>[{dataset:{question:'proof_points'},value:'New approved proof'}]},localStorage:{getItem:key=>entries.get(key),setItem:(key,value)=>entries.set(key,value)},saveState:()=>saved=JSON.parse(JSON.stringify(context.state)),CustomEvent:class{constructor(type,detail){this.type=type;Object.assign(this,detail);}},window:{dispatchEvent:value=>event=value}};context.globalThis=context;
 const fn=source.slice(source.indexOf('function readAnswers(){'),source.indexOf('function validateStep1(){'));vm.runInNewContext(fn+';readAnswers();',context);
 assert.equal(saved.profile.proofPoints,'New approved proof');assert.equal(saved.approved,false);assert.equal(JSON.parse(entries.get('leadintel_customer_v2_outreach')).items[0].contextNeedsRefresh,true);assert.equal(JSON.parse(entries.get('leadintel_customer_v2_discovery')).pipeline[0].domain,'saved.example');assert.equal(event.type,'leadintel:commercial-context-changed');
});
test('CRM script snapshot retains commercial context and stale approval protection',()=>{
 const drafts=Outreach.buildOutreachDrafts({company:'Buyer'},{},{priorityOffers:'Legal services',proofPoints:'Approved reference case',commonObjections:'Budget timing'});
 const restored=Outreach.normalizeOutreachState({items:[{domain:'buyer.example',drafts,contextNeedsRefresh:true}]});
 assert.equal(restored.items[0].drafts.commercialContext.proofPoints,'Approved reference case');assert.equal(restored.items[0].contextNeedsRefresh,true);
});
