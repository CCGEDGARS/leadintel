import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId,foreignWorkspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {handleCompanyListsRoute,runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import app from '../src/app.js';
const referenceQuote='Builds automated production equipment for factories';
async function setup(t){const f=await buyerJobsFixture(t);f.payload.main.referenceCustomers={rows:[{id:'r1',companyName:'Reference',website:'https://reference.example/'}],analyses:{r1:{sourceEvidence:[{field:'capabilities',quote:referenceQuote,url:'https://reference.example/'}]}}};await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:1,payload:f.payload});return f;}
const input={action:'start',name:'Swedish matches',count:10,signalIds:['lookalike'],referenceIds:['current:r1'],markets:['Sweden'],budget:100};
function services(n=10){return {search:async()=>Array.from({length:n},(_,i)=>({url:`https://factory${i}.example/`})),read:async url=>({url,markdown:`Factory${new URL(url).hostname.match(/\d+/)[0]} builds automated production equipment. Operates from Stockholm in Sweden.`}),generate:async p=>{if(p.stage==='review')return {decision:'pass',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedSignalIds:p.candidate.matches.map(m=>m.signalId),reason:'Official company operations and location support the selected reference comparison and seller application.',gaps:[]};if(p.stage==='plan')return {queries:['Sweden production equipment manufacturers']};const page=p.pages.at(-1),company=page.text.split(' ')[0];return {company,website:page.url,commercialFit:{status:'supported',url:page.url,quote:`${company} builds automated production equipment.`,reason:'Its production equipment operations are relevant to the supplied seller offer.'},identity:{url:page.url,quote:`${company} builds automated production equipment.`},location:{market:'Sweden',label:'Stockholm',url:page.url,quote:'Operates from Stockholm in Sweden.'},matches:[{signalId:'lookalike',url:page.url,quote:`${company} builds automated production equipment.`,referenceId:'current:r1',referenceQuote,strength:90,reason:'Both build automated production equipment.'}]};}};}
async function route(f,body,role='owner',params={},waits=[]){return handleCompanyListsRoute(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users[role].token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{}, {waitUntil:p=>waits.push(p)});}
async function tick(f,now=Date.now()){const waits=[],noop=async()=>{};await app.scheduled({cron:'* * * * *',scheduledTime:now},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);}
test('storage-full checkpoints retain saved progress and stop with a recoverable status',async t=>{const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=services();const waits=[],first=(await (await route(f,input,'owner',{},waits)).json()).list;await Promise.all(waits);const before=await readCompanyList(f.env,workspaceId,first.id);assert.ok(before.results.length>0);f.DB.raw.exec("CREATE TRIGGER test_list_storage BEFORE UPDATE OF state_json ON company_lists BEGIN SELECT RAISE(ABORT,'WORKSPACE_STORAGE_FULL'); END");await tick(f);const stopped=await readCompanyList(f.env,workspaceId,first.id);assert.equal(stopped.status,'incomplete');assert.match(stopped.progress.reason,/storage is full/);assert.deepEqual(stopped.results,before.results);f.DB.raw.exec('DROP TRIGGER test_list_storage');const resumed=[];assert.equal((await route(f,{action:'resume',id:stopped.id,revision:stopped.revision},'owner',{},resumed)).status,200);await Promise.all(resumed);assert.ok((await readCompanyList(f.env,workspaceId,first.id)).results.length>=before.results.length);});
test('authenticated HTTP wake, registered cron, durable 10-row ranking, CRM save/export input, fresh read, buyer selection and deletion',async t=>{const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=services();const waits=[],response=await route(f,input,'owner',{},waits);assert.equal(response.status,200);const {list:first}=await response.json();assert.equal(waits.length,1);await Promise.all(waits);for(let i=0;i<10;i++){if((await readCompanyList(f.env,workspaceId,first.id)).status==='complete')break;await tick(f);}let list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'complete');assert.equal(list.results.length,10);assert.ok(list.results.every(r=>r.score===90));assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_companies').get().n,0);const save=await route(f,{action:'save',id:list.id,revision:list.revision});assert.equal(save.status,200);list=(await save.json()).list;assert.equal(list.saved,true);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_companies').get().n,10);const fresh=await (await route(f,null,'owner',{id:list.id})).json();assert.equal(fresh.list.results.length,10);const buyer=await (await route(f,{action:'buyer',id:list.id,revision:list.revision,domain:'factory0.example'})).json();assert.ok(buyer.candidate.crmId);const deleted=await route(f,{action:'delete',id:list.id,revision:list.revision});assert.equal(deleted.status,200);assert.equal(await readCompanyList(f.env,workspaceId,list.id),null);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_companies').get().n,10);});
test('isolation, role checks, custom bounds and one active request per workspace',async t=>{const f=await setup(t);for(const role of ['viewer','foreign'])assert.equal((await route(f,input,role)).status,403);assert.equal((await route(f,{...input,count:201})).status,400);f.env.COMPANY_LIST_TEST_SERVICES=services();const waits=[],r=await route(f,input,'owner',{},waits),{list}=await r.json();assert.equal(await readCompanyList(f.env,foreignWorkspaceId,list.id),null);assert.equal((await route(f,input)).status,409);await Promise.all(waits);assert.equal((await route(f,{action:'pause',id:list.id,revision:0})).status,409);});
test('budget pause and provider failure preserve matches; resume does not repeat completed reads',async t=>{const f=await setup(t),base=services();let reads=0,offline=false;f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async url=>{if(offline)throw Error('Provider quota failure');reads++;return base.read(url);}};const waits=[],first=(await (await route(f,{...input,budget:10},'owner',{},waits)).json()).list;await Promise.all(waits);await tick(f);let list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'incomplete');assert.ok(list.results.length>0&&list.results.length<10);assert.equal(list.progress.operations,10);const done=list.results.map(r=>r.domain);offline=true;const w=[];await route(f,{action:'resume',id:list.id,revision:list.revision},'owner',{},w);await Promise.all(w);list=await readCompanyList(f.env,workspaceId,list.id);assert.equal(list.status,'incomplete');assert.ok(done.every(domain=>list.results.some(r=>r.domain===domain)));offline=false;const w2=[];await route(f,{action:'resume',id:list.id,revision:list.revision},'owner',{},w2);await Promise.all(w2);await tick(f);list=await readCompanyList(f.env,workspaceId,list.id);assert.ok(list.results.length>=done.length);assert.ok(reads<=10);});
test('cancel during source work rejects late completion and revocation prevents new provider calls',async t=>{const f=await setup(t);let entered,release;const seen=new Promise(r=>entered=r),gate=new Promise(r=>release=r),base=services();f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async url=>{entered();await gate;return base.read(url);}};const waits=[],first=(await (await route(f,input,'owner',{},waits)).json()).list;await seen;let list=await readCompanyList(f.env,workspaceId,first.id);assert.equal((await route(f,{action:'pause',id:list.id,revision:list.revision})).status,200);release();await Promise.all(waits);list=await readCompanyList(f.env,workspaceId,list.id);assert.equal(list.status,'canceled');assert.equal(list.results.length,0);f.DB.raw.prepare("UPDATE company_lists SET status='queued'").run();f.DB.raw.prepare('DELETE FROM sessions WHERE token_hash=?').run(f.users.owner.sessionTokenHash);f.env.COMPANY_LIST_TEST_SERVICES={search:()=>assert.fail('revoked search'),read:()=>assert.fail('revoked read'),generate:()=>assert.fail('revoked AI')};await tick(f);assert.equal((await readCompanyList(f.env,workspaceId,list.id)).status,'incomplete');});
test('200-company background list completes within one reviewed allowance and saves all rows in resumable CRM batches without overwriting existing records',async t=>{
 const f=await setup(t),base=services();let batch=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>p.stage==='plan'?{queries:Array.from({length:8},(_,i)=>'Sweden manufacturer segment '+(p.round*8+i))}:base.generate(p),search:async()=>Array.from({length:10},(_,i)=>({url:`https://factory${batch*10+i}.example/`})).map((r,i,all)=>{if(i===all.length-1)batch++;return r;})};
 const waits=[],first=(await (await route(f,{...input,count:200,budget:4000},'owner',{},waits)).json()).list;await Promise.all(waits);let list;
 for(let i=0;i<80;i++){list=await readCompanyList(f.env,workspaceId,first.id);if(list.status==='complete')break;assert.notEqual(list.status,'incomplete',list.progress.reason);await tick(f);}
 assert.equal(list.status,'complete');assert.equal(list.results.length,200);assert.equal(new Set(list.results.map(r=>r.domain)).size,200);assert.ok(list.results.every(r=>r.quality.status==='reviewed'&&r.audit.review.status==='complete'&&r.audit.reads.length));assert.equal(list.progress.operationTotals.complete,list.progress.operations);assert.equal(list.progress.operationTotals.failed,0);assert.ok(list.receipts.length<=250);assert.ok(list.results[0].audit.review.id>0,'old per-company receipt survives recent receipt truncation');
 assert.equal((await route(f,{action:'save',id:list.id,revision:list.revision,cursor:180})).status,400,'cannot skip earlier save batches');
 let cursor=0;do{const result=await (await route(f,{action:'save',id:list.id,revision:list.revision,cursor})).json();assert.ok(result.list,JSON.stringify(result));list=result.list;cursor=result.nextCursor;}while(cursor!==null);
 assert.equal(list.saved,true);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM crm_companies').get().n,200);
 f.DB.raw.prepare("UPDATE crm_companies SET company_name='User edited company',opportunity_score=77 WHERE normalized_domain='factory0.example'").run();
 await route(f,{action:'save',id:list.id,revision:list.revision,cursor:0});const old=f.DB.raw.prepare("SELECT company_name,opportunity_score FROM crm_companies WHERE normalized_domain='factory0.example'").get();assert.equal(old.company_name,'User edited company');assert.equal(old.opportunity_score,77);
});

test('a temporary provider failure retries on a later scheduler wake within the same allowance',async t=>{
 const f=await setup(t),base=services(),readCounts=new Map();let failures=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async url=>{readCounts.set(url,(readCounts.get(url)||0)+1);if(url.includes('factory1.')&&failures++===0)throw Object.assign(Error('temporary timeout'),{status:504});return base.read(url);}};
 const waits=[],first=(await (await route(f,input,'owner',{},waits)).json()).list;await Promise.all(waits);
 let list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'queued');assert.equal(list.progress.phase,'retrying');assert.equal(list.results.length,1);assert.equal(list.progress.allowance,100);
 const attempts=list.progress.operations;await tick(f);assert.equal((await readCompanyList(f.env,workspaceId,first.id)).progress.operations,attempts,'retry waits until its scheduled time');
 await tick(f,list.progress.nextAttemptAt+1);
 for(let i=0;i<10;i++){list=await readCompanyList(f.env,workspaceId,first.id);if(list.status==='complete')break;await tick(f);}
 assert.equal(list.status,'complete');assert.equal(list.progress.allowance,100);assert.equal(list.progress.operationTotals.failed,1);assert.equal(readCounts.get('https://factory0.example/'),1);assert.equal(readCounts.get('https://factory1.example/'),2);assert.equal(list.failureCode,'');
});

test('credit exhaustion in a failed extractor trace blocks immediately, preserving completed source work',async t=>{
 const f=await setup(t),base=services();f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async()=>{throw Object.assign(Error('Public source extraction unavailable'),{status:502,researchTrace:[{provider:'firecrawl',operation:'extract',status:'failed',httpStatus:402}]});}};
 const waits=[],first=(await (await route(f,input,'owner',{},waits)).json()).list;await Promise.all(waits);
 const list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'incomplete');assert.equal(list.failureCode,'funds');assert.match(list.progress.reason,/credits/);assert.equal(list.progress.nextAttemptAt,0);assert.equal(list.progress.operationTotals.failed,1);assert.equal(list.receipts.at(-1).providers[0].httpStatus,402);
});

test('irrelevant or contradictory literal quotes cannot pass the separate evidence review or fill a short list',async t=>{
 const f=await setup(t),base=services(2);
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>p.stage==='review'&&p.candidate.domain==='factory0.example'?{decision:'reject',supportedSignalIds:[],reason:'This source describes the reference customer, not the proposed company.',gaps:['Wrong company attribution']}:base.generate(p)};
 const waits=[],first=(await (await route(f,{...input,count:2},'owner',{},waits)).json()).list;await Promise.all(waits);
 for(let i=0;i<5;i++)await tick(f);
 const list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'incomplete');assert.equal(list.results.length,1);assert.equal(list.results[0].domain,'factory1.example');assert.equal(list.failureCode,'search_exhausted');assert.equal(list.incompleteChecks[0].status,'rejected');assert.match(list.incompleteChecks[0].reason,/Wrong company/);assert.equal(list.progress.operationTotals.complete,list.progress.operations);
});

test('missing evidence follows actual links, keeps full source text, and counts only after the follow-up review',async t=>{
 const f=await setup(t),base=services(1);let reviewCount=0;const reads=[];
 f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async url=>{reads.push(url);const page=await base.read(url);return {...page,markdown:page.markdown+' Additional page context is retained for semantic review.',links:['https://factory0.example/products']};},generate:async p=>{
  if(p.stage==='review'&&reviewCount++===0)return {decision:'needs_evidence',reason:'Need product evidence',gaps:['Product application needs verification'],followupUrls:['https://invented.example/','https://factory0.example/products']};
  if(p.stage==='review'){assert.equal(p.pages.length,2);assert.ok(p.pages.every(page=>page.text.includes('Additional page context')));}
  const value=await base.generate(p);if(p.stage==='assess')value.website='https://factory0.example/';return value;
 }};
 const waits=[],first=(await (await route(f,{...input,count:1},'owner',{},waits)).json()).list;await Promise.all(waits);for(let i=0;i<5;i++)await tick(f);
 const list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'complete');assert.equal(list.results.length,1);assert.deepEqual(reads,['https://factory0.example/','https://factory0.example/products']);assert.equal(list.results[0].audit.reads.length,2);assert.equal(list.incompleteChecks.length,0,'a successful follow-up resolves its earlier evidence gap');assert.equal(list.results[0].quality.status,'reviewed');
});

test('malformed reasoning responses have bounded retries and cannot become a completed match',async t=>{
 const f=await setup(t),base=services();f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>p.stage==='plan'?{queries:'not a list'}:base.generate(p)};
 const waits=[],first=(await (await route(f,input,'owner',{},waits)).json()).list;await Promise.all(waits);
 let list=await readCompanyList(f.env,workspaceId,first.id);
 for(let i=0;i<2;i++){assert.equal(list.status,'queued');await tick(f,list.progress.nextAttemptAt+1);list=await readCompanyList(f.env,workspaceId,first.id);}
 assert.equal(list.status,'incomplete');assert.equal(list.progress.operations,3);assert.equal(list.progress.operationTotals.failed,3);assert.equal(list.results.length,0);assert.match(list.progress.reason,/three attempts/);
});

test('API resolves only the active signal; Lookalike and an alias use reference evidence without inactive events',async t=>{
 const f=await setup(t);f.payload.main.market={signals:[{id:'custom-lookalike',name:'Lookalike',active:true},{id:'hiring',name:'Hiring',active:false}],deletedSignalIds:['funding']};
 await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:2,payload:f.payload});
 const options=(await (await route(f,null,'owner',{options:'1'})).json()).options;assert.deepEqual(options.signals.map(s=>s.id),['lookalike']);
 assert.equal((await route(f,{...input,signalIds:['hiring']})).status,400);
 const base=services(1);f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>{assert.deepEqual(p.criteria.signals.map(s=>s.id),['lookalike']);return base.generate(p);}};
 const waits=[],first=(await (await route(f,{...input,count:1},'owner',{},waits)).json()).list;await Promise.all(waits);await tick(f);const list=await readCompanyList(f.env,workspaceId,first.id);
 assert.equal(list.status,'complete');assert.deepEqual(list.results[0].matches.map(m=>m.signalId),['lookalike']);assert.equal(list.results[0].matches[0].referenceUrl,'https://reference.example/');
});

test('a restart after the last successful checkpoint finishes without buying another operation',async t=>{
 const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=services(1);
 const waits=[],first=(await (await route(f,{...input,count:1,budget:10},'owner',{},waits)).json()).list;await Promise.all(waits);
 const before=await readCompanyList(f.env,workspaceId,first.id);assert.equal(before.status,'complete');
 f.DB.raw.prepare("UPDATE company_lists SET status='queued',state_json=json_set(state_json,'$.phase','reviewing','$.allowance',json_extract(state_json,'$.operations')) WHERE id=?").run(first.id);
 f.env.COMPANY_LIST_TEST_SERVICES={search:()=>assert.fail('extra search'),read:()=>assert.fail('extra read'),generate:()=>assert.fail('extra reasoning')};
 await tick(f);const after=await readCompanyList(f.env,workspaceId,first.id);assert.equal(after.status,'complete');assert.equal(after.progress.operations,before.progress.operations);assert.deepEqual(after.results,before.results);
});

test('retrying a failed plan does not count the same empty discovery round twice',async t=>{
 const f=await setup(t),base=services(1);let failed=false;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,search:async q=>q==='empty first round'?[]:base.search(),generate:async p=>{
  if(p.stage!=='plan')return base.generate(p);
  if(p.round===0)return {queries:['empty first round']};
  if(!failed){failed=true;throw Object.assign(Error('Temporary model failure'),{status:503});}
  return {queries:['new useful round']};
 }};
 const waits=[],first=(await (await route(f,{...input,count:1},'owner',{},waits)).json()).list;await Promise.all(waits);
 let list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'queued');await tick(f,list.progress.nextAttemptAt+1);list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'complete');
 const state=JSON.parse(f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(first.id).state_json);assert.equal(state.noProgressRounds,1);
});
