import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {runCompanyListJobs,readCompanyList} from '../src/company-lists.js';
import app from '../src/app.js';
import {profileMain,profileServices} from './company-list-profile-fixture.mjs';

// Found in the live run of 22 Nov 2026 (list 1c05fdcf): a search result was a Facebook page. The direct read was
// blocked, Firecrawl answered HTTP 403 "we do not support this site" with a working key (five of its reads had
// succeeded in the same run), and the whole list stopped at 476 of 1,000 operations with "A required research
// connection is unavailable". Resume would have met the same page again, because it stayed first in the queue.
async function setup(t){const f=await buyerJobsFixture(t);f.payload.main={...f.payload.main,...profileMain()};f.version=1;await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:f.version++,payload:f.payload});return f;}
async function request(f,body,params={},waits=[]){return app.fetch(new Request('https://app.fixture.test/api/company-lists?'+new URLSearchParams({workspace_id:workspaceId,...params}),{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+f.users.owner.token,Origin:f.env.APP_ORIGIN,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil:p=>waits.push(p)});}
async function start(f){const fingerprint=(await (await request(f,null,{options:'1'})).json()).options.contextFingerprint,waits=[],r=await request(f,{action:'start',name:'Refused page',count:2,budget:100,profileIds:['icp-core'],profileMode:'any',signalMode:'off',markets:['Sweden'],contextFingerprint:fingerprint},{},waits);assert.equal(r.status,200,await r.clone().text());const body=await r.json();await Promise.all(waits);return body.list||body;}
async function tick(f,now=Date.now()){const waits=[],noop=async()=>{};await app.scheduled({cron:'* * * * *',scheduledTime:now},f.env,{waitUntil:p=>waits.push(p)},{runCompanyListJobs,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);}
async function finish(f,id){for(let i=0;i<14;i++){const list=await readCompanyList(f.env,workspaceId,id);if(['complete','incomplete'].includes(list.status))return list;await tick(f,list.progress.nextAttemptAt?list.progress.nextAttemptAt+1:Date.now());}assert.fail('Company-list scheduler did not finish');}
const stateOf=(f,id)=>JSON.parse(f.DB.raw.prepare('SELECT state_json FROM company_lists WHERE id=?').get(id).state_json);
// What the page reader throws when every reader failed, with the reader answers of the live receipt.
const readerFailure=firecrawlStatus=>Object.assign(new Error('Public source extraction unavailable'),{status:502,researchTrace:[
 {provider:'direct',operation:'extract',status:'failed',results:0,reason:'Blocked or unreadable page'},
 {provider:'firecrawl',operation:'extract',status:'failed',results:0,reason:'Firecrawl service authentication failed',httpStatus:firecrawlStatus},
 {provider:'scrapling',operation:'extract',status:'failed',results:0,reason:'Extractor returned HTTP 429',httpStatus:429}
]});
function services(firecrawlStatus){
 const base=profileServices({count:3});
 return {...base,read:async url=>{if(new URL(url).hostname==='factory0.example')throw readerFailure(firecrawlStatus);return base.read(url);}};
}

test('a page that a reader refuses with HTTP 403 is skipped and the list goes on to the next company',async t=>{
 const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=services(403);
 const list=await finish(f,(await start(f)).id),state=stateOf(f,list.id);
 assert.deepEqual(state.results.map(r=>r.company),['Factory1','Factory2']);
 assert.equal(list.status,'complete');
 assert.notEqual(state.failureCode,'connection');
 const skipped=state.reviews.find(r=>new URL(r.url).hostname==='factory0.example');
 assert.equal(skipped.status,'needs_evidence');
 assert.equal(skipped.reason,'Source is unavailable or does not provide readable evidence.');
 const receipt=state.receipts.find(r=>r.operation==='page_read'&&r.target==='https://factory0.example/');
 assert.equal(receipt.status,'failed');
 assert.equal(receipt.providers.find(p=>p.provider==='firecrawl').httpStatus,403,'the receipt keeps what the reader answered');
});

test('a reader that answers HTTP 401 still stops the list as a connection to check',async t=>{
 const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES=services(401);
 const list=await finish(f,(await start(f)).id),state=stateOf(f,list.id);
 assert.equal(list.status,'incomplete');
 assert.equal(state.failureCode,'connection');
 assert.deepEqual(state.results,[]);
 assert.match(state.reason,/A required research connection is unavailable/);
});

test('a search service that answers HTTP 403 still stops the list as a connection to check',async t=>{
 const f=await setup(t);f.env.COMPANY_LIST_TEST_SERVICES={...profileServices({count:3}),search:async()=>{throw Object.assign(new Error('Search request failed (403)'),{status:403});}};
 const list=await finish(f,(await start(f)).id),state=stateOf(f,list.id);
 assert.equal(list.status,'incomplete');
 assert.equal(state.failureCode,'connection');
 assert.deepEqual(state.results,[]);
});
