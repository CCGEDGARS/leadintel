import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import {encryptSecret,importAesKey} from '../src/oauth.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';
const M=globalThis.LeadIntelCompanyLists;
async function setup(t){const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;await save(f);return f;}
async function save(f){await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});}
async function request(f,body,params={},waits=[]){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil:p=>waits.push(p)});}
async function options(f){return (await (await request(f,null,{options:'1'})).json()).options;}
const input={action:'start',name:'Selected profiles',count:5,budget:100,profileIds:['icp-core'],profileMode:'any',signalMode:'off',referenceIds:['current:r1'],markets:['Sweden']};
async function tick(f){const waits=[],noop=async()=>{};let registered=false;await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs:(env,o)=>{registered=true;return runCompanyListJobs(env,o);},runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);assert.equal(registered,true,'registered scheduler must admit the company-list worker');}
async function finish(f,id){for(let i=0;i<10;i++){await tick(f);const list=await readCompanyList(f.env,workspaceId,id);if(['complete','incomplete'].includes(list.status))return list;}assert.fail('Company-list scheduler did not finish');}
async function start(f,change={}){const waits=[],r=await request(f,{...input,contextFingerprint:(await options(f)).contextFingerprint,...change},{},waits);assert.equal(r.status,200,await r.clone().text());const list=(await r.json()).list;await Promise.all(waits);return list;}

test('each of the four selected profiles crosses authenticated HTTP, SQLite checkpoints and the registered scheduler',async t=>{
 for(const profile of profileMain().market.icps)await t.test(profile.name,async t=>{
  const f=await setup(t),prompts=[];f.env.COMPANY_LIST_TEST_SERVICES=profileServices({observe:p=>prompts.push(p)});
  const first=await start(f,{profileIds:[profile.id],signalMode:profile.type==='trigger-led'?'require':'off',signalIds:['hiring']});
  assert.notEqual((await readCompanyList(f.env,workspaceId,first.id)).status,'complete','the browser wake alone must not finish this fixture');
  const list=await finish(f,first.id);assert.equal(list.status,'complete');assert.equal(list.results.length,5);
  assert.ok(prompts.every(p=>p.criteria.profiles.length===1&&p.criteria.profiles[0].id===profile.id));
  assert.ok(list.results.every(r=>r.quality.version===M.PROFILE_VERSION&&r.audit.review.status==='complete'&&r.profileMatches[0].profileId===profile.id));
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_companies').get().n,0);
 });
});
test('profile any/all and buying-signal Off, Prioritize and Require change actual saved results and scores',async t=>{
 const cases=[
  {signalMode:'off',profileMode:'any',names:['Factory0','Factory1','Factory2'],scores:[90,90,90]},
  {signalMode:'boost',profileMode:'any',names:['Factory0','Factory1','Factory2'],scores:[98,94,90]},
  {signalMode:'require',profileMode:'any',mode:'any',names:['Factory0','Factory1'],scores:[98,94]},
  {signalMode:'require',profileMode:'any',mode:'all',names:['Factory0'],scores:[98]},
  {signalMode:'off',profileMode:'all',names:['Factory0'],scores:[90]}
 ];
 for(const c of cases)await t.test(JSON.stringify(c),async t=>{
  const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=profileServices({count:3,coverage:name=>({profiles:name==='Factory0'?true:[name==='Factory1'?'icp-core':'icp-reference-lookalike'],signals:name==='Factory0'?true:name==='Factory1'?['hiring']:[]})});
  const list=await finish(f,(await start(f,{profileIds:['icp-core','icp-reference-lookalike'],count:3,signalIds:['hiring','expansion'],...c})).id);
  assert.deepEqual(list.results.map(r=>r.company),c.names);assert.deepEqual(list.results.map(r=>r.score),c.scores);
  assert.equal(list.status,c.names.length===3?'complete':'incomplete');if(list.status==='incomplete')assert.equal(list.failureCode,'search_exhausted');
 });
});
test('stale previews fail before spend; Strategy edits affect new runs while in-progress lists and saved CRM evidence remain frozen',async t=>{
 const f=await setup(t),before=await options(f);f.env.COMPANY_LIST_TEST_SERVICES=profileServices();
 assert.equal((await request(f,{...input,signalIds:['lookalike'],profileIds:undefined})).status,409,'old clients must reload explicit profiles');
 const first=await start(f,{profileIds:['icp-reference-lookalike']});
 f.payload.main.market.icps[1].active=false;f.payload.main.market.icps[0].description='Medical equipment manufacturers';
 f.payload.main.market.deletedSignalIds.push('hiring');f.payload.main.market.signals.push({id:'modernization',name:'Modernization',keywords:'medical automation',active:true});await save(f);
 const stale=await request(f,{...input,contextFingerprint:before.contextFingerprint});assert.equal(stale.status,409);assert.match(await stale.text(),/changed|review/i);
 let old=await finish(f,first.id);assert.equal(old.status,'complete');assert.equal(old.criteria.profiles[0].description,'Substantive reference similarity');
 const current=await options(f);assert.equal(current.profiles.find(p=>p.type==='lookalike').active,false);assert.deepEqual(current.buyingSignals.map(s=>s.id),['expansion','modernization']);
 assert.equal((await request(f,{...input,contextFingerprint:current.contextFingerprint,profileIds:['icp-reference-lookalike']})).status,400);
 assert.equal((await request(f,{...input,contextFingerprint:current.contextFingerprint,signalMode:'require',signalIds:['hiring']})).status,400);
 old=(await (await request(f,{action:'save',id:old.id,revision:old.revision})).json()).list;assert.equal(old.saved,true);
 const stored=f.DB.raw.prepare('SELECT research_snapshot_json FROM crm_intelligence LIMIT 1').get();assert.match(stored.research_snapshot_json,/Substantive reference similarity|Lookalike/);
 const csv=M.csv((await (await request(f,null,{id:old.id})).json()).list);assert.match(csv,/Lookalike/);assert.doesNotMatch(csv,/Medical equipment/);
 const next=await finish(f,(await start(f,{count:1,signalMode:'boost',signalIds:['modernization']})).id);assert.equal(next.criteria.profiles[0].description,'Medical equipment manufacturers');assert.deepEqual(next.criteria.signals.map(s=>s.id),['modernization']);
 f.payload.main.market.icps.forEach(p=>p.active=false);await save(f);const off=await options(f);assert.equal(off.profiles.filter(p=>p.active).length,0);assert.equal((await request(f,{...input,contextFingerprint:off.contextFingerprint})).status,400);
});
test('editing a definition without changing its id invalidates a reviewed preview',async t=>{
 const f=await setup(t),before=await options(f);f.payload.main.market.signals[0].keywords='technical maintenance recruitment';await save(f);
 const r=await request(f,{...input,contextFingerprint:before.contextFingerprint,signalMode:'require',signalIds:['hiring']});assert.equal(r.status,409);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM company_lists').get().n,0);
});


test('Any retains a verified profile after the independent reviewer removes an unsupported optional comparison',async t=>{
 const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=profileServices({count:1,reviewChange:()=>({supportedProfileIds:['icp-core']})});
 const list=await finish(f,(await start(f,{count:1,profileIds:['icp-core','icp-reference-lookalike']})).id);assert.equal(list.status,'complete');assert.deepEqual(list.results[0].profileMatches.map(m=>m.profileId),['icp-core']);assert.equal(list.results[0].audit.review.status,'complete');
});

test('a queued search hit can supply linked evidence for the same candidate across the HTTP wake and cron',async t=>{
 const f=await setup(t),base=profileServices(),site='https://factory0.example/',contact=site+'contact';
 const reads=[];let busy=true;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>[{url:site},{url:contact}],
  read:async url=>{
   if(url===contact&&busy){busy=false;throw Object.assign(Error('Busy'),{status:429});}
   reads.push(url);
   return url===site?{url,markdown:'Factory0 builds automated production equipment. Our contact page lists our operating locations.',links:[contact]}:
    {url,markdown:'Factory0 operates in Stockholm, Sweden. Contact our local team.'};
  },
  generate:async p=>{
   if(p.stage!=='assess')return base.generate(p);
   if(p.pages.length===1)return {gaps:['Need both manufacturing and operating location evidence.'],followupUrls:[contact]};
   const value=await base.generate({...p,pages:[p.pages[0]]});
   value.location.url=contact;return value;
  }
 };
 const first=await start(f,{count:1});
 const retry=await readCompanyList(f.env,workspaceId,first.id);assert.equal(retry.failureCode,'rate_limit');
 const pending=[];await app.scheduled({cron:'* * * * *',scheduledTime:retry.progress.nextAttemptAt+1},f.env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);
 const list=await readCompanyList(f.env,workspaceId,first.id);
 assert.equal(list.status,'complete',list.progress.reason);assert.deepEqual(reads,[site,contact]);
 assert.deepEqual(list.results[0].audit.reads.map(r=>r.url),[site,contact]);assert.equal(list.incompleteChecks.length,0);
});

test('production adapters retain a blocked assessment, its provider error and source reads through resume',async t=>{
 const f=await setup(t),responses=profileServices({count:3}),reads=[],stages=[];
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');
 const key=await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY);
 f.DB.raw.prepare('INSERT INTO workspace_ai_integrations(workspace_id,provider,model,active,key_hint,encrypted_api_key) VALUES(?,?,?,?,?,?)').run(workspaceId,'openai','gpt-6.1-sol',1,'test',await encryptSecret('fixture-ai',key));
 f.DB.raw.prepare('INSERT INTO workspace_service_integrations(workspace_id,provider,key_hint,encrypted_api_key) VALUES(?,?,?,?)').run(workspaceId,'firecrawl','test',await encryptSecret('fixture-search',key));
 let blocked=true,rateLimited=true;
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  const {hostname,pathname}=new URL(url);
  if(hostname==='api.openai.com'&&pathname==='/v1/responses'){
   const prompt=JSON.parse(JSON.parse(init.body).input);stages.push(prompt.stage);
   if(prompt.stage==='assess'&&prompt.pages.at(-1).url==='https://factory2.example/'&&blocked){
    return Response.json({error:{code:'invalid_api_key'}},{status:401});
   }
   if(!blocked&&rateLimited){rateLimited=false;return Response.json({error:{code:'rate_limit_exceeded'}},{status:429});}
   return Response.json({output_text:JSON.stringify(await responses.generate(prompt))});
  }
  if(hostname==='api.firecrawl.dev'&&pathname==='/v2/search')return Response.json({success:true,data:{web:await responses.search()}});
  if(/^factory[0-2]\.example$/.test(hostname)){reads.push(url);return new Response((await responses.read(url)).markdown,{headers:{'Content-Type':'text/plain'}});}
  throw Error('Unexpected request to '+hostname);
 });
 const first=await start(f,{count:3,budget:10,signalMode:'require',signalIds:['hiring']});
 let list=await readCompanyList(f.env,workspaceId,first.id);
 assert.equal(list.status,'incomplete');assert.equal(list.failureCode,'connection');assert.equal(list.progress.operations,10);
 assert.equal(list.results.length,2);assert.match(list.progress.reason,/connection/i);
 blocked=false;const waits=[];
 const resumed=await request(f,{action:'resume',id:list.id,revision:list.revision},{},waits);assert.equal(resumed.status,200);await Promise.all(waits);
 list=await readCompanyList(f.env,workspaceId,first.id);assert.equal(list.status,'queued');assert.equal(list.failureCode,'rate_limit');
 const before=list.progress.operations,pending=[];
 await app.scheduled({cron:'* * * * *',scheduledTime:list.progress.nextAttemptAt+1},f.env,{waitUntil:p=>pending.push(p)});await Promise.all(pending);
 list=(await (await request(f,null,{id:list.id})).json()).list;
 assert.equal(list.status,'complete',list.progress.reason);assert.equal(list.progress.operations,before+2);assert.equal(list.results.length,3);
 assert.equal(reads.length,3);assert.equal(new Set(reads).size,3);assert.equal(stages.filter(s=>s==='plan').length,1);
 assert.ok(list.results.every(r=>r.audit.reads[0].providers.some(p=>p.provider==='direct'&&p.status==='succeeded')&&r.audit.review.provider==='openai'));
});

test('200 companies with four profiles and twenty signals preserve evidence across D1-sized checkpoints and CRM',async t=>{
 const f=await setup(t),base=profileServices();
 const signals=Array.from({length:20},(_,i)=>({id:'event-'+i,name:'Production project '+i,active:true}));
 f.payload.main.market.signals=signals;await save(f);
 f.DB.raw.exec(`CREATE TRIGGER fixture_owner_size BEFORE UPDATE OF state_json ON company_lists
   WHEN length(CAST(NEW.state_json AS BLOB))+length(CAST(NEW.input_json AS BLOB))>=2097152 BEGIN SELECT RAISE(ABORT,'D1 row size exceeded'); END;
   CREATE TRIGGER fixture_result_size BEFORE INSERT ON company_list_evidence
   WHEN length(CAST(NEW.result_json AS BLOB))>=2097152 BEGIN SELECT RAISE(ABORT,'D1 row size exceeded'); END;`);
 let batch=0;
 const event=(name,id)=>name+' commissioned the production equipment associated with '+id+'.';
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const offset=batch++*10;return Array.from({length:10},(_,i)=>({url:'https://factory'+(offset+i)+'.example/'}));},
  read:async url=>{const page=await base.read(url),company=page.markdown.split(' ')[0];page.markdown+=' '+signals.map(s=>event(company,s.id)).join(' ');return page;},
  generate:async p=>{
   if(p.stage==='plan')return {queries:Array.from({length:8},(_,i)=>'Equipment production segment '+(p.round*8+i))};
   const value=await base.generate(p);
   if(p.stage==='assess')for(const m of value.signalMatches)m.quote=event(value.company,m.signalId);
   return value;
  }
 };
 const first=await start(f,{count:200,budget:4000,profileIds:profileMain().market.icps.map(x=>x.id),profileMode:'all',signalMode:'require',mode:'all',signalIds:signals.map(x=>x.id)});
 for(let i=0;i<80;i++){
  const row=f.DB.raw.prepare('SELECT status FROM company_lists WHERE id=?').get(first.id);
  if(!['queued','running'].includes(row.status))break;
  await tick(f);
 }
 let list=(await (await request(f,null,{id:first.id})).json()).list;
 assert.equal(list.status,'complete',list.progress.reason);assert.equal(list.results.length,200);
 assert.ok(Buffer.byteLength(JSON.stringify(list.results))>2*1024*1024,'the unsplit result would exceed a D1 row');
 const stored=f.DB.raw.prepare('SELECT result_json FROM company_list_evidence WHERE list_id=?').all(list.id).map(r=>JSON.parse(r.result_json));
 assert.deepEqual(M.ranked(stored),list.results);assert.ok(list.results.every(r=>r.profileMatches.length===4&&r.signalMatches.length===20&&r.audit.review.status==='complete'));
 const summary=(await (await request(f)).json()).lists.find(l=>l.id===list.id);assert.deepEqual(summary.progress,list.progress);
 assert.match(M.csv(list),/Factory199 commissioned the production equipment associated with event-19/);
 const ownerBytes=()=>f.DB.raw.prepare('SELECT length(CAST(state_json AS BLOB))+length(CAST(input_json AS BLOB)) n FROM company_lists WHERE id=?').get(list.id).n;
 assert.ok(ownerBytes()<512*1024);
 let cursor=0;do{const saved=await (await request(f,{action:'save',cursor,id:list.id,revision:list.revision})).json();assert.ok(saved.list,saved.error);list=saved.list;cursor=saved.nextCursor;}while(cursor!==null);
 assert.equal(list.saved,true);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_companies').get().n,200);
 const {candidate}=await (await request(f,{action:'buyer',id:list.id,revision:list.revision,domain:'factory199.example'})).json();
 assert.ok(candidate.crmId);assert.deepEqual(candidate.signalMatches,list.results.find(r=>r.domain===candidate.domain).signalMatches);
 const meter=()=>f.DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes;
 const charged=ownerBytes()+stored.reduce((n,r)=>n+Buffer.byteLength(JSON.stringify(r)),0),before=meter();
 assert.equal((await request(f,{action:'delete',id:list.id,revision:list.revision})).status,200);
 assert.equal(before-meter(),charged);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM company_list_evidence WHERE list_id=?').get(first.id).n,0);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_companies').get().n,200);
});

test('a failed evidence write is atomic and mixed historical rows retain hydrated rank order when saved',async t=>{
 const f=await setup(t),base=profileServices({coverage:name=>({profiles:Number(name.slice(7))%2===0?['icp-core']:true,signals:[]})});let batch=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const offset=batch++*10;return Array.from({length:10},(_,i)=>({url:'https://factory'+(offset+i)+'.example/'}));},
  generate:async p=>p.stage==='plan'?{queries:['first','second','third']}:base.generate(p)
 };
 f.DB.raw.exec("CREATE TRIGGER fixture_failed_evidence BEFORE INSERT ON company_list_evidence WHEN NEW.domain='factory2.example' BEGIN SELECT RAISE(ABORT,'WORKSPACE_STORAGE_FULL'); END");
 const first=await start(f,{count:22,budget:200,profileIds:['icp-core','icp-reference-lookalike']});
 const stopped=await readCompanyList(f.env,workspaceId,first.id);assert.equal(stopped.status,'incomplete');assert.equal(stopped.failureCode,'storage_full');assert.equal(stopped.results.length,2);
 const row=f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(first.id),state=JSON.parse(row.state_json);
 assert.equal(state.pending[0].candidate.domain,'factory2.example','the pre-write checkpoint retains the assessed candidate');
 assert.equal(state.results.some(r=>r.domain==='factory2.example'),false);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM company_list_evidence WHERE list_id=?').get(first.id).n,2);
 f.DB.raw.exec('DROP TRIGGER fixture_failed_evidence');
 // A list created before migration can have an inline result and later acquire separate evidence records.
 state.results[0]=stopped.results.find(r=>r.domain===state.results[0].domain);
 f.DB.raw.prepare('UPDATE company_lists SET state_json=? WHERE id=?').run(JSON.stringify(state),first.id);
 f.DB.raw.prepare('DELETE FROM company_list_evidence WHERE list_id=? AND domain=?').run(first.id,state.results[0].domain);
 const wakes=[];assert.equal((await request(f,{action:'resume',id:stopped.id,revision:stopped.revision},{},wakes)).status,200);await Promise.all(wakes);
 const list=await finish(f,first.id);assert.equal(list.status,'complete');assert.equal(list.results.length,22);
 assert.equal(list.results[0].matches.length,2);assert.equal(list.results.at(-1).matches.length,1);
 assert.equal(new Set(list.results.map(r=>r.score)).size,1);
 const saved=await (await request(f,{action:'save',id:list.id,revision:list.revision,cursor:0})).json();assert.equal(saved.nextCursor,20);
 const domains=f.DB.raw.prepare('SELECT normalized_domain FROM crm_companies WHERE workspace_id=?').all(workspaceId).map(r=>r.normalized_domain);
 assert.deepEqual(domains.sort(),list.results.slice(0,20).map(r=>r.domain).sort());
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM company_list_evidence WHERE list_id=?').get(list.id).n,21);
});
