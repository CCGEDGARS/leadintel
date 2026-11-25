import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';

// A list was researched one operation at a time: about six a minute, hours for fifty companies (live run of
// 22-23 Nov 2026). With COMPANY_LIST_LANES above 1 a slice takes several companies through the same steps at once.
async function setup(t,lanes){const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});if(lanes)f.env.COMPANY_LIST_LANES=String(lanes);return f;}
async function request(f,body,params={},waits=[]){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil:p=>waits.push(p)});}
async function start(f,change={}){const fingerprint=(await (await request(f,null,{options:'1'})).json()).options.contextFingerprint,waits=[],r=await request(f,{action:'start',name:'Lanes',count:3,budget:200,profileIds:['icp-core'],profileMode:'any',signalMode:'off',markets:['Sweden'],contextFingerprint:fingerprint,...change},{},waits);assert.equal(r.status,200,await r.clone().text());const body=await r.json();await Promise.all(waits);return body.list||body;}
async function tick(f,now=Date.now()){const waits=[],noop=async()=>{};await app.scheduled({cron:'* * * * *',scheduledTime:now},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);}
async function finish(f,id,limit=14){for(let i=0;i<limit;i++){const list=await readCompanyList(f.env,workspaceId,id);if(['complete','incomplete'].includes(list.status))return list;await tick(f,list.progress.nextAttemptAt?list.progress.nextAttemptAt+1:Date.now());}assert.fail('Company-list scheduler did not finish');}
const stateOf=(f,id)=>JSON.parse(f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(id).state_json);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const host=url=>new URL(url).hostname;
// Slow services that count how many operations are in flight, in all and for one website.
function watched(count,change={}){
 const base=profileServices({count}),seen={most:0,now:0,sites:new Map(),mostPerSite:0};
 const during=async(url,work)=>{const site=host(url);seen.now++;seen.most=Math.max(seen.most,seen.now);seen.sites.set(site,(seen.sites.get(site)||0)+1);seen.mostPerSite=Math.max(seen.mostPerSite,seen.sites.get(site));try{await pause(15);return await work();}finally{seen.now--;seen.sites.set(site,seen.sites.get(site)-1);}};
 return {seen,services:{...base,
  search:change.search||base.search,
  read:url=>during(url,()=>(change.read||base.read)(url)),
  generate:p=>p.stage==='plan'?base.generate(p):during(p.pages.at(-1).url,()=>(change.generate||base.generate)(p))}};
}
const outcome=state=>({kept:state.results.map(r=>r.company).sort(),reviews:state.reviews.map(r=>host(r.url)+' '+r.status).sort()});

test('several lanes keep the same companies and record the same checks as one lane',async t=>{
 const run=async lanes=>{
  const f=await setup(t,lanes),{services}=watched(8,{generate:async p=>{const answer=await profileServices({count:8}).generate(p);if(p.stage==='assess'&&answer.company==='Factory2')answer.location.label='Greater Stockholm, Sweden';if(p.stage==='review'&&p.candidate.company==='Factory5')return {...answer,decision:'reject',reason:'A confirmed exclusion.',gaps:['Excluded'],identityConfirmed:false};return answer;}});
  f.env.COMPANY_LIST_TEST_SERVICES=services;
  const list=await finish(f,(await start(f,{count:8})).id);return {status:list.status,...outcome(stateOf(f,list.id))};
 };
 const one=await run(0),four=await run(4);
 assert.deepEqual(one.kept,['Factory0','Factory1','Factory3','Factory4','Factory6','Factory7']);
 assert.deepEqual(four,one);
});

test('with four lanes several companies are in work at once, and one website is never in two lanes',async t=>{
 const f=await setup(t,4),{seen,services}=watched(8,{search:async()=>[{url:'https://factory0.example/'},{url:'https://factory0.example/about'},{url:'https://factory1.example/'},{url:'https://factory1.example/contact'},...Array.from({length:6},(_,i)=>({url:`https://factory${i+2}.example/`}))]});
 f.env.COMPANY_LIST_TEST_SERVICES=services;
 const list=await finish(f,(await start(f,{count:8})).id);
 assert.equal(list.status,'complete');
 assert.ok(seen.most>=3&&seen.most<=4,'operations in flight at once: '+seen.most);
 assert.equal(seen.mostPerSite,1);
 const alone=await setup(t,0),single=watched(8);alone.env.COMPANY_LIST_TEST_SERVICES=single.services;
 await finish(alone,(await start(alone,{count:8})).id);
 assert.equal(single.seen.most,1,'one lane works on one operation at a time');
});

test('reaching the requested number stops new work and keeps no company beyond it',async t=>{
 const f=await setup(t,4),{services}=watched(12);f.env.COMPANY_LIST_TEST_SERVICES=services;
 const list=await finish(f,(await start(f,{count:3})).id),state=stateOf(f,list.id);
 assert.equal(list.status,'complete');
 assert.equal(state.results.length,3);
 assert.equal(new Set(state.results.map(r=>r.domain)).size,3);
 assert.ok(state.operations<12*3,'not every candidate was taken to the end: '+state.operations);
 assert.deepEqual(state.flying,[]);
});

test('a page whose answer is refused twice is skipped at once; the other lanes go on and the list does not sleep',async t=>{
 const f=await setup(t,4),asked=new Map(),{services}=watched(5,{generate:async p=>{if(p.stage==='assess'&&host(p.pages.at(-1).url)==='factory1.example'){asked.set('factory1',(asked.get('factory1')||0)+1);return ['a list is not an answer'];}return profileServices({count:5}).generate(p);}});
 f.env.COMPANY_LIST_TEST_SERVICES=services;
 const first=await start(f,{count:4});await tick(f);
 const list=await readCompanyList(f.env,workspaceId,first.id),state=stateOf(f,first.id);
 assert.equal(list.status,'complete','finished in the first slice, with no retry wait');
 assert.deepEqual(state.results.map(r=>r.company).sort(),['Factory0','Factory2','Factory3','Factory4']);
 assert.equal(asked.get('factory1'),2);
 assert.equal(state.reviews.find(r=>host(r.url)==='factory1.example').reason,'This source could not be assessed: the reasoning answer was unusable twice.');
 assert.ok(!state.nextAttemptAt);
});

test('the allowance is never exceeded by lanes working at once',async t=>{
 const f=await setup(t,4),{services}=watched(12);f.env.COMPANY_LIST_TEST_SERVICES=services;
 const list=await finish(f,(await start(f,{count:10,budget:14})).id),state=stateOf(f,list.id);
 assert.equal(list.status,'incomplete');assert.equal(state.failureCode,'allowance');
 assert.equal(state.operations,14);assert.equal(state.operationTotals.started,14);
});

test('every kept company of a list larger than twenty has its evidence row',async t=>{
 // One search gives at most ten pages, so three searches feed the lanes.
 let searches=0;const f=await setup(t,6),{services}=watched(30,{search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));}});
 f.env.COMPANY_LIST_TEST_SERVICES={...services,generate:p=>p.stage==='plan'?Promise.resolve({queries:p.round?[]:['first','second','third']}):services.generate(p)};
 const list=await finish(f,(await start(f,{count:22,budget:400})).id,30),state=stateOf(f,list.id);
 assert.equal(list.status,'complete');assert.equal(state.results.length,22);
 const rows=f.DB.raw.prepare('SELECT domain,evidence_id FROM company_list_evidence WHERE list_id=?').all(list.id);
 assert.equal(rows.length,22);
 assert.deepEqual(rows.map(r=>r.domain).sort(),state.results.map(r=>r.domain).sort());
});

// The tests below drive every slice themselves (no waitUntil at the start), as the reviewer of 23 Nov 2026 did.
async function bare(f,body,params={}){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{});}
async function startBare(f,change={}){const fingerprint=(await (await bare(f,null,{options:'1'})).json()).options.contextFingerprint,r=await bare(f,{action:'start',name:'Lanes',count:3,budget:200,profileIds:['icp-core'],profileMode:'any',signalMode:'off',markets:['Sweden'],contextFingerprint:fingerprint,...change});assert.equal(r.status,200,await r.clone().text());const body=await r.json();return body.list||body;}
const statusOf=(f,id)=>f.DB.raw.prepare('SELECT status FROM company_lists WHERE id=?').get(id).status;
const active=(f,id)=>['queued','running'].includes(statusOf(f,id));

test('a model outage keeps every page: the lanes stop, the list retries later, although pages are read at different speeds',async t=>{
 const f=await setup(t,4),base=profileServices({count:8});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  read:async url=>{await pause(5+30*Number(host(url).match(/\d+/)[0]));return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return base.generate(p);await pause(2);throw new Error('Reasoning request failed (503)');}};
 const list=await startBare(f,{count:8});
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:45000});
 const state=stateOf(f,list.id);
 assert.equal(statusOf(f,list.id),'queued');assert.equal(state.phase,'retrying');
 assert.ok(state.nextAttemptAt>Date.now());
 assert.match(state.reason,/temporarily unavailable.*Retrying automatically \(1\/2\)/);
 assert.equal(state.reviews.length,0,'no page was given up');
 assert.equal(state.pending.length,8,'every page is still waiting');
 assert.ok(state.operations<=14,'a few answers were tried, not every page twice: '+state.operations);
 // The second slice first reads the pages the first one had not reached (they are put to the head of the queue here).
 // Those successful reads do not end the model's retry count.
 const unread=state.pending.filter(page=>!page.page).length;assert.ok(unread>=1,'some pages are still unread: '+unread);
 state.pending.sort((a,b)=>Boolean(a.page)-Boolean(b.page));
 f.DB.raw.prepare('UPDATE company_lists SET state_json=? WHERE id=?').run(JSON.stringify(state),list.id);
 await runCompanyListJobs(f.env,{jobId:list.id,now:state.nextAttemptAt+1,windowMs:45000});
 const second=stateOf(f,list.id);
 assert.equal(statusOf(f,list.id),'queued');
 assert.ok(second.pending.filter(page=>!page.page).length<unread,'pages were read in the second slice');
 assert.match(second.reason,/Retrying automatically \(2\/2\)/);
 assert.equal(second.reviews.length,0);
});

test('a model that always runs into its time limit ends as a provider failure after three waits, not as a spent allowance',async t=>{
 const f=await setup(t,4),base=profileServices({count:5});let fake=Date.now();
 const timedOut=()=>Object.assign(new Error('Research operation timed out.'),{code:'timeout',status:504});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>{if(p.stage==='plan')return base.generate(p);const from=fake;await pause(5);fake=Math.max(fake,from+25000);throw timedOut();}};
 const list=await startBare(f,{count:4,budget:60}),trail=[];
 for(let i=0;i<12&&active(f,list.id);i++){
  const before=stateOf(f,list.id),now=Math.max(Date.now(),(before.nextAttemptAt||0)+1);fake=Math.max(fake,now);
  await runCompanyListJobs(f.env,{jobId:list.id,now,clock:()=>fake,windowMs:45000});
  const state=stateOf(f,list.id);trail.push(statusOf(f,list.id)+' '+(state.nextAttemptAt?'waits':'')+' '+(state.failureCode||''));
 }
 const state=stateOf(f,list.id);
 assert.deepEqual(trail,['queued waits provider_temporary','queued waits provider_temporary','incomplete  provider_temporary']);
 assert.match(state.reason,/Automatic retries stopped after three attempts/);
 assert.ok(state.operations<30,'the allowance of 60 was not spent on time-outs: '+state.operations);
 assert.equal(state.reviews.length,0);
});

test('when the write of a kept company with its evidence fails, the slice ends there and the stored list stays whole and readable',async t=>{
 let searches=0;const f=await setup(t,6),base=profileServices({count:30});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  read:async url=>{await pause(15);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};await pause(15);return base.generate(p);}};
 const batch=f.DB.batch.bind(f.DB);let failed=0;
 f.DB.batch=async statements=>{if(statements.length===2&&!failed){failed++;await pause(1);throw new Error('D1_ERROR: Network connection lost.');}return batch(statements);};
 const list=await startBare(f,{count:22,budget:400});
 for(let i=0;i<30&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 assert.equal(failed,1,'the failure was met');
 const state=stateOf(f,list.id),rows=f.DB.raw.prepare('SELECT domain FROM company_list_evidence WHERE list_id=?').all(list.id).map(r=>r.domain);
 assert.equal(statusOf(f,list.id),'incomplete');
 assert.deepEqual(state.results.map(r=>r.domain).filter(domain=>!rows.includes(domain)),[],'no stored company without its evidence row');
 const read=await readCompanyList(f.env,workspaceId,list.id);
 assert.equal(read.results.length,state.results.length,'the list can still be read');
});

test('the state row stays far under D1\'s 2 MB with eight lanes on full pages whose reviews all ask for three more',async t=>{
 const f=await setup(t,8),base=profileServices({count:12});
 const pad=' Lorem ipsum dolor sit amet production equipment.'.repeat(400);
 const links=url=>Array.from({length:100},(_,k)=>`https://${host(url)}/page/${encodeURIComponent(new URL(url).pathname.replace(/\//g,'_'))}-${k}`);
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>Array.from({length:12},(_,i)=>({url:`https://factory${i}.example/`})),
  read:async url=>{await pause(10);const page=await base.read(url);return {...page,markdown:(page.markdown+pad).slice(0,16000),links:links(url)};},
  generate:async p=>{const answer=await base.generate(p);await pause(10);return p.stage==='review'?{...answer,decision:'needs_evidence',reason:'More evidence needed.',gaps:['Need more'],followupUrls:p.pages.at(-1).links.slice(0,3)}:answer;}};
 let peak=0,copies=0;const prepare=f.DB.prepare.bind(f.DB),count=(text,part)=>text.split(part).length-1;
 f.DB.prepare=sql=>{const statement=prepare(sql);if(/^UPDATE company_lists SET state_json=\?/.test(sql)){const bind=statement.bind.bind(statement);statement.bind=(...values)=>{peak=Math.max(peak,Buffer.byteLength(values[0]));copies=Math.max(copies,count(values[0],'Factory3 builds automated production equipment. Factory3 operates'));return bind(...values);};}return statement;};
 const list=await startBare(f,{count:12,budget:200});
 for(let i=0;i<6&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 assert.ok(peak>300000,'the pages are large enough to matter: '+peak);
 assert.ok(peak<1200000,'peak state size in bytes, with room to D1\'s 2,000,000: '+peak);
 assert.ok(copies>=1&&copies<=6,'a read page is stored once, however many follow-up pages refer to it (one company has at most six pages here): '+copies);
 assert.ok(stateOf(f,list.id).operations>60,'the lanes kept working: '+stateOf(f,list.id).operations);
});

test('companies kept by several lanes while the database is slow each get their evidence row',async t=>{
 let searches=0;const f=await setup(t,6),base=profileServices({count:30});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  read:async url=>{await pause(8);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};await pause(8);return base.generate(p);}};
 // Every state write takes longer than a model answer, so several reviews end while one write is on its way.
 const prepare=f.DB.prepare.bind(f.DB),batch=f.DB.batch.bind(f.DB);
 f.DB.prepare=sql=>{const statement=prepare(sql);if(/^UPDATE company_lists SET state_json=\?/.test(sql)){const bind=statement.bind.bind(statement);statement.bind=(...values)=>{const bound=bind(...values),run=bound.run.bind(bound);bound.run=async()=>{await pause(25);return run();};return bound;};}return statement;};
 f.DB.batch=async statements=>{await pause(25);return batch(statements);};
 const list=await startBare(f,{count:22,budget:400});
 for(let i=0;i<40&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 const state=stateOf(f,list.id),rows=f.DB.raw.prepare('SELECT domain FROM company_list_evidence WHERE list_id=?').all(list.id).map(r=>r.domain);
 assert.equal(statusOf(f,list.id),'complete');assert.equal(state.results.length,22);
 assert.deepEqual(state.results.map(r=>r.domain).filter(domain=>!rows.includes(domain)),[]);
 await readCompanyList(f.env,workspaceId,list.id);
});

test('a list that stopped in one slice goes on in the next from the pages it had already read',async t=>{
 const f=await setup(t,4),base=profileServices({count:6});let down=true,reads=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  read:async url=>{reads++;await pause(5);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return base.generate(p);await pause(20);if(down)throw new Error('Reasoning request failed (503)');return base.generate(p);}};
 const list=await startBare(f,{count:6});
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:45000});
 const first=stateOf(f,list.id),readFirst=reads;
 assert.equal(statusOf(f,list.id),'queued');
 assert.ok(first.pending.filter(page=>page.page).length>=3,'several pages were read before the lanes stopped');
 assert.ok(first.pagePool&&Object.keys(first.pagePool).length>=3,'each read page is stored once, in the pool');
 down=false;
 await runCompanyListJobs(f.env,{jobId:list.id,now:first.nextAttemptAt+1,windowMs:45000});
 const second=stateOf(f,list.id);
 assert.equal(statusOf(f,list.id),'complete');
 assert.deepEqual(second.results.map(r=>r.company).sort(),['Factory0','Factory1','Factory2','Factory3','Factory4','Factory5']);
 assert.equal(reads,6,'no page was read twice: '+readFirst+' in the first slice');
});

test('one page whose answer never comes in time is given up after the model answered for others; the list finishes without it',async t=>{
 const f=await setup(t,4),base=profileServices({count:5});let fake=Date.now(),sliceStart=fake;
 const timedOut=()=>Object.assign(new Error('Research operation timed out.'),{code:'timeout',status:504});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>{
  // The slow page uses all the time its operation has: 25 s, or what is left of the slice.
  if(p.stage==='assess'&&host(p.pages.at(-1).url)==='factory1.example'){const from=fake;await pause(5);fake=Math.max(fake,from+Math.max(1,Math.min(25000,45000-(from-sliceStart)-2000)));throw timedOut();}
  await pause(5);return base.generate(p);}};
 const list=await startBare(f,{count:5,budget:40});let slices=0;
 for(;slices<14&&active(f,list.id);slices++){
  const before=stateOf(f,list.id),now=Math.max(Date.now(),(before.nextAttemptAt||0)+1);fake=Math.max(fake,now)+1;sliceStart=fake;
  await runCompanyListJobs(f.env,{jobId:list.id,now,clock:()=>fake,windowMs:45000});
 }
 const state=stateOf(f,list.id);
 assert.equal(statusOf(f,list.id),'incomplete');
 assert.notEqual(state.failureCode,'allowance','the allowance was not spent on one slow page');
 assert.deepEqual(state.results.map(r=>r.company).sort(),['Factory0','Factory2','Factory3','Factory4']);
 assert.ok(state.operations<=26,'operations: '+state.operations);
 assert.ok(slices<=6,'slices: '+slices);
});

test('a reader failure that lasts one slice does not cost the page: it is tried once in that slice and read in the next',async t=>{
 const f=await setup(t,4),base=profileServices({count:1});let outage=true,reads=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async url=>{reads++;await pause(3);if(outage)throw Object.assign(new Error('Public page read failed'),{status:503});return base.read(url);}};
 const list=await startBare(f,{count:1,budget:40});
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:45000});
 const first=stateOf(f,list.id);
 assert.equal(statusOf(f,list.id),'queued');
 assert.equal(reads,1,'one try in the slice, not three in a row');
 assert.equal(first.reviews.length,0);assert.equal(first.pending.length,1);
 assert.ok(first.nextAttemptAt>=Date.now()+25000,'the next try waits about thirty seconds');
 // A slice started at once (the list view starts one every few seconds) does not touch the page before that.
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:25000});
 assert.equal(reads,1,'not read again before the wait is over');
 outage=false;
 await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(first.nextAttemptAt||0)+1),windowMs:45000});
 assert.equal(statusOf(f,list.id),'complete');
 assert.deepEqual(stateOf(f,list.id).results.map(r=>r.company),['Factory0']);
});

test('a page that cannot be read in three slices is given up, and the list goes on without it',async t=>{
 const f=await setup(t,4),base=profileServices({count:3});let reads=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async url=>{if(host(url)==='factory1.example'){reads++;await pause(3);throw Object.assign(new Error('Public page read failed'),{status:503});}return base.read(url);}};
 const list=await startBare(f,{count:3,budget:60});let slices=0;
 for(;slices<8&&active(f,list.id);slices++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 const state=stateOf(f,list.id);
 assert.equal(reads,3);
 assert.deepEqual(state.results.map(r=>r.company).sort(),['Factory0','Factory2']);
 assert.match(state.reviews.find(r=>host(r.url)==='factory1.example').reason,/temporarily unavailable/);
});

test('a register check is not counted as a model answer, and Resume clears the count of model failures in a row',async t=>{
 const f=await setup(t,4),base=profileServices({count:4});let down=false;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  registry:async query=>({status:'found',registry:'SE-TEST',country:'SE',id:'5500000'+query.company.replace(/\D/g,''),name:query.company.toUpperCase()+' AB',city:'Stockholm',active:true,statusLabel:'ACTIVE',industry:{code:'289900',label:'Manufacture of special-purpose machinery'},employees:{count:120},revenue:null,marketingProtected:false,source:{name:'Test register',url:'https://register.example/'+query.company,checkedAt:'2026-11-20T12:00:00.000Z'}}),
  generate:async p=>{if(p.stage==='plan')return base.generate(p);await pause(5);if(down)throw new Error('Reasoning request failed (503)');return base.generate(p);}};
 const target={employees:{min:25,max:250},industries:['28'],registryOnly:true};
 const list=await startBare(f,{count:2,target});
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:45000});
 const done=stateOf(f,list.id),answers=done.receipts.filter(r=>['analysis','evidence_review'].includes(r.operation)&&r.status==='complete'&&r.target!=='search plan').length;
 assert.equal(statusOf(f,list.id),'complete');
 assert.ok(done.receipts.some(r=>r.operation==='register_check'&&r.status==='complete'),'the register was asked');
 assert.equal(done.modelDone,answers,'model answers counted: '+done.modelDone+' of '+answers);

 const g=await setup(t,4);down=true;g.env.COMPANY_LIST_TEST_SERVICES=f.env.COMPANY_LIST_TEST_SERVICES;
 const broken=await startBare(g,{count:4});
 for(let i=0;i<6&&active(g,broken.id);i++){const before=stateOf(g,broken.id);await runCompanyListJobs(g.env,{jobId:broken.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 assert.equal(statusOf(g,broken.id),'incomplete');
 assert.ok(stateOf(g,broken.id).modelStreak>=3);
 const stored=g.DB.raw.prepare('SELECT revision FROM company_lists WHERE id=?').get(broken.id);
 const resumed=await bare(g,{action:'resume',id:broken.id,revision:stored.revision});
 assert.equal(resumed.status,200,await resumed.clone().text());
 assert.equal(stateOf(g,broken.id).modelStreak,0);
});

// Feeding the lanes. In the first live run with lanes (23 Nov 2026) seven lanes stood still for two minutes while the
// eighth finished one company: the next search plan waited until no lane held a page, searches ran one at a time,
// and one search that timed out put the whole list to sleep for thirty seconds.
const pagesOf=query=>({first:[0,1],second:[2,3,4],third:[5,6,7],fourth:[8,9]})[query].map(i=>({url:`https://factory${i}.example/`}));

test('the next plan and several searches run while a lane is still busy with a slow page',async t=>{
 const f=await setup(t,4),base=profileServices({count:10}),log=[];let searching=0,most=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  // The first search fills every lane, so no plan is due before the lanes have taken their pages.
  search:async q=>{searching++;most=Math.max(most,searching);log.push('search '+q+' starts');await pause(40);searching--;return ({first:[0,1,2,3],second:[4,5],third:[6,7],fourth:[8,9]})[q].map(i=>({url:`https://factory${i}.example/`}));},
  read:async url=>{if(host(url)==='factory0.example'){await pause(400);log.push('slow page read');}else await pause(5);return base.read(url);},
  generate:async p=>{if(p.stage==='plan'){log.push('plan '+p.round);return {queries:p.round===0?['first']:p.round===1?['second','third','fourth']:[]};}await pause(5);return base.generate(p);}};
 const list=await startBare(f,{count:10});
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:45000});
 const state=stateOf(f,list.id);
 assert.equal(statusOf(f,list.id),'complete');assert.equal(state.results.length,10);
 assert.ok(log.indexOf('plan 1')<log.indexOf('slow page read'),'the second plan was asked before the slow page was read: '+log.join(' | '));
 assert.ok(log.indexOf('search second starts')<log.indexOf('slow page read'),'and its searches started');
 assert.ok(most>=2&&most<=3,'searches at once: '+most);
});

test('a search that fails once does not put the list to sleep: the lanes go on and the query is tried again',async t=>{
 const f=await setup(t,4),base=profileServices({count:10});let failures=0;const asked=[];
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async q=>{asked.push(q);await pause(10);if(q==='second'&&!failures){failures++;throw new Error('Search request failed (503)');}return pagesOf(q);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round===0?['first','second','third']:[]};await pause(5);return base.generate(p);}};
 const list=await startBare(f,{count:8});
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:45000});
 const state=stateOf(f,list.id);
 assert.equal(statusOf(f,list.id),'complete','finished in one slice');
 assert.ok(!state.nextAttemptAt);
 assert.equal(asked.filter(q=>q==='second').length,2,'the failed query was asked again');
 assert.deepEqual(state.results.map(r=>r.company).sort(),['Factory0','Factory1','Factory2','Factory3','Factory4','Factory5','Factory6','Factory7']);
 assert.equal(state.receipts.filter(r=>r.operation==='search'&&r.status==='failed').length,1,'the failed search is on the record');
});

test('a search that fails twice is left out and the list goes on with the other queries',async t=>{
 const f=await setup(t,4),base=profileServices({count:10});const asked=[];
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async q=>{asked.push(q);await pause(10);if(q==='second')throw new Error('Search request failed (503)');return pagesOf(q);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round===0?['first','second','third','fourth']:[]};await pause(5);return base.generate(p);}};
 const list=await startBare(f,{count:10});
 for(let i=0;i<4&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 const state=stateOf(f,list.id);
 assert.equal(asked.filter(q=>q==='second').length,2);
 assert.deepEqual(state.results.map(r=>r.company).sort(),['Factory0','Factory1','Factory5','Factory6','Factory7','Factory8','Factory9']);
 assert.equal(statusOf(f,list.id),'incomplete');assert.equal(state.failureCode,'search_exhausted');
});

test('when no search works the lanes stop and the list retries later, three times, then ends as a provider failure',async t=>{
 const f=await setup(t,4),base=profileServices({count:6});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{await pause(5);throw new Error('Search request failed (503)');},
  generate:async p=>p.stage==='plan'?{queries:p.round===0?['first','second','third','fourth']:[]}:base.generate(p)};
 const list=await startBare(f,{count:6}),trail=[];
 for(let i=0;i<8&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});const state=stateOf(f,list.id);trail.push(statusOf(f,list.id)+' '+(state.nextAttemptAt?'waits':'')+' '+(state.failureCode||''));}
 const state=stateOf(f,list.id);
 assert.deepEqual(trail,['queued waits provider_temporary','queued waits provider_temporary','incomplete  provider_temporary']);
 assert.match(state.reason,/Automatic retries stopped after three attempts/);
 assert.ok(state.operations<=14,'operations: '+state.operations);
 assert.ok(state.queries.length<=13,'at most three retried queries are added per slice (four planned, three slices): '+state.queries.length);
});

// Found by the fourth review of the feeding (23 Nov 2026), each with a proving test.
test('two searches that fail while others are in flight lose no query and repeat none that succeeded',async t=>{
 const f=await setup(t,8),base=profileServices({count:1}),calls=new Map(),ok=[];const number=q=>Number(q.slice(1));
 const down=()=>Object.assign(new Error('Search request failed (503)'),{status:503});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async q=>{const n=(calls.get(q)||0)+1;calls.set(q,n);
   if(q==='q0'&&n===1){await pause(5);throw down();}
   if(q==='q1'&&n===1){await pause(15);throw down();}
   await pause(30);ok.push(q);return Array.from({length:2},(_,k)=>({url:`https://factory${number(q)*10+k}.example/`}));},
  read:async url=>{await pause(40);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['q0','q1','q2','q3','q4','q5']};await pause(40);return base.generate(p);}};
 const list=await startBare(f,{count:30,budget:300});
 for(let i=0;i<6&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 const state=stateOf(f,list.id);
 assert.deepEqual(state.queries.slice(0,6),['q0','q1','q2','q3','q4','q5'],'the planned queries stay where they were');
 assert.deepEqual([...ok].sort(),['q0','q1','q2','q3','q4','q5'],'every query was searched successfully exactly once');
 assert.equal(calls.get('q0'),2);assert.equal(calls.get('q1'),2);
 assert.equal(state.results.length,12);
});

test('when searching stops working, the lanes first finish the pages already found, and only then the list waits',async t=>{
 const f=await setup(t,4),base=profileServices({count:1});let searches=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{if(searches++){await pause(3);throw Object.assign(new Error('Search request failed (503)'),{status:503});}return Array.from({length:6},(_,k)=>({url:`https://factory${k}.example/`}));},
  read:async url=>{await pause(10);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?['r'+p.round+'a','r'+p.round+'b']:['q0','q1','q2','q3']};await pause(10);return base.generate(p);}};
 const list=await startBare(f,{count:20,budget:300}),trail=[];
 for(let i=0;i<8&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});const state=stateOf(f,list.id);trail.push(statusOf(f,list.id)+' kept='+state.results.length+' pending='+state.pending.length+' '+(state.failureCode||''));}
 const state=stateOf(f,list.id);
 assert.equal(trail[0],'queued kept=6 pending=0 provider_temporary','the first slice finishes all six pages before it waits: '+trail.join(' | '));
 assert.equal(statusOf(f,list.id),'incomplete');
 assert.equal(state.results.length,6);assert.equal(state.pending.length,0);
 assert.match(state.reason,/Automatic retries stopped after three attempts/);
});

test('a search plan that is refused is asked at most three times, however long the lanes work',async t=>{
 const f=await setup(t,4),base=profileServices({count:1});let plans=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>Array.from({length:10},(_,k)=>({url:`https://factory${k}.example/`})),
  read:async url=>{await pause(30);return base.read(url);},
  generate:async p=>{if(p.stage==='plan'){plans++;await pause(5);return p.round?['a list is not an answer']:{queries:['q0']};}await pause(30);return base.generate(p);}};
 const list=await startBare(f,{count:20,budget:300});
 for(let i=0;i<8&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 const state=stateOf(f,list.id);
 assert.equal(state.results.length,10,'the pages found were all finished');
 assert.ok(plans-1<=3,'the refused plan was asked '+(plans-1)+' times');
 assert.equal(statusOf(f,list.id),'incomplete');
});

test('after a search outage of two slices the queries are still there: every planned query is searched and its pages kept',async t=>{
 const f=await setup(t,4),base=profileServices({count:10});let slice=0;const ok=[];
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async q=>{await pause(5);if(slice<2)throw new Error('Search request failed (503)');ok.push(q);return pagesOf(q);},
  generate:async p=>p.stage==='plan'?{queries:p.round===0?['first','second','third','fourth']:[]}:base.generate(p)};
 const list=await startBare(f,{count:10});
 for(;slice<8&&active(f,list.id);slice++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 const state=stateOf(f,list.id);
 assert.deepEqual([...new Set(ok)].sort(),['first','fourth','second','third']);
 assert.equal(statusOf(f,list.id),'complete');assert.equal(state.results.length,10);
});

// Live run of 23 Nov 2026 with eight lanes: every operation asked the database four times (two authority reads and two
// writes of the whole state row, about 300 KB), and the writes of all lanes stood in one queue, one write per request.
// In the minutes when one write took about a second the eight lanes together made 22 to 32 operations.
test('lanes share the writes of the state row: a slow database is asked far fewer times than twice per operation',async t=>{
 let searches=0;const f=await setup(t,8),base=profileServices({count:30});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  read:async url=>{await pause(5);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};await pause(5);return base.generate(p);}};
 const list=await startBare(f,{count:22,budget:400});
 // Counted from here: every statement of the research slices, and the writes of the state row among them (each takes 30 ms).
 let statements=0,writes=0;const prepare=f.DB.prepare.bind(f.DB),batch=f.DB.batch.bind(f.DB);
 f.DB.prepare=sql=>{statements++;const statement=prepare(sql);if(/^UPDATE company_lists SET state_json=\?/.test(sql)){const bind=statement.bind.bind(statement);statement.bind=(...values)=>{writes++;const bound=bind(...values),run=bound.run.bind(bound);bound.run=async()=>{await pause(30);return run();};return bound;};}return statement;};
 f.DB.batch=async list=>{await pause(30);return batch(list);};
 for(let i=0;i<40&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 const state=stateOf(f,list.id),rows=f.DB.raw.prepare('SELECT domain FROM company_list_evidence WHERE list_id=?').all(list.id).map(r=>r.domain);
 assert.equal(statusOf(f,list.id),'complete');assert.equal(state.results.length,22);
 assert.deepEqual(state.results.map(r=>r.domain).filter(domain=>!rows.includes(domain)),[],'every kept company has its evidence row');
 assert.ok(state.operations>=66,'three operations for every kept company at least: '+state.operations);
 t.diagnostic(`operations ${state.operations}, state writes ${writes}, database statements ${statements}`);
 assert.ok(writes<=state.operations,`state writes ${writes} for ${state.operations} operations`);
 assert.ok(statements<=state.operations*2,`database statements ${statements} for ${state.operations} operations`);
 assert.deepEqual(state.receipts.filter(r=>r.status==='started'),[],'no receipt is left as started');
 assert.equal(state.operationTotals.started,state.operationTotals.complete+state.operationTotals.failed+state.operationTotals.interrupted);
});

test('a list paused while eight lanes work starts no further operation and stores nothing that came back late',async t=>{
 let searches=0,reads=0,answers=0,entered,release;const seen=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const f=await setup(t,8),base=profileServices({count:30});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  read:async url=>{reads++;if(reads>=8)entered();await gate;return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};answers++;return base.generate(p);}};
 const list=await startBare(f,{count:22,budget:400});
 const slice=runCompanyListJobs(f.env,{jobId:list.id,windowMs:45000});
 await seen;
 const before=await readCompanyList(f.env,workspaceId,list.id);
 assert.equal((await bare(f,{action:'pause',id:list.id,revision:before.revision})).status,200);
 const paused=f.DB.raw.prepare('SELECT status,state_json,revision FROM company_lists WHERE id=?').get(list.id),readsAtPause=reads,searchesAtPause=searches;
 release();await slice;
 const after=f.DB.raw.prepare('SELECT status,state_json,revision FROM company_lists WHERE id=?').get(list.id);
 assert.equal(after.status,'canceled');
 assert.equal(reads,readsAtPause,'no page is read after the pause');
 assert.equal(answers,0,'no model answer is asked after the pause');
 assert.equal(searches,searchesAtPause,'no search is sent after the pause');
 assert.equal(after.state_json,paused.state_json,'the stored state is the one of the pause');
 assert.equal(after.revision,paused.revision);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM company_list_evidence WHERE list_id=?').get(list.id).n,0);
});

// A lane does not wait for the write after its step. So a write may fail that no lane is waiting for: it must still end
// the slice (the list then retries, as after any failed write) and must not be left as a rejection nobody handles.
test('a state write that fails once while lanes work ends that slice; the list retries and finishes with every company stored',async t=>{
 const run=async failAt=>{
  let searches=0,writes=0,failed=0;const f=await setup(t,8),base=profileServices({count:30});
  f.env.COMPANY_LIST_TEST_SERVICES={...base,
   search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
   read:async url=>{await pause(3);return base.read(url);},
   generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};await pause(3);return base.generate(p);}};
  const list=await startBare(f,{count:22,budget:400});
  const prepare=f.DB.prepare.bind(f.DB);
  f.DB.prepare=sql=>{const statement=prepare(sql);if(/^UPDATE company_lists SET state_json=\?/.test(sql)){const bind=statement.bind.bind(statement);statement.bind=(...values)=>{const bound=bind(...values),run=bound.run.bind(bound);bound.run=async()=>{if(++writes===failAt){failed++;throw new Error('D1_ERROR: Network connection lost.');}return run();};return bound;};}return statement;};
  // Short slices (a tenth of a second of new work each), so the list cannot finish in the slice of the failure.
  let retried=null;
  for(let i=0;i<80&&active(f,list.id);i++){
   const before=stateOf(f,list.id),was=failed;
   await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:10100});
   if(failed>was){const after=stateOf(f,list.id);retried={phase:after.phase,waits:after.nextAttemptAt>0,status:statusOf(f,list.id)};}
  }
  const state=stateOf(f,list.id),rows=f.DB.raw.prepare('SELECT domain FROM company_list_evidence WHERE list_id=?').all(list.id).map(r=>r.domain);
  const totals=state.operationTotals;
  return {failAt,failed,retried,status:statusOf(f,list.id),kept:state.results.length,withoutEvidence:state.results.map(r=>r.domain).filter(domain=>!rows.includes(domain)),started:state.receipts.filter(r=>r.status==='started').length,unaccounted:totals.started-totals.complete-totals.failed-totals.interrupted};
 };
 for(const failAt of [3,4,5,6,7,8,9,10,11,12,13,14]){
  const end=await run(failAt);
  assert.deepEqual(end,{failAt,failed:1,retried:{phase:'retrying',waits:true,status:'queued'},status:'complete',kept:22,withoutEvidence:[],started:0,unaccounted:0});
 }
});

// Sharing a write is safe only while that write has not begun: a write that has begun does not carry what came after.
// (Found by the review of 23 Nov 2026: with a write shared after it had begun, work went out before its record.)
test('every operation is in the stored row as started before its work is sent, however slow and uneven the writes',async t=>{
 let searches=0,listId;const f=await setup(t,8),base=profileServices({count:30}),early=[];
 const stored=(kind,targets)=>stateOf(f,listId).receipts.some(r=>r.status==='started'&&r.operation===kind&&targets.includes(r.target));
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async q=>{if(!stored('search',[q]))early.push('search '+q);const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  read:async url=>{if(!stored('page_read',[url]))early.push('read '+url);await pause(Math.floor(Math.random()*10));return base.read(url);},
  generate:async p=>{
   if(p.stage==='plan'){if(!stored('analysis',['search plan']))early.push('plan');return {queries:p.round?[]:['first','second','third']};}
   const kind=p.stage==='review'?'evidence_review':'analysis';if(!stored(kind,p.pages.map(page=>page.url)))early.push(kind+' '+p.pages.at(-1).url);
   await pause(Math.floor(Math.random()*10));return base.generate(p);}};
 const list=await startBare(f,{count:22,budget:400});listId=list.id;
 const prepare=f.DB.prepare.bind(f.DB),batch=f.DB.batch.bind(f.DB),slow=()=>pause(10+Math.floor(Math.random()*30));
 f.DB.prepare=sql=>{const statement=prepare(sql);if(/^UPDATE company_lists SET state_json=\?/.test(sql)){const bind=statement.bind.bind(statement);statement.bind=(...values)=>{const bound=bind(...values),run=bound.run.bind(bound);bound.run=async()=>{await slow();return run();};return bound;};}return statement;};
 f.DB.batch=async statements=>{await slow();return batch(statements);};
 for(let i=0;i<40&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 assert.deepEqual(early,[],'work sent before its receipt was stored');
 assert.equal(statusOf(f,list.id),'complete');
});

test('the figures of a slice with several lanes do not outlive it: after the switch is set back, a one-lane slice stores none',async t=>{
 let searches=0;const f=await setup(t,8),base=profileServices({count:30});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  read:async url=>{await pause(150);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};await pause(150);return base.generate(p);}};
 const list=await startBare(f,{count:22,budget:400});
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:10300});
 const lanes=stateOf(f,list.id);assert.equal(statusOf(f,list.id),'queued');
 assert.equal(lanes.slice.lanes,8);assert.ok(lanes.slice.writes>0&&lanes.slice.writeMs>=0&&lanes.slice.slowestWriteMs>=0,JSON.stringify(lanes.slice));
 delete f.env.COMPANY_LIST_LANES;
 await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(lanes.nextAttemptAt||0)+1),windowMs:10300});
 const one=stateOf(f,list.id);
 assert.ok(one.operations>lanes.operations,'the one-lane slice worked');
 assert.equal(one.slice,undefined);
});

// Found by the second review round (23 Nov 2026): the query went back also when the search had come back and only the
// write after it failed, so the same query was searched, and paid for, a second time.
test('a search that came back, and whose following write failed, is not searched again',async t=>{
 const asked=[];const f=await setup(t,8),base=profileServices({count:30});let failed=0,armed=false;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async q=>{asked.push(q);const from=(asked.length-1)*10;armed=true;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  read:async url=>{await pause(3);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};await pause(3);return base.generate(p);}};
 const list=await startBare(f,{count:22,budget:400});
 const prepare=f.DB.prepare.bind(f.DB);
 f.DB.prepare=sql=>{const statement=prepare(sql);if(/^UPDATE company_lists SET state_json=\?/.test(sql)){const bind=statement.bind.bind(statement);statement.bind=(...values)=>{const stored=JSON.parse(values[0]),hits=(stored.pending||[]).length,bound=bind(...values),run=bound.run.bind(bound);bound.run=async()=>{if(armed&&!failed&&hits>0&&stored.receipts.some(r=>r.operation==='search'&&r.status==='complete')){failed++;throw new Error('D1_ERROR: Network connection lost.');}return run();};return bound;};}return statement;};
 for(let i=0;i<60&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 assert.equal(failed,1,'the failure was met');
 assert.deepEqual([...asked].sort(),['first','second','third'],'every query is searched once');
 assert.equal(statusOf(f,list.id),'complete');assert.equal(stateOf(f,list.id).results.length,22);
});

// The list reaches its number in the same slice in which another lane's record cannot be written. That slice ends as
// complete, so no later slice would ever close a receipt left as started.
test('an operation whose record could not be written is closed as interrupted, also when the list completes in that slice',async t=>{
 let searches=0,failed=0;const f=await setup(t,8),base=profileServices({count:30}),written=new Set();
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  // Every website answers at its own speed, so the lanes are at different steps when the 22nd company is kept.
  read:async url=>{await pause(5+Number(host(url).match(/\d+/)[0])*7%23);return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};await pause(5+Number(host(p.pages.at(-1).url).match(/\d+/)[0])*11%29);return base.generate(p);}};
 const list=await startBare(f,{count:22,budget:400});
 // The write that keeps the 22nd company (a `batch`) also carries the receipts of operations other lanes have just
 // opened; those lanes wait for a write after it. From then on every write fails, slowly, except the last one that
 // stores the list as complete: the list has its number before the waiting lanes hear of the failure.
 const prepare=f.DB.prepare.bind(f.DB),batch=f.DB.batch.bind(f.DB);
 f.DB.prepare=sql=>{const statement=prepare(sql);if(/^UPDATE company_lists SET state_json=\?/.test(sql)){const bind=statement.bind.bind(statement);statement.bind=(...values)=>{
  const stored=JSON.parse(values[0]),opened=stored.receipts.filter(r=>r.status==='started'&&!written.has(r.id)).map(r=>r.id),bound=bind(...values),run=bound.run.bind(bound);
  bound.run=async()=>{if(bound.kept)return run();if(waiting&&values[1]==='running'){failed++;await pause(20);throw new Error('D1_ERROR: Network connection lost.');}for(const id of opened)written.add(id);return run();};
  bound.opened=opened;bound.results=stored.results.length;return bound;};}return statement;};
 let waiting=0;
 f.DB.batch=async statements=>{await pause(30);for(const statement of statements){statement.kept=true;if(statement.results>=22)waiting+=(statement.opened||[]).length;for(const id of statement.opened||[])written.add(id);}return batch(statements);};
 for(let i=0;i<40&&active(f,list.id);i++){const before=stateOf(f,list.id);await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(before.nextAttemptAt||0)+1),windowMs:45000});}
 const state=stateOf(f,list.id),totals=state.operationTotals;
 t.diagnostic(`operations ${state.operations}, operations that waited for the failed write ${waiting}, totals ${JSON.stringify(totals)}`);
 assert.ok(failed>0&&waiting>0,`writes failed ${failed}, operations that waited for one of them ${waiting}`);
 assert.equal(statusOf(f,list.id),'complete');assert.equal(state.results.length,22);
 assert.ok(totals.interrupted>=waiting,`the operations that were never sent are counted as interrupted: ${totals.interrupted}`);
 assert.deepEqual(state.receipts.filter(r=>r.status==='started'),[],'no receipt is left as started');
 assert.deepEqual(state.flying,[]);
 assert.equal(totals.started,totals.complete+totals.failed+totals.interrupted);
});

// The minute trigger gave a list 45 seconds (new operations for 35), then nothing for 15: read from the scheduler
// receipts of the live runs of 23 Nov 2026, where no slice ended later than 3.6 s after its window. With 54 seconds a
// slice ends before the next trigger and starts new operations for 44 seconds of every minute.
test('the minute trigger gives a company list 54 seconds of every minute, and the lease is given back when the slice ends',async t=>{
 const seen=[],noop=async()=>{},waits=[];
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.parse('2026-11-23T07:32:13.092Z')},(await setup(t,8)).env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs:async(env,options)=>{seen.push(options);return [];},runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});
 await Promise.all(waits);
 assert.deepEqual(seen,[{now:Date.parse('2026-11-23T07:32:13.092Z'),windowMs:54000}]);
 // The lease of a slice outlives its window by 30 seconds and is given back when the slice ends.
 const f=await setup(t,8),base=profileServices({count:8});f.env.COMPANY_LIST_TEST_SERVICES=base;
 const list=await startBare(f,{count:3}),lease=()=>f.DB.raw.prepare('SELECT lease_until FROM company_lists WHERE id=?').get(list.id).lease_until;
 let during=null;f.env.COMPANY_LIST_TEST_SERVICES={...base,read:async url=>{during??=lease();return base.read(url);}};
 const now=Date.now();await runCompanyListJobs(f.env,{jobId:list.id,now,windowMs:54000});
 assert.equal(during,now+84000);assert.equal(lease(),0);
});

// Live run of 23 Nov 2026 (release 9910fe7d): eight lanes closed about 70 operations a minute, 4.8 seconds for one
// operation of one lane, and the stored row could not say where those seconds went — a receipt had only its start.
test('a slice with several lanes records where its time went: per operation, per kind, and for the lanes as a whole',async t=>{
 let searches=0;const f=await setup(t,8),base=profileServices({count:30});
 f.env.COMPANY_LIST_TEST_SERVICES={...base,
  search:async()=>{const from=searches++*10;return Array.from({length:10},(_,i)=>({url:`https://factory${from+i}.example/`}));},
  read:async url=>{await pause(150);if(/factory3\./.test(url))throw Object.assign(new Error('Page could not be read.'),{code:'read_failed'});return base.read(url);},
  generate:async p=>{if(p.stage==='plan')return {queries:p.round?[]:['first','second','third']};await pause(150);return base.generate(p);}};
 const list=await startBare(f,{count:22,budget:400});
 // Every write of the state row takes at least 20 ms, so the time an operation waits to be recorded can be told from none.
 const prepare=f.DB.prepare.bind(f.DB),batch=f.DB.batch.bind(f.DB),slow=()=>pause(20);
 f.DB.prepare=sql=>{const statement=prepare(sql);if(/^UPDATE company_lists SET state_json=\?/.test(sql)){const bind=statement.bind.bind(statement);statement.bind=(...values)=>{const bound=bind(...values),run=bound.run.bind(bound);bound.run=async()=>{await slow();return run();};return bound;};}return statement;};
 f.DB.batch=async statements=>{await slow();return batch(statements);};
 await runCompanyListJobs(f.env,{jobId:list.id,windowMs:11000});
 const s=stateOf(f,list.id),closed=s.receipts.filter(r=>['complete','failed'].includes(r.status)),whole=n=>Number.isInteger(n)&&n>=0;
 assert.equal(statusOf(f,list.id),'queued');assert.ok(closed.length>=10,String(closed.length));
 // Each closed operation: `wait` until its record was stored, `ms` from sending its work until it came back.
 for(const r of closed)assert.ok(whole(r.ms)&&whole(r.wait)&&r.wait>=15,JSON.stringify(r));
 for(const r of closed.filter(r=>r.operation==='page_read'||r.operation!=='search'&&r.operation!=='register_check'&&r.target!=='search plan'))assert.ok(r.ms>=140,JSON.stringify(r));
 assert.ok(closed.some(r=>r.status==='failed'&&r.operation==='page_read'&&r.ms>=140),'a failed operation has its time too');
 // A lane's operation names its lane; a search or a plan belongs to no lane.
 for(const r of closed){const feeder=r.operation==='search'||r.target==='search plan';assert.equal(feeder?r.lane:Number.isInteger(r.lane)&&r.lane>=0&&r.lane<8,feeder?undefined:true,JSON.stringify(r));}
 // The slice: eight lanes for `ms` each; what they spent on work, on being recorded, and on waiting for a page to claim.
 const slice=s.slice;for(const key of ['ms','workMs','waitMs','idleMs','tailMs','feedMs'])assert.ok(whole(slice[key]),key+' '+JSON.stringify(slice));
 assert.ok(slice.ms>=150&&slice.ms<=11000,JSON.stringify(slice));
 assert.ok(slice.workMs+slice.waitMs+slice.idleMs+slice.tailMs<=8*slice.ms+400,JSON.stringify(slice));
 assert.ok(slice.idleMs>0,'the lanes waited for the first search: '+JSON.stringify(slice));
 // Work of 150 ms does not end for all eight lanes at once: those that left first waited for the others.
 assert.ok(slice.tailMs>0,JSON.stringify(slice));
 assert.equal(slice.workMs,closed.filter(r=>Number.isInteger(r.lane)).reduce((sum,r)=>sum+r.ms,0));
 // The job: the same sums over all its slices, and per kind of operation — these outlive the 250 stored receipts.
 assert.deepEqual(s.laneTime,{slices:1,laneMs:8*slice.ms,workMs:slice.workMs,waitMs:slice.waitMs,idleMs:slice.idleMs,tailMs:slice.tailMs,feedMs:slice.feedMs});
 const kinds=s.operationTime;assert.deepEqual(Object.keys(kinds).filter(k=>!['page_read','analysis','evidence_review','register_check','search','plan'].includes(k)),[]);
 assert.equal(Object.values(kinds).reduce((sum,k)=>sum+k.n,0),s.operationTotals.complete+s.operationTotals.failed);
 for(const [kind,k] of Object.entries(kinds))assert.ok(whole(k.n)&&whole(k.ms)&&whole(k.wait)&&k.slowest>=k.ms/k.n,kind+' '+JSON.stringify(k));
 assert.ok(kinds.page_read.ms>=kinds.page_read.n*140,JSON.stringify(kinds));
 assert.equal(kinds.plan.n,closed.filter(r=>r.target==='search plan').length);assert.equal(kinds.search.n,closed.filter(r=>r.operation==='search').length);
 assert.equal(slice.feedMs,closed.filter(r=>!Number.isInteger(r.lane)).reduce((sum,r)=>sum+r.wait+r.ms,0));assert.equal(slice.waitMs,closed.filter(r=>Number.isInteger(r.lane)).reduce((sum,r)=>sum+r.wait,0));
 // A second slice adds to the job's sums.
 await runCompanyListJobs(f.env,{jobId:list.id,now:Math.max(Date.now(),(s.nextAttemptAt||0)+1),windowMs:11000});
 const next=stateOf(f,list.id);
 assert.equal(next.laneTime.slices,2);assert.equal(next.laneTime.laneMs,8*(slice.ms+next.slice.ms));assert.equal(next.laneTime.workMs,slice.workMs+next.slice.workMs);assert.equal(next.laneTime.tailMs,slice.tailMs+next.slice.tailMs);
 assert.equal(Object.values(next.operationTime).reduce((sum,k)=>sum+k.n,0),next.operationTotals.complete+next.operationTotals.failed);
});

test('a reported OpenAI 502 gets one assessment per recovery attempt',async t=>{
 const f=await setup(t,8),base=profileServices({count:8});let failed=0;
 f.env.COMPANY_LIST_TEST_SERVICES={...base,generate:async p=>{
  if(p.stage==='plan')return base.generate(p);
  failed++;throw new Error('OpenAI request failed (502)');
 }};
 const list=await startBare(f,{count:8});
 await runCompanyListJobs(f.env,{jobId:list.id});
 for(let i=0;i<2;i++){
  const state=stateOf(f,list.id),before=failed;
  assert.ok(state.nextAttemptAt);
  await runCompanyListJobs(f.env,{jobId:list.id,now:state.nextAttemptAt+1});
  assert.equal(failed-before,1);
 }
 assert.equal(statusOf(f,list.id),'incomplete');
 assert.equal(stateOf(f,list.id).pending.length,8);
});
