const {test}=require('node:test'),assert=require('node:assert/strict'),Q=require('../page-quality.js');
const session={ready:true,authenticated:true,workspaceId:'w1',conflict:false,resolvingSync:false};
const context={loaded:true,session,inputs:{buyer:'Sam',source:'north',sender:'Robin'}};
test('all page contracts require successful loading and an actual current workspace check',()=>{
 for(const page of Q.PAGES){const ready=Q.inspect(page,context);assert.equal(ready.state,'ready');assert.equal(Q.allowed(ready,'prepare'),true);
  for(const patch of [{ready:false},{conflict:true},{resolvingSync:true}]){const report=Q.inspect(page,{...context,session:{...session,...patch}});assert.notEqual(report.state,'ready');assert.equal(Q.allowed(report,'prepare'),false);}
  assert.equal(Q.allowed(Q.inspect(page,{...context,loaded:false}),'prepare'),false);
 }
});
test('missing authentication blocks saved recipient, delivery and CRM actions while local Profile editing remains possible',()=>{
 for(const page of ['messages','delivery','crm'])assert.equal(Q.allowed(Q.inspect(page,{...context,session:{...session,authenticated:false}}),'prepare'),false);
 assert.equal(Q.allowed(Q.inspect('profile',{...context,session:{...session,authenticated:false}}),'prepare'),true);
 assert.equal(Q.allowed(Q.inspect('messages',context),'invented-action'),false);
});
test('readiness for one action cannot authorize another action or turn a missing input into success',()=>{
 const report=Q.inspect('messages',{...context,checks:[Q.check('saved','Saved',false,'Save first',{actions:['flow','library','send']})]});
 assert.equal(report.state,'review');assert.equal(Q.allowed(report,'generate'),true);assert.equal(Q.allowed(report,'save'),true);assert.equal(Q.allowed(report,'flow'),false);assert.equal(Q.allowed(report,'send'),false);
 assert.equal(Q.check('strict','Strict boolean','true','Required').status,'fail');
});
test('critical actions read fresh inputs instead of trusting a cached Ready result',()=>{
 let saved=true;const c=Q.createCoordinator({session:()=>session});c.register('messages',{read:()=>({...context,checks:[Q.check('saved','Saved',saved,'Save',{actions:['flow']})]})});
 assert.equal(c.require('messages','flow'),true);saved=false;assert.equal(c.require('messages','flow'),false);
});
test('operation tickets reject changed recipient, source, content and workspace during asynchronous preparation',()=>{
 let current={...session},inputs={...context.inputs};const c=Q.createCoordinator({session:()=>current});c.register('delivery',{read:()=>({...context,inputs})});
 for(const patch of [{buyer:'Other'},{source:'river'},{body:'Manual change'}]){const ticket=c.capture('delivery','send');inputs={...inputs,...patch};assert.equal(c.current(ticket),false);}
 const copied=c.capture('delivery','send');assert.equal(c.current({...copied}),false);const ticket=c.capture('delivery','send');current={...current,workspaceId:'w2'};assert.equal(c.current(ticket),false);assert.equal(c.getAuditTrail().every(row=>row.workspaceId==='w2'),true);
});
test('opening runs only the registered safe preparation and verifies its actual result',async()=>{
 let prepared=false,calls=0;const c=Q.createCoordinator({session:()=>session});c.register('messages',{read:()=>({...context,checks:[Q.check('message','Message prepared',prepared,'Create',{actions:['approve']})]}),prepare(){calls++;prepared=true;}});
 const report=await c.open('messages');assert.equal(calls,1);assert.equal(report.state,'ready');
 prepared=false;const blocked=Q.createCoordinator({session:()=>({...session,conflict:true})});blocked.register('messages',{read:()=>context,prepare(){calls++;}});await blocked.open('messages');assert.equal(calls,1);
});
test('late opening completion cannot publish a receipt into another workspace or a newer page',async()=>{
 let current={...session},release;const notices=[];const c=Q.createCoordinator({session:()=>current,notify:report=>notices.push(report)});c.register('messages',{read:()=>context,prepare:()=>new Promise(resolve=>release=resolve)});c.register('profile',{read:()=>context});
 const pending=c.open('messages');current={...session,workspaceId:'w2'};await c.open('profile');const count=notices.length;release();assert.equal(await pending,null);assert.equal(notices.length,count);assert.equal(notices.at(-1).page,'profile');assert.equal(notices.at(-1).workspaceId,'w2');
});
test('opening failures are explicit and read errors cannot become a Ready receipt',async()=>{
 const c=Q.createCoordinator({session:()=>session});c.register('messages',{read:()=>context,prepare:()=>{throw Error('private provider data');}});const report=await c.open('messages');assert.equal(report.state,'blocked');assert.doesNotMatch(JSON.stringify(report),/private provider/);assert.equal(c.require('messages','approve'),false);c.register('messages',{read:()=>context,prepare(){}});assert.equal(c.require('messages','approve'),false);assert.equal((await c.open('messages')).state,'ready');
 c.register('delivery',{read(){throw Error('bad cached JSON');}});assert.equal(c.require('delivery','send'),false);
});
test('internal audit records are bounded, deduplicated and contain check results without customer content',()=>{
 let buyer='Sensitive name';const c=Q.createCoordinator({session:()=>session});c.register('messages',{read:()=>({...context,inputs:{buyer,email:'private@buyer.example'}})});c.refresh('messages');assert.equal(c.getAuditTrail().length,1);
 for(let i=0;i<45;i++){buyer='Sensitive name '+i;c.refresh('messages');}const trail=c.getAuditTrail();assert.equal(trail.length,30);assert.doesNotMatch(JSON.stringify(trail),/Sensitive|private@/);trail[0].checks[0].status='fake';assert.notEqual(c.getAuditTrail()[0].checks[0].status,'fake');
});
