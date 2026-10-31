const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),C=require('../crm-engine.js'),P=require('../contact-confirmation-policy.js');
const buyer={id:'anna',name:'Anna Andersson',title:'Head of Procurement',organization:'Example',publicNameUrl:'https://example.com/team'};
const company=()=>({company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{...buyer}]});
const source={url:'https://association.test/business-contacts',markdown:'Anna Andersson\nHead of Procurement, Example\nBusiness contact: anna.andersson@gmail.com',sourceRead:true};
test('work-email ranking learns first-name-only formats from official named colleagues',()=>{
 const colleagues=[{name:'Catrin Haglund',publicEmail:'catrin@example.com',publicEmailUrl:'https://example.com/team'},{name:'Johnny Spang',publicEmail:'johnny@example.com',publicEmailUrl:'https://example.com/team'}];
 const guesses=D.rankedEmailGuesses(buyer,'example.com',colleagues);
 assert.equal(guesses[0].email,'anna@example.com');assert.equal(guesses[0].supportingContacts,2);assert.equal(guesses[0].status,'guessed');
 assert.equal(D.rankedEmailGuesses(buyer,'other.com',colleagues)[0].supportingContacts,0);
});
test('mandatory work-email query plan uses actual company evidence and handles international names',()=>{
 const c={...company(),buyerDiscovery:{companyContacts:[{name:'Catrin Haglund',publicEmail:'catrin@example.com',publicEmailUrl:'https://example.com/team'}]}};
 const q=D.buyerDirectEmailQueries(c,{...buyer,name:'Rikard Lejåker'});
 assert.equal(q.length,2);assert.ok(q[0].includes('Rikard Lejåker')&&q[0].includes('Rikard Lejaker'));
 assert.ok(q[1].includes('"rikard@example.com"'));for(const s of q)assert.ok(s.length<=600);
});
test('non-Latin full names run original-name email research even when no safe address pattern can be generated',async()=>{
 const c=company();c.people[0].name='Иван Петров';const queries=[];
 await D.runMandatoryBuyerResearch(c,{search:async q=>{queries.push(q);return [];},readPage:async()=>({markdown:'Example team'})});
 assert.equal(c.people[0].contactResearch.checks.direct_email.queryLog.length,2);assert.equal(c.people[0].contactResearch.checks.gmail.queryLog.length,3);assert.equal(D.buyerResearchCoveragePassed(c),true);
 assert.ok(queries.every(q=>q.includes('Иван Петров')&&!q.includes('OR )')));assert.deepEqual(c.people[0].gmailCandidates,[]);
});
test('public business Gmail matches tolerate contact-block layout while retaining unconfirmed ownership',()=>{
 const matches=D.gmailResearchMatches(buyer,company(),[source]);
 assert.equal(matches.length,1);assert.equal(matches[0].email,'anna.andersson@gmail.com');assert.equal(matches[0].status,'unconfirmed');assert.equal(matches[0].url,source.url);
 assert.match(matches[0].matchBasis,/name.*company/i);assert.ok(matches[0].quote.includes('Example'));
 for(const row of [{...source,markdown:source.markdown.replace('Anna Andersson','Anna Anderssonson')},{...source,markdown:source.markdown.replace('Example','Other')},{...source,markdown:source.markdown.replace('gmail.com','gmail.com.evil.test')},{...source,evidenceKind:'model_summary'},{...source,markdown:'Anna Andersson at Example.\nBob Smith: bob.smith@gmail.com'},{...source,markdown:'Email format for Anna Andersson at Example: anna.andersson@gmail.com'},{...source,markdown:'Generated email pattern for Anna Andersson at Example: anna.andersson@gmail.com'}])assert.deepEqual(D.gmailResearchMatches(buyer,company(),[row]),[]);
});
test('Gmail matching respects plain, heading and bold staff-card boundaries without confusing a role with a name',()=>{
 for(const heading of ['Bob Smith:', '## Bob Smith', '**Bob Smith**','- Bob Smith'])assert.deepEqual(D.gmailResearchMatches(buyer,company(),[{url:'https://example.com/team',markdown:'## Anna Andersson\nHead of Procurement\n\n'+heading+'\nCEO\nbob.smith@gmail.com',sourceRead:true}]),[]);
 for(const markdown of ['Anna Andersson at Example. Bob Smith: bob.smith@gmail.com','Anna Andersson at Example — contact Bob Smith via bob.smith@gmail.com','Anna Andersson\nExampleCorp\nanna.andersson@gmail.com'])assert.deepEqual(D.gmailResearchMatches(buyer,company(),[{url:'https://directory.test/business',markdown}]),[]);
 assert.equal(D.gmailResearchMatches({...buyer,title:'Finance Director'},company(),[{url:'https://example.com/team',markdown:'## Anna Andersson\nFinance Director\nanna.finance@gmail.com',sourceRead:true}])[0].email,'anna.finance@gmail.com');
 assert.deepEqual(D.gmailResearchMatches({...buyer,name:'أحمد محمد'},company(),[{url:'https://example.com/team',sourceRead:true,markdown:'أحمد محمد at Example\nخالد محمود\nkhaled@gmail.com'}]),[]);
 assert.deepEqual(D.gmailResearchMatches(buyer,company(),[{url:'https://example.com/team',sourceRead:true,markdown:'Anna Andersson at Example\ncontact: bob smith\nbob.smith@gmail.com'}]),[]);
 for(const instruction of ['For business enquiries','For more information','Contact for suppliers'])assert.equal(D.gmailResearchMatches(buyer,company(),[{url:'https://example.com/team',sourceRead:true,markdown:'Anna Andersson at Example\n'+instruction+'\nanna.andersson@gmail.com'}])[0]?.email,'anna.andersson@gmail.com');
});
test('all mandatory email searches execute, and Gmail candidates survive both workspace and CRM reload',async()=>{
 const c=company(),queries=[];
 await D.runMandatoryBuyerResearch(c,{search:async q=>{queries.push(q);return q.includes('"anna.andersson@gmail.com"')?[source]:[];},readPage:async url=>({markdown:url===source.url?source.markdown:'Example team contact information',metadata:{sourceURL:url}})});
 const p=c.people[0];assert.equal(p.contactResearch.checks.direct_email.status,'complete');assert.equal(p.contactResearch.checks.direct_email.queryLog.length,2);
 assert.equal(p.contactResearch.checks.gmail.queryLog.length,3);assert.equal(p.contactResearch.checks.gmail.queryLog.filter(q=>q.status==='complete').length,3);
 assert.equal(p.gmailMatches[0].status,'unconfirmed');assert.equal(p.publicEmail||'','');assert.equal(p.patternFindings?.filter(x=>x.email.endsWith('@example.com')).length||0,0);
 const saved=D.normalizeDiscoveryState({selectedProspects:[c],candidates:[c]}).selectedProspects[0];
 assert.equal(saved.people[0].gmailMatches[0].email,'anna.andersson@gmail.com');assert.equal(saved.people[0].contactResearch.checks.gmail.queryLog.length,3);
 const restored=C.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch.buyers[0];assert.equal(restored.gmailMatches[0].status,'unconfirmed');
 assert.equal(P.accepted({...restored,normalized_email:restored.gmailMatches[0].email,email_status:'public_confirmed'},c.domain,'public_confirmed'),false);
 const other=D.normalizeDiscoveryState({selectedProspects:[{...saved,domain:'other.com'}]}).selectedProspects[0];assert.deepEqual(other.people[0].gmailMatches,[]);
});
test('incomplete Gmail and direct-email searches retain individual failures instead of claiming completion',async()=>{
 const c=company();await D.runMandatoryBuyerResearch(c,{search:async q=>{if(q.includes('filetype:pdf')&&q.includes('gmail.com'))throw Error('Gmail document search failed');return [];},readPage:async()=>({markdown:'Example company team'})});
 assert.equal(c.people[0].contactResearch.checks.gmail.status,'partial');assert.equal(c.people[0].contactResearch.checks.gmail.queryLog.filter(x=>x.status==='partial').length,1);
 assert.equal(c.publicResearch.accountability.status,'partial');assert.equal(D.buyerResearchCoveragePassed(c),false);
});
test('successful aggregate labels cannot hide absent direct-email or Gmail query receipts',async()=>{
 const c=company();await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async()=>({markdown:'Example company team'})});
 assert.equal(D.buyerResearchCoveragePassed(c),true);
 const p=c.people[0],saved=p.contactResearch.checks.gmail.queryLog;p.contactResearch.checks.gmail.queryLog=saved.slice(0,1);assert.equal(D.buyerResearchCoveragePassed(c),false);
 p.contactResearch.checks.gmail.queryLog=saved;delete p.contactResearch.checks.direct_email.queryLog;assert.equal(D.buyerResearchCoveragePassed(c),false);
});
test('an official full staff page supplies the learned work-email format without promoting a pattern to a contact',async()=>{
 const c=company(),queries=[];await D.runMandatoryBuyerResearch(c,{search:async q=>{queries.push(q);return [];},readPage:async()=>({markdown:'## Personal\nCatrin Haglund\nAdministration\ncatrin@example.com\n\nJohnny Spang\nLogistics\njohnny@example.com\n\nAnna Andersson\nHead of Procurement\nPhone 123456789',metadata:{sourceURL:'https://example.com/team'}})});
 assert.ok(c.buyerDiscovery.companyContacts.some(p=>p.publicEmail==='catrin@example.com'));assert.ok(queries.some(q=>q.includes('"anna@example.com"')));assert.equal(c.people[0].publicEmail||'','');
});
test('CRM hydration keeps newer saved query receipts while preserving local buyer selections',async()=>{
 const c=company();await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async()=>({markdown:'Example team'})});
 const stamp=new Date().toISOString();c.buyerDiscovery={...c.buyerDiscovery,checkedAt:stamp};
 const detail={company:{id:'company',workspace_id:'hydration-workspace',normalized_domain:c.domain},contacts:[],intelligence:C.mapDiscoveryCandidateToCrm(c).intelligence};
 const local=structuredClone(c);local.buyerDiscovery.checkedAt=new Date(Date.now()-60000).toISOString();local.people[0].kept=true;local.people[0].contactResearch={policyVersion:'20261021-adaptive-depth-v2',checks:{gmail:{status:'complete',checkedAt:new Date(Date.now()-60000).toISOString()}}};
 const ui=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),ctx={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,enrichmentResults:new Map(),personKey:(c,p)=>p.id,BUYER_RESEARCH_VERSION:'test',PUBLIC_NAME_CHECK_VERSION:'test'};
 require('./helpers/crm-hydration-context.cjs')(ctx);
 vm.createContext(ctx);vm.runInContext(ui.slice(ui.indexOf('function restoreNewerBuyerResearch('),ui.indexOf('function hydrateLocalPipelineFromCrm(')),ctx);
 assert.equal(ctx.restoreNewerBuyerResearch(local,detail),true);assert.equal(local.people[0].contactResearch.checks.gmail.queryLog.length,3);assert.equal(local.people[0].contactResearch.checks.direct_email.queryLog.length,2);assert.equal(local.people[0].kept,true);
});
test('resuming a page-limited research run reads outstanding sources before reporting completion',async()=>{
 const c=company();c.people.push({...buyer,id:'bob',name:'Bob Svensson'});const plans=new Map(),read=[],rows=[];
 const search=async q=>{if(!plans.has(q))plans.set(q,plans.size);return [0,1].map(i=>({url:`https://association.test/query-${plans.get(q)}/${i}`}));};
 const readPage=async url=>{read.push(url);return {markdown:'Example business source',metadata:{sourceURL:url}};};
 await D.runMandatoryBuyerResearch(c,{search,readPage,rows});assert.equal(c.publicResearch.accountability.status,'partial');
 assert.ok(c.people.some(p=>Object.values(p.contactResearch.checks).some(row=>row.queryLog?.some(q=>q.status==='partial'))));
 const first=read.length;await D.runMandatoryBuyerResearch(c,{search,readPage,rows,accountability:c.publicResearch.accountability});
 assert.ok(read.length>first+1);assert.equal(c.publicResearch.accountability.status,'complete');assert.equal(D.buyerResearchCoveragePassed(c),true);
});
test('Gmail card shows sourced matches and separate name patterns, never confirmation or automatic readiness',()=>{
 const ui=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),ctx={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc:String,emailPatternCandidates:D.rankedEmailGuesses};
 vm.createContext(ctx);vm.runInContext(ui.slice(ui.indexOf('function buyerContactRows('),ui.indexOf('function emailPatternCandidates(')),ctx);
 const p={...buyer,gmailCandidates:D.gmailGuessCandidates(buyer),gmailMatches:[{email:'anna.andersson@gmail.com',url:source.url,quote:source.markdown,status:'unconfirmed',matchBasis:'Full name + company context'}],contactResearch:{checks:{gmail:{status:'complete',queryLog:[1,2,3].map(()=>({status:'complete'}))}}}};
 const html=ctx.buyerContactRows(p,company());assert.match(html,/anna.andersson@gmail.com/);assert.match(html,/Possible match.*[Uu]nconfirmed/);assert.match(html,/Full name \+ company context/);assert.match(html,/Name-based Gmail patterns/);assert.match(html,/3\/3 searches/);assert.doesNotMatch(html,/Email confirmed|mailto:/);
});
