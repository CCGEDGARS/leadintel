const test=require('node:test'),assert=require('node:assert/strict');
const {createClient}=require('../buyer-research-jobs.js');

// The progress of a Buyers job is kept on its company, and the company list is saved with the workspace. On
// 22 Nov 2026 opening a step re-read four finished jobs, wrote "seconds since the job started" (counted to this
// moment) into each company, and so sent the whole workspace to the server again (366 KB) although nothing had
// been changed. What is kept for a job that no longer runs must not depend on when it is looked at.
const candidate=()=>({company:'Example',domain:'example.com',website:'https://example.com/',buyerRoles:'COO',buyerSearchMode:'user_selected_target',people:[{id:'anna',name:'Anna Buyer',title:'COO',organization:'Example'}]});
const STARTED='2026-11-22T15:44:28.000Z',UPDATED='2026-11-22T16:07:30.000Z';
// What the server sends for the job; `now` is when it is asked, as its run window counts down to the deadline.
function job(owner,status,now){
 const start=Date.parse(STARTED),deadline=start+30*60000;
 return {id:'job-1',domain:owner.domain,status,phase:'contacts',revision:25,createdAt:STARTED,updatedAt:UPDATED,candidate:structuredClone(owner),diagnostics:[],
  progress:{completed:93,total:93,label:'Public source checks',lastActivityAt:UPDATED,timing:{estimate:null,lastResultAt:UPDATED,nextAttemptAt:null,runWindow:{startedAt:STARTED,deadlineAt:new Date(deadline).toISOString(),expired:now>=deadline,remainingMs:Math.max(0,deadline-now)}}}};
}
// A page that has just been loaded: a new client with no memory of earlier reads.
function page(respond){
 const bridge={workspace:{id:'workspace-1'},session:{authenticated:true,user:{id:'user-1'}},conflict:false};
 return createClient({getBridge:()=>bridge,pollMs:2,requestTimeoutMs:100,fetchImpl:async()=>({ok:true,json:async()=>({job:respond()})})});
}
const at=(t,time)=>t.mock.timers.setTime(Date.parse(time));

for(const status of ['needs_review','complete','failed']){
 test(`a ${status} job read again later leaves the company exactly as the first read left it`,async t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-22T16:10:00.000Z')});
  const owner=candidate();
  // Two and a half minutes after the job ended, while its run window is still open.
  await page(()=>job(owner,status,Date.now())).restore(owner,{profile:{decisionMakers:'COO'}});
  const first=JSON.stringify(owner);
  assert.equal(owner.buyerResearchProgress.executionStatus,status);
  for(const later of ['2026-11-22T16:10:07.000Z','2026-11-22T16:20:00.000Z','2026-11-22T19:30:00.000Z','2026-11-25T08:00:00.000Z']){
   at(t,later);
   await page(()=>job(owner,status,Date.now())).restore(owner,{profile:{decisionMakers:'COO'}});
   assert.equal(JSON.stringify(owner),first,'read at '+later);
  }
 });
}

test('a finished job keeps how long it ran and when its run window was, not how long ago that is',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-22T19:30:00.000Z')});
 const owner=candidate();
 await page(()=>job(owner,'needs_review',Date.now())).restore(owner,{profile:{decisionMakers:'COO'}});
 const progress=owner.buyerResearchProgress;
 // 15:44:28 → 16:07:30 is 23 min 2 s.
 assert.equal(progress.elapsedSeconds,1382);
 assert.equal(progress.startedAt,STARTED);
 assert.equal(progress.checkpointAt,UPDATED);
 assert.deepEqual(progress.timing.runWindow,{startedAt:STARTED,deadlineAt:'2026-11-22T16:14:28.000Z'});
 assert.equal(progress.timing.lastResultAt,UPDATED);
});

test('a job that is still running keeps counting from the clock and keeps the time left in its run window',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-22T15:50:28.000Z')});
 const owner=candidate(),kept=[];let reads=0;
 const client=page(()=>job(owner,++reads===1?'running':'needs_review',Date.now()));
 await client.restore(owner,{profile:{decisionMakers:'COO'},persist:()=>kept.push(structuredClone(owner.buyerResearchProgress))});
 assert.equal(kept[0].executionStatus,'running');
 assert.equal(kept[0].elapsedSeconds,360);
 assert.deepEqual([kept[0].timing.runWindow.expired,kept[0].timing.runWindow.remainingMs],[false,24*60000]);
 assert.equal(kept.at(-1).executionStatus,'needs_review');
 assert.equal(kept.at(-1).elapsedSeconds,1382);
});

test('a finished job without a readable end time keeps no running count',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-22T19:30:00.000Z')});
 const owner=candidate(),answer=()=>{const saved=job(owner,'needs_review',Date.now());delete saved.updatedAt;return saved;};
 await page(answer).restore(owner,{profile:{decisionMakers:'COO'}});
 const first=JSON.stringify(owner);
 assert.equal(owner.buyerResearchProgress.elapsedSeconds,0);
 at(t,'2026-11-22T21:00:00.000Z');
 await page(answer).restore(owner,{profile:{decisionMakers:'COO'}});
 assert.equal(JSON.stringify(owner),first);
});
