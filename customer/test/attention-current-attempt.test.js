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
