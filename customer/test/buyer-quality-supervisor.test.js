const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const now=()=>new Date().toISOString();
function fixture(){
 const people=['CEO','COO','Procurement Director','Plant Manager'].map((title,i)=>({id:'p'+i,name:'Anna Buyer'+i,publicName:'Anna Buyer'+i,title,organization:'Example',publicNameUrl:'https://example.com/team',identityEvidenceDate:now(),emailResearch:{status:'complete',searches:4,failed:0,checkedAt:now()},contactResearch:{policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries(['official','public','phone','linkedin','deep'].map(k=>[k,{status:'complete',checkedAt:now()}]))}}));
 const c={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:['CEO','COO','Procurement Director','Plant Manager'],people};
 c.publicResearch={accountability:{...D.createBuyerResearchAccountability(),status:'complete',completedAt:now(),totalPeople:4,checkedPeople:4,officialPages:1}};
 return c;
}
function reviewed(c){c.publicResearch.aiReview={status:'complete',provider:'gemini',checkedAt:now(),inputSignature:D.buyerReviewSignature(c),reviewedPersonIds:c.people.map(p=>p.id),summary:'',reason:'',findings:[],conflicts:[]};return c;}
test('quality supervisor separates completed research from the requested usable contact outcome',()=>{
 const c=reviewed(fixture()),q=D.buyerQualityAssessment(c);
 assert.equal(q.researchPassed,true);assert.equal(q.aiReviewStatus,'complete');assert.equal(q.confirmedPriorityEmails,0);assert.equal(q.passed,false);assert.ok(q.gaps.some(g=>/confirmed.*email/i.test(g)));
 const ready=D.buyerQualityAssessment(c,{confirmedEmail:p=>['p0','p2'].includes(p.id)?p.id+'@example.com':''});assert.equal(ready.passed,true);assert.equal(ready.confirmedPriorityEmails,2);
});
test('legacy completion labels and invented aggregate success cannot bypass required person checks',()=>{
 const c=fixture();delete c.publicResearch.accountability;assert.equal(D.buyerQualityAssessment(c).researchPassed,false);
 const other=fixture();delete other.people[0].contactResearch.checks.linkedin;assert.equal(D.buyerQualityAssessment(other).researchPassed,false);
 const partial=fixture();partial.publicResearch.accountability.status='partial';assert.equal(D.buyerQualityAssessment(partial).researchPassed,false);
});
test('AI unavailable, partial coverage and changed person evidence cannot claim supervised success',()=>{
 const c=reviewed(fixture());c.publicResearch.aiReview.reviewedPersonIds.pop();assert.notEqual(D.buyerQualityAssessment(c).aiReviewStatus,'complete');
 const changed=reviewed(fixture());changed.people[0].title='Former CEO';assert.notEqual(D.buyerQualityAssessment(changed).aiReviewStatus,'complete');
 const absent=fixture();assert.equal(D.buyerQualityAssessment(absent).aiReviewStatus,'not_assessed');
});
test('AI review and its binding to the researched people survive workspace and CRM reload',()=>{
 const c=reviewed(fixture());const restored=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];assert.deepEqual(restored.publicResearch.aiReview,c.publicResearch.aiReview);
 const snapshot=require('../crm-engine.js').mapDiscoveryCandidateToCrm(restored).intelligence.research_snapshot.buyerResearch;
 assert.deepEqual(snapshot.publicResearch.aiReview,c.publicResearch.aiReview);
});
module.exports={fixture,reviewed};

test('a claimed aggregate pass cannot hide a missing mandatory deep wave',()=>{const c=fixture();delete c.people[0].contactResearch.checks.deep;assert.equal(D.buyerQualityAssessment(c).researchPassed,false);});
test('the visible quality panel reports zero usable priority emails and retains the four-card layout',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom'),s=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),a=s.indexOf('function buyerQualitySupervisorHtml('),b=s.indexOf('function buyerResearchAccountabilityHtml(',a),ctx={LeadIntelDiscovery:D,verifiedBuyerEmail:()=>'',enrichmentResults:new Map(),personKey:(c,p)=>p.id,esc:String,crmAuthenticated:()=>true};
 vm.createContext(ctx);vm.runInContext(s.slice(a,b),ctx);const dom=new JSDOM(ctx.buyerQualitySupervisorHtml(fixture()));assert.match(dom.window.document.body.textContent,/0\/4 priority buyers have confirmed/);assert.match(dom.window.document.body.textContent,/AI review not assessed/);assert.equal(dom.window.document.querySelectorAll('.selected-prospect-person').length,0);dom.window.close();
});
