const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const path=require('node:path').join(__dirname,'../setup-operation-trace.js');
function runtime(){const events=[],listeners={};const root={Date,crypto:require('node:crypto').webcrypto,LeadIntelServerBridge:{workspace:{id:'w1'},session:{user:{id:'u1'}}},dispatchEvent:e=>events.push(e.detail),addEventListener:(name,fn)=>listeners[name]=fn,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}}};if(fs.existsSync(path))vm.runInNewContext(fs.readFileSync(path,'utf8'),root);return {root,events,listeners};}
test('Setup trace records one bounded safe operation across request and persistence',()=>{
 const {root,events}=runtime();assert.equal(typeof root.LeadIntelSetupTrace?.begin,'function');
 const op=root.LeadIntelSetupTrace.begin('website_activation');op.checkpoint('request','pending');op.checkpoint('persistence','pass');op.finish('pass');
 const rows=root.LeadIntelSetupTrace.snapshot();assert.equal(rows.length,4);assert.ok(rows.every(r=>r.operationId===op.id&&r.stage===1&&r.workspaceId==='w1'));assert.equal(rows[3].outcome,'pass');assert.equal(events.length,4);
 rows[0].workspaceId='mutated';assert.equal(root.LeadIntelSetupTrace.snapshot()[0].workspaceId,'w1');
});
test('Setup trace rejects arbitrary payload text and bounds retained records',()=>{
 const {root}=runtime();assert.equal(typeof root.LeadIntelSetupTrace?.begin,'function');
 assert.throws(()=>root.LeadIntelSetupTrace.begin('secret-token'),/action/i);
 const op=root.LeadIntelSetupTrace.begin('material_upload');assert.throws(()=>op.checkpoint('provider secret','pass'),/phase/i);assert.throws(()=>op.finish('token-value'),/outcome/i);
 for(let i=0;i<80;i++){const next=root.LeadIntelSetupTrace.begin('service_settings');next.finish('pass');}
 assert.ok(root.LeadIntelSetupTrace.snapshot().length<=100);assert.doesNotMatch(JSON.stringify(root.LeadIntelSetupTrace.snapshot()),/secret|token-value/);
});
test('Setup trace clears previous account records and old operations cannot repopulate them',()=>{
 const {root,listeners}=runtime();assert.equal(typeof root.LeadIntelSetupTrace?.begin,'function');
 const op=root.LeadIntelSetupTrace.begin('paid_preferences');root.LeadIntelServerBridge.session.user.id='u2';listeners['leadintel:server-ready']();op.finish('fail');assert.equal(root.LeadIntelSetupTrace.snapshot().length,0);
});
test('Setup trace invalidates old operations when the account ticket changes before bridge IDs',()=>{
 const {root}=runtime();let ticket='a',current=true;root.localStorage={getItem:()=>ticket};root.LeadIntelAccountCache={current:()=>current};
 const op=root.LeadIntelSetupTrace.begin('material_upload');ticket='b';current=false;op.finish('pass');assert.equal(root.LeadIntelSetupTrace.snapshot().length,0);
});
test('shared reliability trace attributes Profile decisions to stage two without private payloads',()=>{
 const {root,events}=runtime();assert.equal(typeof root.LeadIntelReliabilityTrace?.begin,'function');
 const operation=root.LeadIntelReliabilityTrace.begin('profile_approval');operation.finish('blocked');
 const rows=root.LeadIntelReliabilityTrace.snapshot();assert.equal(rows.length,2);assert.ok(rows.every(row=>row.stage===2&&row.action==='profile_approval'));assert.equal(rows[1].outcome,'blocked');assert.equal(events.length,2);
});
test('Strategy diagnostics retain safe stage-three revision outcomes and keep account isolation',()=>{
 const {root,events}=runtime();const operation=root.LeadIntelReliabilityTrace.begin('strategy_activation');operation.checkpoint('persistence','pending');operation.finish('stale');
 const rows=root.LeadIntelReliabilityTrace.snapshot();assert.equal(rows.length,3);assert.ok(rows.every(row=>row.stage===3&&row.action==='strategy_activation'&&row.operationId.startsWith('strategy-')));assert.equal(rows.at(-1).outcome,'stale');assert.equal(events.length,3);
 const old=root.LeadIntelReliabilityTrace.begin('strategy_monitoring');root.LeadIntelServerBridge.workspace.id='other';old.finish('pass');assert.equal(root.LeadIntelReliabilityTrace.snapshot().length,0);
});
test('Companies diagnostics identify stage four without retaining research content',()=>{const {root,events}=runtime();const operation=root.LeadIntelReliabilityTrace.begin('company_selection');operation.checkpoint('persistence','pending');operation.finish('blocked');const rows=root.LeadIntelReliabilityTrace.snapshot();assert.equal(rows.length,3);assert.ok(rows.every(row=>row.stage===4&&row.operationId.startsWith('companies-')));assert.equal(rows.at(-1).outcome,'blocked');assert.equal(events.length,3);assert.deepEqual(Object.keys(rows[0]).sort(),['action','at','elapsedMs','operationId','outcome','phase','stage','version','workspaceId']);});
test('Buyers operation diagnostics retain owned stage-five outcomes without person data',()=>{const {root}=runtime();const op=root.LeadIntelReliabilityTrace.begin('buyer_selection');op.checkpoint('persistence','pending');op.finish('stale');const rows=root.LeadIntelReliabilityTrace.snapshot();assert.ok(rows.every(row=>row.stage===5&&row.operationId.startsWith('buyers-')&&row.version==='20261031-delivery-v1'));assert.equal(rows.at(-1).outcome,'stale');assert.deepEqual(Object.keys(rows[0]).sort(),['action','at','elapsedMs','operationId','outcome','phase','stage','version','workspaceId']);const old=root.LeadIntelReliabilityTrace.begin('buyer_contact');root.LeadIntelServerBridge.session.user.id='other';old.finish('fail');assert.equal(root.LeadIntelReliabilityTrace.snapshot().length,0);});

test('Messages persistence tracing stays bounded and emits no draft or recipient text',()=>{const {root}=runtime();const op=root.LeadIntelReliabilityTrace.begin('message_save');op.checkpoint('persistence','pending');op.finish('fail');const rows=root.LeadIntelReliabilityTrace.snapshot();assert.ok(rows.every(row=>row.stage===6&&row.operationId.startsWith('messages-')));assert.equal(rows.at(-1).outcome,'fail');assert.deepEqual(Object.keys(rows[0]).sort(),['action','at','elapsedMs','operationId','outcome','phase','stage','version','workspaceId']);});

test('Delivery tracing measures elapsed time and distinguishes uncertain receipts without message data',()=>{
 const {root}=runtime();let clock=1000;root.Date=class extends Date{static now(){return clock;}};
 const operation=root.LeadIntelReliabilityTrace.begin('delivery_send');clock+=125;operation.checkpoint('provider','uncertain');clock+=75;operation.finish('uncertain');
 const rows=root.LeadIntelReliabilityTrace.snapshot();assert.equal(rows.length,3);assert.ok(rows.every(row=>row.stage===7&&row.operationId.startsWith('delivery-')));assert.deepEqual(Array.from(rows,row=>row.elapsedMs),[0,125,200]);assert.equal(rows.at(-1).outcome,'uncertain');
 assert.deepEqual(Object.keys(rows[0]).sort(),['action','at','elapsedMs','operationId','outcome','phase','stage','version','workspaceId']);
 operation.finish('pass');assert.equal(root.LeadIntelReliabilityTrace.snapshot().length,3);
});

test('Delivery recovery and pause observations are discarded after account/workspace context changes',()=>{
 const {root,listeners}=runtime();const operation=root.LeadIntelReliabilityTrace.begin('delivery_recovery');operation.checkpoint('response','duplicate_hold');root.LeadIntelServerBridge.workspace.id='w2';listeners['leadintel:workspace-changed']();operation.finish('pass');assert.equal(root.LeadIntelReliabilityTrace.snapshot().length,0);
 const pause=root.LeadIntelReliabilityTrace.begin('delivery_pause');pause.finish('canceled');assert.equal(root.LeadIntelReliabilityTrace.snapshot().at(-1).outcome,'canceled');
});

test('all seven stages measure elapsed time while preserving their safe correlation and event attribution',()=>{
 const {root}=runtime();let clock=1000;root.Date=class extends Date{static now(){return clock;}};
 for(const [index,action] of ['website_activation','profile_research','strategy_research','company_discovery','buyer_research','message_generation','delivery_send'].entries()){
  const operation=root.LeadIntelReliabilityTrace.begin(action);clock+=100+index;operation.finish('pass');
  const row=root.LeadIntelReliabilityTrace.snapshot().at(-1);assert.equal(row.stage,index+1);assert.equal(row.elapsedMs,100+index);assert.equal(row.operationId,operation.id);
 }
 const expired=root.LeadIntelReliabilityTrace.begin('website_activation');clock+=86400001;expired.finish('fail');assert.equal(root.LeadIntelReliabilityTrace.snapshot().at(-1).elapsedMs,null);
});

test('browser correlation IDs never adopt content-bearing randomUUID substitutions',()=>{
 const {root}=runtime();root.crypto={randomUUID:()=> 'secret@tenant.test'};const operation=root.LeadIntelReliabilityTrace.begin('delivery_send');operation.finish('pass');assert.match(operation.id,/^delivery-[a-z0-9]+-\d+$/);assert.doesNotMatch(JSON.stringify(root.LeadIntelReliabilityTrace.snapshot()),/secret@/);
});
