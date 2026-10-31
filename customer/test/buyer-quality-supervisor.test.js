const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const now=()=>new Date().toISOString();
function fixture(){
 const people=['CEO','COO','Procurement Director','Plant Manager'].map((title,i)=>({id:'p'+i,name:['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind'][i],publicName:['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind'][i],title,organization:'Example',publicNameUrl:'https://example.com/team',identityEvidenceDate:now(),emailResearch:{status:'complete',searches:4,failed:0,checkedAt:now()},contactResearch:{policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries([...D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks,'deep'].map(k=>[k,{status:'complete',checkedAt:now(),queryLog:Array.from({length:k==='gmail'?3:k==='direct_email'?2:1},(_,i)=>({query:k+' business source query '+i,status:'complete',checkedAt:now(),resultCount:0}))}]))}}));
 const c={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:['CEO','COO','Procurement Director','Plant Manager'],people};
 c.buyerDiscovery={officialContactInventory:{version:1,domain:c.domain,checkedAt:now(),sourcePages:['https://example.com/team'],contacts:[],channels:[],research:{policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,status:'complete',checkedAt:now(),readPages:1,queries:[],failures:[]}}};
 c.publicResearch={accountability:{...D.createBuyerResearchAccountability(),status:'complete',completedAt:now(),totalPeople:4,checkedPeople:4,officialPages:1}};
 return require('./helpers/buyer-research-receipts.cjs')(c);
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
 const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom'),s=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),a=s.indexOf('function buyerOutcomeEvidenceHtml('),b=s.indexOf('function buyerResearchAccountabilityHtml(',a),ctx={window:{},LeadIntelDiscovery:D,verifiedBuyerEmail:()=>'',enrichmentResults:new Map(),personKey:(c,p)=>p.id,esc:String,crmAuthenticated:()=>true};
 vm.createContext(ctx);vm.runInContext(s.slice(a,b),ctx);const dom=new JSDOM(ctx.buyerQualitySupervisorHtml(fixture()));assert.match(dom.window.document.body.textContent,/0\/4 priority buyers have confirmed/);assert.match(dom.window.document.body.textContent,/AI review not assessed/);assert.equal(dom.window.document.querySelectorAll('.selected-prospect-person').length,0);dom.window.close();
});

test('the supervisor payload preserves evidence for every person without repeating an oversized source bundle',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),s=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),a=s.indexOf('async function reviewBuyerPublicEvidence('),b=s.indexOf('async function confirmResearchedPublicEmails(',a);
 const names=['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind','Eva Karlsson','Fredrik Holm','Greta Lund','Henrik Dahl','Ingrid Ek','Johan Strand'],people=names.map((name,i)=>({id:'p'+i,name,title:'Procurement Director',publicNameUrl:'https://example.com/team/'+i})),rows=people.flatMap(p=>[0,1].map(i=>({url:p.publicNameUrl+'/'+i,title:p.name,markdown:Array.from({length:3},(_,j)=>p.name+' — Procurement Director at Example. '+p.id+'@example.com '+('Evidence '+i+' '+j+'. ').repeat(130)).join('\n'),sourceRead:true})));let payload;
 const context={LeadIntelDiscovery:D,bridge:()=>({workspace:{id:'w'}}),crmAuthenticated:()=>true,LEADINTEL_API:'https://api.example',DISCOVERY_REQUEST_TIMEOUT_MS:25000,fetchBuyerResearch:async(url,options)=>{payload=JSON.parse(options.body);return Response.json({status:'complete',provider:'fixture',supervisor:{status:'complete',reviewedPersonIds:people.map(p=>p.id)},conflicts:[]});}};
 vm.createContext(context);vm.runInContext(s.slice(a,b),context);await context.reviewBuyerPublicEvidence({company:'Example',domain:'example.com',people},rows,new AbortController().signal);
 assert.ok(payload.evidence.reduce((total,row)=>total+row.excerpt.length,0)<=20000);
 for(const name of names)assert.ok(payload.evidence.some(row=>row.excerpt.includes(name)),name+' evidence must be retained');
});

test('completed public contact checks cannot authorize research coverage without the dedicated Gmail check',()=>{
 const c=reviewed(fixture());delete c.people[0].contactResearch.checks.gmail;
 assert.equal(D.buyerResearchCoveragePassed(c),false);assert.equal(D.buyerQualityAssessment(c).researchPassed,false);
});
