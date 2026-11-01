const test=require('node:test'),assert=require('node:assert/strict');
const Ref=require('../reference-customers.js');require('../reference-customer-library.js');const P=require('../reference-customer-portfolio.js');
function analyzed(count=1,industry='Industrial equipment'){
 const rows=Ref.normalizeImportedRows(Array.from({length:count},(_,i)=>({Company:'Reference '+i,Website:'https://reference'+i+'.example/'})));
 return {rows,analyses:Object.fromEntries(rows.map((r,i)=>[r.id,{analysisVersion:4,broadIndustry:industry,confidence:'high',sourceEvidence:[{field:'broadIndustry',quote:'We provide specialist '+industry+' products and services.',url:r.website}]}])),analyzedAt:'2026-11-01T00:00:00Z'};
}
test('existing analyzed but unpublished reference lists become usable automatically with one or three companies',()=>{
 for(const count of [1,3])for(const industry of ['Industrial equipment','Clinical software']){
  const reference=analyzed(count,industry),raw={referenceCustomerPortfolio:{selectedListId:'saved',lists:[{id:'saved',name:'Analyzed references',active:false,reference}]},referenceCustomers:reference};const before=JSON.stringify(raw);
  const repaired=P.migrateLegacy(raw),model=P.getCombinedActiveModel(repaired);assert.ok(model,'analysis should not require another manual activation');assert.equal(model.activeCount,count);assert.equal(repaired.referenceCustomerPortfolio.lists[0].active,true);assert.equal(JSON.stringify(raw),before);
  assert.equal(P.getCombinedActiveModel(JSON.parse(JSON.stringify(repaired))).activeCount,count);
 }
});
test('uploads without usable source evidence stay inactive',()=>{
 const reference=analyzed();reference.analyses[reference.rows[0].id].sourceEvidence=[];
 assert.equal(P.getCombinedActiveModel({referenceCustomerPortfolio:{lists:[{id:'saved',reference}]}}),null);
});
test('deleting the last analyzed list removes the automatic model and does not resurrect it',()=>{
 const r=analyzed(),state=P.saveCurrentList({referenceCustomers:r},{name:'Auto model'}),id=state.referenceCustomerPortfolio.selectedListId;
 assert.ok(P.getCombinedActiveModel(state));const deleted=P.deleteList(state,id);assert.equal(P.getCombinedActiveModel(P.migrateLegacy(deleted)),null);assert.equal(deleted.referenceCustomers.rows.length,0);
});
test('fresh supported analysis publishes and activates its saved list automatically',()=>{
 const r=analyzed(),draft={rows:r.rows,analyses:{}};let state=P.saveCurrentList({referenceCustomers:draft},{name:'Fresh references'});
 state.referenceCustomers=Ref.applyRefreshedAnalysis(state.referenceCustomers,r.analyses,r.analyzedAt);state=P.syncCurrentList(state);
 assert.equal(P.getCombinedActiveModel(state)?.activeCount,1);
});
test('automatic repair rejects another company sources and unreviewed imports',()=>{
 for(const change of [r=>{r.analyses[r.rows[0].id].sourceEvidence[0].url='https://unrelated.example/news';},r=>{r.rows[0].reviewed=false;},r=>{r.rows[0].status='needs_review';}]){
  const r=analyzed();change(r);assert.equal(P.getCombinedActiveModel({referenceCustomerPortfolio:{lists:[{id:'saved',reference:r}]}}),null);
 }
});
test('normalizing an older analyzed list without a timestamp stays stable and does not create phantom edits',()=>{
 const r=analyzed();delete r.analyzedAt;const state=P.saveCurrentList({referenceCustomers:r},{name:'Old analysis'});
 assert.equal(P.hasUnsavedCurrentListDraft(state),false);assert.equal(P.hasUnsavedCurrentListDraft(JSON.parse(JSON.stringify(state))),false);
});
test('three different analyzed companies remain usable as individual reference profiles',()=>{
 const r=analyzed(3),industries=['Healthcare','Industrial machinery','Business software'];r.rows.forEach((row,i)=>{r.analyses[row.id].broadIndustry=industries[i];r.analyses[row.id].sourceEvidence[0].quote='We provide specialist '+industries[i]+' products and services.';});
 const state=P.saveCurrentList({referenceCustomers:r},{name:'Different references'}),model=P.getCombinedActiveModel(state);assert.equal(model.activeCount,3);assert.equal(model.dna.referenceProfiles.length,3);
});
test('a completed newer analysis repairs an old pending model without discarding manual source fields',()=>{
 const old=Ref.normalizeReferenceState(analyzed(1));old.publishedModel.updatedAt='2026-10-01T00:00:00Z';
 const latest=analyzed(3);const pending={...old,rows:latest.rows,analyses:latest.analyses,analyzedAt:latest.analyzedAt,draftDirty:true};pending.rows[0].productService='Keep manually supplied deal context';
 const repaired=Ref.normalizeReferenceState(pending);assert.equal(repaired.publishedModel.activeCount,3);assert.equal(repaired.draftDirty,false);assert.equal(repaired.rows[0].productService,'Keep manually supplied deal context');
});
