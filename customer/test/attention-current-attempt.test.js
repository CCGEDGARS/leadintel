const test=require('node:test'),assert=require('node:assert/strict'),M=require('../attention-centre-model.js');
const task=(id,status,startedAt,type='company-discovery',metadata={})=>({id,status,startedAt,updatedAt:startedAt,title:'Research',type,metadata});
test('a later successful company run supersedes old errors without deleting task history',()=>{
 const tasks=[task('old','error',100),task('new','complete',200),task('reload','interrupted',90)];
 assert.equal(M.buildAttentionItems({tasks,workspaceStarted:false}).length,0);assert.equal(tasks.length,3);
});
test('only the newest failed attempt for the same company task remains actionable',()=>{
 const items=M.buildAttentionItems({tasks:[task('old','error',100),task('new','partial',200)],workspaceStarted:false});
 assert.deepEqual(items.map(i=>i.id),['task-new']);
});
test('different buyer companies and independently running jobs retain their own attention',()=>{
 const tasks=[task('a','error',100,'decision-maker-search',{domain:'a.example'}),task('b','complete',200,'decision-maker-search',{domain:'b.example'}),task('active','running',50,'other')];
 assert.ok(M.buildAttentionItems({tasks,workspaceStarted:false,now:300}).some(i=>i.id==='task-a'));
});
test('unscoped enrichment jobs for distinct contacts never supersede one another',()=>{
 const tasks=[{...task('alice','error',100,'apollo-enrichment'),title:'Enrich Alice'},{...task('bob','complete',200,'apollo-enrichment'),title:'Enrich Bob'}];
 assert.ok(M.buildAttentionItems({tasks,workspaceStarted:false}).some(i=>i.id==='task-alice'));
});

const legacyBuyer=(domain,status,time,metadata={})=>({...task(`decision-maker-search:${domain}:${time}`,status,time,'decision-maker-search',metadata),title:'Buyer search · Original company label'});
const attention=(tasks,options={})=>M.buildAttentionItems({tasks,workspaceStarted:false,now:1800000600000,...options});
test('a verified workspace buyer retry supersedes its legacy stalled warning without altering task history',()=>{
 const tasks=[legacyBuyer('buyer.example','running',1800000000000),{...legacyBuyer('buyer.example','complete',1800000400000,{domain:'buyer.example',workspaceId:'w1'}),title:'Buyer search · Updated company label'}];
 const saved=JSON.stringify(tasks);
 assert.deepEqual(attention(tasks,{workspaceId:'w1'}),[]);assert.equal(JSON.stringify(tasks),saved);
});
test('the latest failed buyer attempt and other company or workspace warnings remain visible',()=>{
 const old=legacyBuyer('buyer.example','interrupted',1800000000000),latest=legacyBuyer('buyer.example','error',1800000400000,{domain:'buyer.example',workspaceId:'w1'}),other=legacyBuyer('other.example','error',1800000100000),remote=legacyBuyer('buyer.example','error',1800000200000,{domain:'buyer.example',workspaceId:'w2'});
 const ids=attention([old,latest,other,remote],{workspaceId:'w1'}).map(item=>item.id);
 assert.equal(ids.includes('task-'+old.id),false);assert.ok(ids.includes('task-'+latest.id));assert.ok(ids.includes('task-'+other.id));assert.ok(ids.includes('task-'+remote.id));
});
test('unknown workspace or malformed legacy identities never inherit a successful buyer scope',()=>{
 for(const options of [{},{workspaceId:'w1'}])for(const id of ['decision-maker-search:company:1800000000000','decision-maker-search:https://buyer.example:1800000000000','decision-maker-search:buyer.example:invalid','decision-maker-search:-buyer.example:1800000000000','unrelated:buyer.example:1800000000000']){
  const old={...legacyBuyer('buyer.example','interrupted',1800000000000),id},latest=legacyBuyer('buyer.example','complete',1800000400000,{domain:'buyer.example',workspaceId:'w1'});
  assert.ok(attention([old,latest],options).some(item=>item.id==='task-'+old.id),id);
 }
 const old=legacyBuyer('buyer.example','interrupted',1800000000000),latest=legacyBuyer('buyer.example','complete',1800000400000,{domain:'buyer.example',workspaceId:'w1'});
 assert.ok(attention([old,latest]).some(item=>item.id==='task-'+old.id),'a valid legacy id still needs a verified current workspace');
});
test('a newer running buyer attempt keeps its own progress and subsequent stalled warning alongside real runtime errors',()=>{
 const old=legacyBuyer('buyer.example','complete',1800000000000,{domain:'buyer.example',workspaceId:'w1'}),current=legacyBuyer('buyer.example','running',1800000500000,{domain:'buyer.example',workspaceId:'w1'}),tasks=[old,current];
 const options={workspaceId:'w1',runtimeErrors:[{id:'real',message:'Profile renderer failed'}]};
 assert.deepEqual(attention(tasks,options).map(item=>item.id),['runtime-real']);assert.equal(current.status,'running');
 assert.deepEqual(attention(tasks,{...options,now:1800000800000}).map(item=>item.id),['runtime-real','task-'+current.id]);
});
