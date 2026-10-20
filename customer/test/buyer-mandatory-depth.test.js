const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),fs=require('node:fs'),vm=require('node:vm');
const buyer=(name='Anna Andersson')=>({id:name,name,title:'Head of Procurement',organization:'Example',publicNameUrl:'https://example.com/team'});
const company=()=>({company:'Example',domain:'example.com',people:[buyer()]});
test('mandatory buyer depth is bounded and deeper queries target the actual person and company',()=>{
 assert.equal(D.BUYER_CONTACT_RESEARCH_POLICY.maxPeople,10);assert.equal(D.BUYER_CONTACT_RESEARCH_POLICY.deepPeople,4);assert.equal(D.BUYER_CONTACT_RESEARCH_POLICY.concurrency,2);
 const q=D.buyerDeepContactQueries(company(),buyer());assert.equal(q.length,2);for(const s of q){assert.ok(s.includes('Anna Andersson'));assert.ok(s.includes('Example'));assert.ok(s.length<=600);}assert.ok(q.some(s=>s.includes('filetype:pdf')));
});
test('deeper research follows the active customer and keeps long company domains within provider query limits',()=>{
 for(const [company,domain,title] of [['Retail Group','retail.example','Operations Director'],['Law Partners','legal.example','Managing Partner'],['Factory AB','factory.example','Head of Procurement']]){
  const queries=D.buyerDeepContactQueries({company,domain,market:'Sweden',people:[]},{name:'Anna Andersson',title});for(const q of queries){assert.ok(q.includes(company));assert.ok(q.includes(domain));assert.ok(!q.includes('Wernedal'));}
 }
 const domain=['a'.repeat(60),'b'.repeat(60),'c'.repeat(60),'example'].join('.');
 for(const q of D.buyerDeepContactQueries({company:'Long company '.repeat(50),domain},{name:'Anna Andersson',title:'Head of Procurement'})){assert.ok(q.length<=600);assert.equal((q.match(/"/g)||[]).length%2,0);}
});
test('one deeper pass finds a published decision-maker email and the second run reuses completed checks',async()=>{
 const c=company(),queries=[],reads=[];
 const search=async query=>{queries.push(query);return query.includes('filetype:pdf')?[{url:'https://example.com/supplier-guide',title:'Supplier contacts'}]:[];};
 const readPage=async url=>{reads.push(url);return {markdown:'Anna Andersson — Head of Procurement — Example'+(url.endsWith('supplier-guide')?' anna.andersson@example.com':''),metadata:{sourceURL:url,source:'direct-fallback'}};};
 await D.runMandatoryBuyerResearch(c,{search,readPage});
 assert.equal(c.people[0].publicEmail,'anna.andersson@example.com');assert.equal(c.publicResearch.accountability.status,'complete');assert.ok(queries.some(q=>q.includes('filetype:pdf')));assert.equal(reads.length,2);
 const n=queries.length;await D.runMandatoryBuyerResearch(c,{search,readPage});assert.equal(queries.length,n);assert.ok(c.publicResearch.accountability.reusedChecks>=4);
});
test('an upstream ignoring cancellation cannot exceed the shared contact budget or mutate late',async()=>{
 const c=company();let release;const search=()=>new Promise(resolve=>{release=resolve;});
 await D.runMandatoryBuyerResearch(c,{search,maxDurationMs:15});assert.equal(c.publicResearch.accountability.stopReason,'time_budget');assert.equal(c.publicResearch.accountability.status,'partial');
 const saved=JSON.stringify(c);release([{url:'https://example.com/team',markdown:'Anna Andersson — Head of Procurement — Example anna.andersson@example.com'}]);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(JSON.stringify(c),saved);
});
test('mandatory research caps concurrent person searches at two',async()=>{
 const c=company();c.people=['Anna Andersson','Bob Smith','Chris Brown','Diana Jones','Erika Green'].map(buyer);let active=0,maximum=0;
 await D.runMandatoryBuyerResearch(c,{search:async()=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,1));active--;return [];}});assert.equal(maximum,2);assert.equal(c.publicResearch.accountability.checkedPeople,5);
});
test('a zero-result search still reads the known official website when identities came from external profiles',async()=>{
 const c=company();c.people[0].publicNameUrl='https://linkedin.com/in/anna-andersson';const reads=[];
 await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async url=>{reads.push(url);return {markdown:'Example company official business website and contact information.',metadata:{sourceURL:url,source:'direct-fallback'}};}});
 assert.deepEqual(reads,['https://example.com/']);assert.equal(c.publicResearch.accountability.officialPages,1);assert.equal(c.publicResearch.accountability.status,'complete');assert.equal(c.people[0].publicEmail,undefined);
});
test('an interrupted forced refresh cannot retain an earlier completed-check claim',async()=>{
 const c=company();await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async url=>({markdown:'Anna Andersson — Head of Procurement — Example anna.andersson@example.com',metadata:{sourceURL:url,source:'direct-fallback'}})});assert.equal(c.people[0].emailResearch.status,'complete');
 await D.runMandatoryBuyerResearch(c,{force:true,maxDurationMs:10,search:()=>new Promise(()=>{})});assert.equal(c.people[0].emailResearch.status,'partial');assert.equal(c.publicResearch.accountability.checkedPeople,0);
});
test('deep escalation covers at most four unresolved priority people and never calls paid enrichment',async()=>{
 const c=company();c.people=['Anna Andersson','Bob Smith','Chris Brown','Diana Jones','Erika Green'].map(buyer);const queries=[];
 await D.runMandatoryBuyerResearch(c,{search:async q=>{queries.push(q);return [];},readPage:async()=>{throw new Error('No discovered source');}});
 assert.equal(c.people.filter(p=>p.contactResearch.checks.deep?.status==='complete').length,4);
 assert.equal(c.publicResearch.accountability.status,'partial');assert.ok(c.publicResearch.accountability.gaps.some(g=>/official page/i.test(g)));
 for(const provider of ['apollo','hunter']){const row=c.publicResearch.accountability.tools.find(r=>r.provider===provider);assert.equal(row.attempted,0);assert.equal(row.skipped,1);assert.match(row.reason,/separate approval/i);}
});
test('provider failures and cancellation cannot pass the mandatory accountability check',async()=>{
 const c=company();await D.runMandatoryBuyerResearch(c,{search:async()=>{throw new Error('Provider unavailable');}});assert.equal(c.publicResearch.accountability.status,'partial');assert.equal(c.people[0].emailResearch.status,'unavailable');
 const controller=new AbortController();controller.abort();let calls=0;const c2=company();await D.runMandatoryBuyerResearch(c2,{signal:controller.signal,search:async()=>{calls++;return [];}});assert.equal(calls,0);assert.equal(c2.publicResearch.accountability.stopReason,'canceled');assert.equal(c2.publicResearch.accountability.status,'partial');
});
test('actual tool attempts and failures survive normalization and the CRM snapshot',()=>{
 const c=company(),a=D.createBuyerResearchAccountability();D.recordBuyerResearchTool(a,{provider:'direct',status:'failed',operation:'extract',reason:'Blocked'});D.recordBuyerResearchTool(a,{provider:'firecrawl',status:'succeeded',operation:'extract',results:1});
 c.publicResearch={accountability:a};const saved=D.normalizeDiscoveryState({selectedProspects:[{...c,buyerSearchMode:'user_selected_target'}]}).selectedProspects[0];
 assert.equal(saved.publicResearch.accountability.tools.find(r=>r.provider==='direct').failed,1);assert.equal(saved.publicResearch.accountability.tools.find(r=>r.provider==='firecrawl').succeeded,1);assert.equal(saved.publicResearch.accountability.tools.find(r=>r.provider==='scrapling').attempted,0);
 const snapshot=require('../crm-engine.js').mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch;assert.deepEqual(snapshot.publicResearch.accountability,saved.publicResearch.accountability);
});
test('accountability UI distinguishes successful zero-result calls, failures, skipped tools and legacy unknown runs',()=>{
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),start=source.indexOf('function buyerResearchAccountabilityHtml(');assert.ok(start>=0);const end=source.indexOf('\nfunction ',start+10),ctx={LeadIntelDiscovery:D,esc:String};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 const a=D.createBuyerResearchAccountability();D.recordBuyerResearchTool(a,{provider:'firecrawl',status:'succeeded',operation:'search',results:0});D.recordBuyerResearchTool(a,{provider:'scrapling',status:'failed',operation:'extract',reason:'Timeout'});
 const html=ctx.buyerResearchAccountabilityHtml({publicResearch:{accountability:a}});assert.match(html,/Firecrawl/);assert.match(html,/Scrapling/);assert.match(html,/Timeout/);assert.match(html,/0 results/);assert.match(ctx.buyerResearchAccountabilityHtml({}),/not assessed/i);
});
test('runtime records the actual extractor chain and continues observing optional calls after mandatory checks finish',async()=>{
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),a=source.indexOf('async function fetchBuyerResearch('),b=source.indexOf('async function fetchFirecrawlBuyerResearch(',a),controller=new AbortController(),report=D.createBuyerResearchAccountability();report.status='complete';
 const ctx={AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:100,LeadIntelDiscovery:D,publicSearchRows:p=>p.data||p.results||[],fetch:async()=>Response.json({data:{markdown:'Company contacts'},researchTrace:[{provider:'direct',status:'failed'},{provider:'firecrawl',status:'failed'},{provider:'scrapling',status:'succeeded',results:1}]})};
 vm.createContext(ctx);vm.runInContext(source.slice(a,b),ctx);ctx.fetchBuyerResearch.reports=new WeakMap([[controller.signal,report]]);
 const response=await ctx.fetchBuyerResearch('https://api.example/firecrawl/scrape',{signal:controller.signal});assert.equal((await response.json()).data.markdown,'Company contacts');assert.equal(report.tools.find(t=>t.provider==='scrapling').succeeded,1);assert.equal(report.tools.find(t=>t.provider==='firecrawl').failed,1);
 ctx.fetch=async()=>Response.json({data:[]});await ctx.fetchBuyerResearch('https://api.example/firecrawl/search',{signal:controller.signal});assert.equal(report.tools.find(t=>t.provider==='firecrawl').succeeded,1);assert.equal(report.tools.find(t=>t.provider==='firecrawl').results,0);
});
