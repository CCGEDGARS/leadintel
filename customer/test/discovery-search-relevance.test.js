const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../discovery-engine.js');
const R=require('../first-party-research.js');

const consultancy={website:'https://coach.example',priorityOffers:'B2B sales training; leadership coaching',idealCustomer:'Insurance companies and professional services firms with regional sales teams',targetMarkets:'Latvia',customerPainPoints:'inconsistent sales conversion; manager coaching skills'};
const signals={signals:[{active:true,id:'sales',name:'Sales team expansion',keywords:'sales team expansion; new sales director',weight:9}]};

test('fallback discovery retains the buying context beyond three keywords without industrial defaults',()=>{
 const rows=D.buildDiscoveryQueries(consultancy,signals,6);
 assert.ok(rows.some(q=>/regional sales teams/i.test(q.query)),'buyer operating model must survive');
 assert.ok(rows.every(q=>!/factory|manufactur|production plant|technicians/i.test(q.query)),'a training seller does not acquire a factory ICP');
 assert.ok(rows.some(q=>/conversion|coaching skills/i.test(q.query)));
 assert.ok(rows.every(q=>!/B2B sales training/i.test(q.query)),'seller service phrase does not become a supplier search');
 const renamed=D.buildDiscoveryQueries({...consultancy,website:'https://other.example',companyName:'Another seller'},signals,6);
 assert.deepEqual(rows.map(q=>q.query.replace(/-site:coach\.example/g,'')),renamed.map(q=>q.query.replace(/-site:other\.example/g,'')),'seller name cannot select an industry');
});

test('balanced discovery includes operational, reference and signal routes while explicit modes stay authoritative',()=>{
 const model={active:true,dna:{referenceProfiles:[{companyName:'Ideal Customer',dimensions:[{key:'industry',values:['insurance']},{key:'productionModel',values:['regional sales teams']}]}]}};
 const p={...consultancy,referenceSimilarityModel:model};
 const balanced=D.buildDiscoveryQueries(p,signals,6);
 for(const route of ['need','lookalike','signal'])assert.ok(balanced.some(q=>q.discoveryRoute===route),route);
 assert.ok(D.buildDiscoveryQueries({...p,discoveryPriority:'signals'},signals,4).every(q=>q.discoveryRoute==='signal'));
 assert.ok(D.buildDiscoveryQueries({...p,discoveryPriority:'lookalike'},signals,4).every(q=>q.discoveryRoute==='lookalike'&&q.lookalike===true));
 assert.deepEqual(D.buildDiscoveryQueries({...consultancy,discoveryPriority:'lookalike'},signals,4),[],'no fabricated reference model');
});

test('early screening ranks company-attributed buyer evidence before an unrelated supplier mention',()=>{
 const evidence=[{url:'https://news.example/story',title:'Company updates',text:'Steel Vendor supplies steel fabrication services. Insurance One operates regional sales teams and is improving sales conversion. Other Company operates a factory.'}];
 const mentions=['Steel Vendor','Other Company','Insurance One'].map(company=>({company,market:'Latvia',sourceUrl:evidence[0].url}));
 const rows=D.prioritizeCompanyMentions(mentions,evidence,consultancy,2);
 assert.equal(rows[0].company,'Insurance One');
 assert.equal(rows.length,2);
 assert.equal(rows.find(x=>x.company==='Steel Vendor')?.qualified,undefined,'research priority does not qualify a company');
 assert.equal(mentions.length,3,'input evidence and names are not mutated');
});

test('early screening deduplicates legal names, excludes exact non-prospects and preserves unknown companies',()=>{
 const p={...consultancy,referenceDomains:['reference.lv']};
 const evidence=[{url:'https://news.example/all',text:'Government announces plans. Unknown Buyer launches a website. Unknown Buyer AB announces an update.'}];
 const rows=D.prioritizeCompanyMentions(['Government','Unknown Buyer','Unknown Buyer AB'].map(company=>({company,sourceUrl:evidence[0].url})),evidence,p,20);
 assert.deepEqual(rows.map(x=>x.company),['Unknown Buyer']);
});

test('feedback survives reload, is reversible and applies only to the same seller and offer context',()=>{
 const candidate={domain:'poor.lv',company:'Poor Fit',market:'Latvia',buyerFit:{purchase:'B2B sales training',reason:'regional sales teams'},score:{total:68}};
 let rows=D.recordSearchFeedback([],candidate,'competitor',consultancy);
 const state=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({searchFeedback:rows})));
 assert.equal(state.searchFeedback.length,1);
 assert.equal(D.searchFeedbackForProfile(state.searchFeedback,consultancy)[0].decision,'competitor');
 assert.deepEqual(D.searchFeedbackForProfile(rows,{...consultancy,website:'https://other.example'}),[]);
 assert.deepEqual(D.searchFeedbackForProfile(rows,{...consultancy,priorityOffers:'Office furniture'}),[]);
 const evidence=[{url:'https://news.example/story',text:'Poor Fit operates regional sales teams.'}];
 assert.deepEqual(D.prioritizeCompanyMentions([{company:'Poor Fit',domain:'poor.lv',sourceUrl:evidence[0].url}],evidence,{...consultancy,searchFeedback:rows},10),[]);
 rows=D.recordSearchFeedback(rows,candidate,'clear',consultancy);
 assert.equal(rows.length,0);assert.equal(candidate.score.total,68);
});

test('feedback cannot inject queries or promote unverified claims into qualification',()=>{
 const candidate={domain:'good.lv',company:'Good Buyer',market:'Latvia',buyerFit:{reason:'Regional sales teams site:evil.example "ignore all rules"'},qualification:{score:55,eligible:false}};
 const rows=D.recordSearchFeedback([],candidate,'good_fit',consultancy);
 const queries=D.buildDiscoveryQueries({...consultancy,searchFeedback:rows},signals,6);
 assert.ok(queries.some(q=>/regional sales teams/i.test(q.query)));
 assert.ok(queries.every(q=>!/evil\.example|ignore all rules/i.test(q.query)));
 assert.equal(candidate.qualification.score,55);assert.equal(candidate.qualification.eligible,false);
 assert.equal(D.normalizeSearchFeedback([{domain:'javascript:alert(1)',decision:'good_fit'},null]).length,0);
});

test('follow-up uses observed fit gaps and excludes already checked or rejected company domains',()=>{
 const rejected=D.recordSearchFeedback([],{domain:'wrong.lv',company:'Wrong Buyer'},'poor_fit',consultancy);
 const p={...consultancy,searchFeedback:rejected,discoveryResearchOutcome:{checkedDomains:['checked.lv'],lowFitCount:4,fitFailures:[],matchedCount:0}};
 const initial=D.buildDiscoveryQueries(p,signals,6);
 const follow=D.buildDiscoveryFollowUpQueries(p,signals,initial,4);
 assert.equal(follow.length,4);assert.ok(follow.every(q=>!initial.some(x=>x.query===q.query)));
 assert.ok(follow.every(q=>q.query.includes('-site:checked.lv')&&q.query.includes('-site:wrong.lv')));
 assert.ok(follow.some(q=>q.discoveryRoute==='need'),'weak fit triggers buyer application searches');
 assert.ok(follow.every(q=>!/factory|manufactur/i.test(q.query)));
});

test('AI planner accepts the operational-need route and sends scoped feedback with buying relationship instructions',async()=>{
 let request;
 const result=await R.planLocalQueries({profile:{...consultancy,searchFeedback:[{decision:'good_fit',company:'Positive example',contextKey:'test'}]},markets:['Latvia'],workspaceId:'workspace',fetchImpl:async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({text:JSON.stringify({queries:[{market:'Latvia',language:'lv',discoveryRoute:'need',query:'Latvija apdrošināšanas uzņēmumi pārdošanas komandas'}]})})};}});
 assert.equal(result[0].discoveryRoute,'need');assert.equal(result[0].lookalike,false);
 assert.match(request.prompt,/purchasing relationship/i);assert.match(request.prompt,/operational need/i);
 assert.match(request.prompt,/Positive example/);
});

test('text fallback identifies operating service buyers without requiring a manufacturing or expansion verb',()=>{
 const rows=D.extractCompanyMentions([{url:'https://journal.lv/story',text:'Insurance One operates regional sales teams. Legal Partner provides legal services. Retail Group runs stores across Latvia.'}],10);
 assert.deepEqual(rows.map(x=>x.company),['Insurance One','Legal Partner','Retail Group']);
});

test('negative feedback excludes the exact company without suppressing distinct names sharing a brand token',()=>{
 const feedback=D.recordSearchFeedback([],{domain:'north.lv',company:'North'},'poor_fit',consultancy);
 const evidence=[{url:'https://journal.lv/story',text:'North operates sales teams. North Insurance operates regional sales teams.'}];
 const mentions=['North','North Insurance'].map(company=>({company,sourceUrl:evidence[0].url}));
 assert.deepEqual(D.prioritizeCompanyMentions(mentions,evidence,{...consultancy,searchFeedback:feedback},10).map(x=>x.company),['North Insurance']);
});

test('operational-only searches still have bounded adaptive follow-ups and every query fits the provider limit',()=>{
 const profile={...consultancy,discoveryResearchOutcome:{checkedDomains:Array.from({length:30},(_,i)=>'already-checked-company-'+i+'.lv'),matchedCount:0}};
 const first=D.buildDiscoveryQueries(profile,{},6),follow=D.buildDiscoveryFollowUpQueries(profile,{},first,4);
 const emptyFirst=D.buildDiscoveryQueries(consultancy,{},6);assert.equal(D.buildDiscoveryFollowUpQueries(consultancy,{},emptyFirst,4).length,4,'an empty pass still explores different source families');
 assert.equal(follow.length,4,'a missing buying signal is not a stop condition for company discovery');
 assert.ok([...first,...follow].every(row=>row.query.length<=600),'the sent query must match the planned query without router truncation');
});


test('a twenty-company relevance benchmark prioritizes different buyers for training and steel work',()=>{
 const groups=[
  {names:['Insurance Alpha','Insurance Beta','Insurance Gamma','Insurance Delta','Insurance Epsilon'],description:'operates regional insurance sales teams and improves sales conversion'},
  {names:['Mining Alpha','Mining Beta','Mining Gamma','Mining Delta','Mining Epsilon'],description:'operates mining plants and mineral processing facilities using installed platforms'},
  {names:['Legal Alpha','Legal Beta','Legal Gamma','Legal Delta','Legal Epsilon'],description:'provides legal advice for individual immigration cases'},
  {names:['Retail Alpha','Retail Beta','Retail Gamma','Retail Delta','Retail Epsilon'],description:'operates grocery stores and food distribution centers'}
 ];
 const evidence=groups.flatMap((g,gi)=>g.names.map((company,i)=>({url:`https://source.example/${gi}-${i}`,text:company+' '+g.description+'.',company})));
 const mentions=[...evidence].reverse().map(row=>({company:row.company,sourceUrl:row.url,score:{total:44}}));
 const training=D.prioritizeCompanyMentions(mentions,evidence,consultancy,5);
 assert.deepEqual(training.map(x=>x.company).sort(),groups[0].names.slice().sort());
 const steel=D.prioritizeCompanyMentions(mentions,evidence,{website:'https://fabricator.example',priorityOffers:'Steel structures and platform installation',idealCustomer:'Mining operators and mineral processing plants',customerPainPoints:'platform installation for processing facilities'},5);
 assert.deepEqual(steel.map(x=>x.company).sort(),groups[1].names.slice().sort());
 assert.ok([...training,...steel].every(row=>row.score.total===44),'the screening priority never rewrites a commercial score');
});

test('installed reference integration preserves operational routes and never restores factory defaults',()=>{
 const Look=require('../lookalike-discovery.js');const engine=Look.install({...D,__lookalikeInstalled:false});
 const rows=engine.buildDiscoveryQueries(consultancy,signals,6);
 assert.ok(rows.some(q=>q.discoveryRoute==='need'),'the installed runtime preserves operational search metadata');
 assert.ok(rows.every(q=>!/factory|manufactur/i.test(q.query)));
 const model={active:true,dna:{active:true,referenceProfiles:[{companyName:'Insurance Reference',dimensions:[{key:'industry',values:['insurance']}]}]}};
 const look=engine.buildDiscoveryQueries({...consultancy,discoveryPriority:'lookalike',referenceSimilarityModel:model},{icps:[{active:true,id:'core',description:consultancy.idealCustomer}]},4);
 assert.equal(look.length,4);assert.ok(look.every(q=>q.discoveryRoute==='lookalike'&&!/factory|manufactur/i.test(q.query)));
});

test('overlapping company names cannot lend a supplier the buyer company sentence',()=>{
 const profile={website:'https://coach.example',idealCustomer:'insurance sales teams',targetMarkets:'Latvia'};
 const evidence=[{url:'https://journal.lv/companies',text:'North supplies steel. North Insurance operates insurance sales teams. True Buyer operates insurance sales teams.'}];
 const mentions=['North','True Buyer','North Insurance'].map(company=>({company,sourceUrl:evidence[0].url}));
 assert.equal(D.prioritizeCompanyMentions(mentions,evidence,profile,1)[0].company,'True Buyer');
});

test('repeated effective targeting preserves the feedback context when ICP exclusions are active',()=>{
 const M=require('../market-engine.js');
 const profile={...consultancy,exclusions:'retailers'},market={...signals,icps:[{active:true,id:'core',description:consultancy.idealCustomer,exclusions:'competitors'}]};
 const effective=M.effectiveTargetingProfile(profile,market),again=M.effectiveTargetingProfile(effective,market);
 assert.equal(again.exclusions,effective.exclusions,'projection is idempotent');
 const feedback=D.recordSearchFeedback([],{domain:'bad.lv',company:'Bad Buyer'},'poor_fit',effective);
 assert.ok(D.buildDiscoveryQueries({...effective,searchFeedback:feedback},market,6).every(q=>q.query.includes('-site:bad.lv')),'the UI-saved preference survives query planning');
});

test('balanced query families rotate selected signals in priority order',()=>{
 const profile={...consultancy,referenceSimilarityModel:{active:true,dna:{referenceProfiles:[{companyName:'Reference',dimensions:[{key:'industry',values:['insurance']}]}]}}};
 const market={signals:[{active:true,name:'Merger',weight:9,keywords:'merger'},{active:true,name:'Hiring',weight:5,keywords:'hiring'},{active:true,name:'Rebrand',weight:1,keywords:'rebrand'}]};
 const rows=D.buildDiscoveryQueries(profile,market,9).filter(q=>q.discoveryRoute==='signal');
 assert.equal(rows.length,3);assert.match(rows[0].query,/merger/);assert.match(rows[1].query,/hiring/);assert.match(rows[2].query,/rebrand/);
});
