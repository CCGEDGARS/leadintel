const test=require('node:test'),assert=require('node:assert/strict'),M=require('../company-lists.js');
const now=Date.parse('2026-11-20T12:00:00Z');

// Neutral workspace: one active Core profile, one market. No customer data.
function workspace(){return {website:'https://seller.example/',targetMarkets:['Denmark'],answers:{priority_offers:'Welding services',ideal_customer:'Steel fabricators',exclusions:'Consumer retailers'},market:{icps:[{id:'icp-core',type:'core',name:'Core',active:true,description:'Fabricators of steel structures'}],signals:[]}};}
const target={employees:{min:25,max:250},revenue:{min:3000000,currency:'EUR'},industries:['25','24'],registryOnly:true};
const config=(extra={})=>M.configuration({profileIds:['icp-core'],profileMode:'any',signalMode:'off',count:10,markets:['Denmark'],...extra},M.options(workspace()));
const page={url:'https://fabricator.example/',text:'Fabricator builds welded steel structures for industry. Fabricator operates from Give in Denmark.',readAt:'2026-11-20T10:00:00Z'};
const raw=(extra={})=>({company:'Fabricator',website:page.url,identity:{url:page.url,quote:'Fabricator builds welded steel structures for industry.'},location:{market:'Denmark',label:'Give',url:page.url,quote:'Fabricator operates from Give in Denmark.'},
 commercialFit:{status:'supported',url:page.url,quote:'Fabricator builds welded steel structures for industry.',reason:'Fabrication work needs welders'},
 profileMatches:[{profileId:'icp-core',url:page.url,quote:'Fabricator builds welded steel structures for industry.',strength:80,reason:'Steel fabricator'}],...extra});
const registered=(extra={})=>({status:'found',registry:'DK-CVR',country:'DK',id:'11111111',name:'FABRICATOR A/S',city:'Give',active:true,statusLabel:'NORMAL',industry:{code:'251100',label:'Manufacture of metal structures'},employees:{count:120},revenue:null,marketingProtected:true,source:{name:'CVR',url:'https://register.example/11111111',checkedAt:'2026-11-20T12:00:00.000Z'},...extra});

test('a list without structured criteria keeps exactly the criteria it had before',()=>{
 const plain=config();
 assert.equal(Object.hasOwn(plain,'target'),false);
 assert.equal(Object.hasOwn(config({target:{}}),'target'),false);
 assert.deepEqual(config({target:null}),plain);
});

test('structured criteria are normalised and frozen with the list; invalid input is refused',()=>{
 assert.deepEqual(config({target}).target,{version:1,employees:{min:25,max:250},revenue:{min:3000000,idealMin:null,idealMax:null,currency:'EUR'},industries:['24','25'],registryOnly:true});
 assert.throws(()=>config({target:{employees:{min:300,max:25}}}),e=>e.status===400);
 assert.throws(()=>config({target:{industries:['metal']}}),e=>e.status===400);
 assert.match(M.criteriaSummary(config({target})),/turnover.*evidence/i);
 assert.doesNotMatch(M.criteriaSummary(config()),/employees/);
});

test('a quoted industry statement from a read page of the company is retained only when industries are selected',()=>{
 const industry={division:'25',url:page.url,quote:'Fabricator builds welded steel structures for industry.'};
 assert.deepEqual(M.assess(raw({industry}),config({target}),[page],now).industryEvidence,industry);
 for(const bad of [{...industry,quote:'Invented statement about steel structures.'},{...industry,division:'steel'},{...industry,url:'https://directory.example/fabricator'},undefined]){
  const candidate=M.assess(raw({industry:bad}),config({target}),[page],now);
  assert.ok(candidate,'the candidate itself is still assessed');assert.equal(Object.hasOwn(candidate,'industryEvidence'),false);
 }
 assert.equal(Object.hasOwn(M.assess(raw({industry}),config(),[page],now),'industryEvidence'),false);
 assert.equal(Object.hasOwn(M.assess(raw({industry}),config({target:{employees:{max:250}}}),[page],now),'industryEvidence'),false);
});

test('register facts inside the criteria are attached to the company with one reason per criterion',()=>{
 const c=config({target}),candidate=M.assess(raw(),c,[page],now);
 const outcome=M.targetOutcome(candidate,registered(),c);
 assert.equal(outcome.excluded,false);
 assert.deepEqual(outcome.candidate.target.checks.map(x=>[x.key,x.status]),[['registry','match'],['industry','match'],['employees','reported'],['revenue','unknown']]);
 assert.deepEqual(outcome.candidate.target.register,{registry:'DK-CVR',id:'11111111',name:'FABRICATOR A/S',city:'Give',marketingProtected:true,source:{name:'CVR',url:'https://register.example/11111111',checkedAt:'2026-11-20T12:00:00.000Z'}});
 assert.equal(outcome.candidate.score,candidate.score,'the fit score is not changed by the register check');
 assert.equal(outcome.candidate.company,'Fabricator');
});

test('a known mismatch excludes with the plain reasons; unknown facts keep the company flagged',()=>{
 const c=config({target}),candidate=M.assess(raw(),c,[page],now);
 const large=M.targetOutcome(candidate,registered({employees:{count:833}}),c);
 assert.equal(large.candidate.score,candidate.score);assert.equal(large.candidate.target.checks.find(c=>c.key==='employees').detail,'833 employees');
 const both=M.targetOutcome(candidate,registered({employees:{count:1027},industry:{code:'711210',label:'Engineering consultancy'}}),c);
 assert.equal(both.reason,'Outside the target criteria: 71.12 Engineering consultancy is outside the selected industries');
 assert.equal(M.targetOutcome(candidate,{status:'not_found',registry:'DK-CVR',country:'DK'},c).reason,'Outside the target criteria: Not found in the DK-CVR register');
 for(const facts of [{status:'unavailable',registry:'DK-CVR',country:'DK'},{status:'ambiguous',registry:'DK-CVR',country:'DK'},{status:'unsupported'}]){
  const kept=M.targetOutcome(candidate,facts,c);
  assert.equal(kept.excluded,false);assert.equal(kept.candidate.target.register,null);
  assert.ok(kept.candidate.target.checks.every(x=>x.status==='unknown'));
 }
});

test('the retained website statement rescues a register-code mismatch for that company only',()=>{
 const industry={division:'25',url:page.url,quote:'Fabricator builds welded steel structures for industry.'};
 const c=config({target}),wholesale=registered({industry:{code:'467200',label:'Wholesale of vehicle parts'}});
 assert.equal(M.targetOutcome(M.assess(raw({industry}),c,[page],now),wholesale,c).excluded,false);
 assert.equal(M.targetOutcome(M.assess(raw(),c,[page],now),wholesale,c).excluded,true);
});

test('lists without structured criteria pass every candidate through unchanged',()=>{
 const c=config(),candidate=M.assess(raw(),c,[page],now);
 assert.deepEqual(M.targetOutcome(candidate,registered({employees:{count:99999}}),c),{excluded:false,candidate});
});

test('the reviewed result keeps the register reasons',()=>{
 const c=config({target}),candidate=M.targetOutcome(M.assess(raw(),c,[page],now),registered(),c).candidate;
 const reviewed=M.reviewResult(candidate,{decision:'pass',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedProfileIds:['icp-core'],supportedSignalIds:[],reason:'Evidence supports the match',gaps:[]},c,now);
 assert.ok(reviewed);assert.equal(reviewed.target.register.id,'11111111');assert.equal(reviewed.target.checks.length,4);
});

test('verified profile size preferences break score ties without changing eligibility',()=>{
 const w=workspace();
 w.market.icps[0].description+=' Companies with more than 30 employees. Companies with less than 250 employees. Preferred annual turnover: EUR 3–150 million.';
 const c=M.configuration({profileIds:['icp-core'],count:10,markets:['Denmark'],target},M.options(w));
 const candidate=M.assess(raw(),c,[page],now);
 const review={decision:'pass',reason:'Verified',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedProfileIds:['icp-core']};
 const ranked=(facts,company)=>M.reviewResult(M.targetOutcome({...candidate,company,domain:company},facts,c).candidate,review,c,now);
 const preferred=ranked(registered({revenue:{amount:20000000,currency:'EUR',year:2025}}),'Zulu');
 const outside=ranked(registered({employees:{count:250},revenue:{amount:20000000,currency:'DKK',year:2025}}),'Alpha');
 const unknown=ranked(null,'Beta');
 assert.equal(preferred.score,outside.score);
 assert.equal(outside.score,unknown.score);
 assert.deepEqual(preferred.sizePreferences.map(p=>p.status),['within','within']);
 assert.deepEqual(outside.sizePreferences.map(p=>p.status),['outside','unknown']);
 assert.deepEqual(M.ranked([outside,unknown,preferred]).map(r=>r.company),['Zulu','Alpha','Beta']);
});
