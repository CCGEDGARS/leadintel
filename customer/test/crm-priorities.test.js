const test=require('node:test');
const assert=require('node:assert/strict');
let api;try{api=require('../crm-priorities.js');}catch{}
const derive=input=>{assert.equal(typeof api?.derivePriorities,'function','daily priorities engine must be implemented');return api.derivePriorities(input);};
const now='2026-10-24T12:00:00.000Z';
test('stored pending reminders use exact due times and their timezone, excluding completed tasks',()=>{
 const result=derive({now,conversations:[{id:'overdue',task:{status:'pending'},dueAt:'2026-10-24T11:59:59Z'},{id:'today',task:{status:'pending'},dueAt:'2026-10-24T13:00:00Z'},{id:'future',task:{status:'pending'},dueAt:'2026-10-25T13:00:00Z'},{id:'done',task:{status:'done'},dueAt:'2026-10-23T13:00:00Z'},{id:'invalid',task:{status:'pending'},dueAt:'someday'}]});
 assert.deepEqual(result.due.map(x=>[x.conversationId,x.timing]),[['overdue','overdue'],['today','today']]);assert.equal(result.upcoming[0].conversationId,'future');assert.equal(result.review[0].conversationId,'invalid');assert.equal(result.due.some(x=>x.conversationId==='done'),false);
 const zone=derive({now:'2026-10-24T23:00:00Z',conversations:[{id:'z',timezone:'Asia/Tokyo',task:{status:'pending'},dueAt:'2026-10-25T01:00:00Z'}]});assert.equal(zone.due[0].timing,'today');
});
test('reply review, held plans, saved no-email blockers and approved schedules retain their evidence meaning',()=>{
 const result=derive({now,conversations:[{id:'reply',latestReply:{bodyText:'Hello'},status:'needs_review',task:{status:'pending'},nextAction:'Review original reply'},{id:'done',latestReply:{},task:{status:'done'}},{id:'blocked',plan:{status:'needs_review',error:'Mailbox changed'},status:'needs_review'},{id:'scheduled',plan:{status:'active',steps:[{status:'queued',scheduledAt:'2026-10-24T13:00:00Z'}]}}],companies:[{id:'no',company_name:'No email',lifecycle_status:'prospect',pipeline_stage:'Qualified'},{id:'unknown',pipeline_stage:'Qualified'},{id:'email',pipeline_stage:'Qualified'},{id:'archived',lifecycle_status:'archived',pipeline_stage:'Qualified'}],details:{no:{contacts:[]},email:{contacts:[{work_email:'person@example.test'}]},archived:{contacts:[]}}});
 assert.equal(result.review.filter(x=>x.kind==='reply').length,1);assert.equal(result.blocked.some(x=>x.conversationId==='blocked'),true);assert.deepEqual(result.blocked.filter(x=>x.kind==='no_email').map(x=>x.companyId),['no']);assert.equal(result.due.find(x=>x.conversationId==='scheduled').kind,'scheduled');assert.match(result.due.find(x=>x.conversationId==='scheduled').nextAction,/Review/);
});
test('controller clears stale workspace data immediately and ignores late requests even across workspace round trips',async()=>{
 assert.equal(typeof api?.createController,'function','daily priorities controller must be implemented');let scope={authenticated:true,workspaceId:'a',userId:'u'},finish;const seen=[];
 const c=api.createController({capture:()=>scope,listCompanies:()=>new Promise(r=>finish=r),listConversations:async()=>({conversations:[]}),getCompany:async()=>({ok:true,contacts:[]}),onChange:s=>seen.push(s)});
 const pending=c.refresh();scope={...scope,workspaceId:'b'};c.reset();assert.equal(c.snapshot().companies.length,0);scope={...scope,workspaceId:'a'};finish({ok:true,companies:[{id:'old'}]});await pending;assert.equal(c.snapshot().companies.length,0);assert.equal(c.snapshot().loading,false);assert.ok(seen.length);
});
test('partial independent read failures remain visible and no empty success is claimed',async()=>{
 assert.equal(typeof api?.createController,'function');const c=api.createController({capture:()=>({authenticated:true,workspaceId:'a',userId:'u'}),listCompanies:async()=>({ok:true,companies:[{id:'a',pipeline_stage:'Qualified'}],next_cursor:'100'}),listConversations:async()=>{throw Error('offline');},getCompany:async()=>{throw Error('offline');}});await c.refresh();const s=c.snapshot();assert.equal(s.loading,false);assert.equal(s.companyHasMore,true);assert.equal(s.errors.conversations,true);assert.equal(s.contactChecked,0);assert.equal(s.contactFailed,1);assert.equal(s.companies.length,1);
});
test('empty reads succeed, only read dependencies run, and sign-out removes retained rows',async()=>{
 assert.equal(typeof api?.createController,'function');let scope={authenticated:true,workspaceId:'a',userId:'u'},calls=[];const c=api.createController({capture:()=>scope,listCompanies:async q=>{calls.push(['companies',q]);return {ok:true,companies:[]};},listConversations:async()=>{calls.push(['conversations']);return {conversations:[]};},getCompany:async()=>{throw Error('must not run');}});await c.refresh();assert.equal(c.snapshot().loaded,true);assert.equal(c.snapshot().errors.conversations,false);assert.deepEqual(c.snapshot().priorities.due,[]);assert.deepEqual(calls.map(x=>x[0]),['companies','conversations']);scope={authenticated:false};await c.refresh();assert.equal(c.snapshot().loaded,false);assert.equal(c.snapshot().companies.length,0);assert.equal(c.snapshot().loading,false);
});
test('newer refresh wins over older reads and synchronous contact errors remain partial',async()=>{
 let first,companyCalls=0;const c=api.createController({capture:()=>({authenticated:true,workspaceId:'a',userId:'u'}),listCompanies:()=>++companyCalls===1?new Promise(r=>first=r):{ok:true,companies:[{id:'new',pipeline_stage:'Qualified'}]},listConversations:async()=>({conversations:[]}),getCompany:()=>{throw Error('failed read');}});const old=c.refresh();await c.refresh();first({ok:true,companies:[{id:'old'}]});await old;assert.equal(c.snapshot().companies[0].id,'new');assert.equal(c.snapshot().contactFailed,1);assert.equal(c.snapshot().loading,false);
});
test('account changes without an event cannot retain old data or leave old loading indefinitely',async()=>{
 let scope={authenticated:true,workspaceId:'a',userId:'u'},finish;const c=api.createController({capture:()=>scope,listCompanies:()=>new Promise(r=>finish=r),listConversations:async()=>({conversations:[]})});const pending=c.refresh();scope={...scope,userId:'someone-else'};finish({ok:true,companies:[{id:'private'}]});await pending;assert.equal(c.snapshot().loading,false);assert.equal(c.snapshot().companies.length,0);
});
test('invalid timezones and explicit same-time deadlines do not invent a local today or overdue status',()=>{
 const r=derive({now,conversations:[{id:'unknown-zone',timezone:'Invalid/Timezone',task:{status:'pending'},dueAt:'2026-10-25T13:00:00Z'},{id:'exact',task:{status:'pending'},dueAt:now}]});assert.equal(r.upcoming[0].conversationId,'unknown-zone');assert.equal(r.due[0].conversationId,'exact');assert.equal(r.due[0].timing,'today');
});
