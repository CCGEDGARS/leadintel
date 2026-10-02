const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Ref=require('../reference-customers.js');
require('../reference-customer-library.js');

function builtState(){
  const rows=Ref.normalizeImportedRows([
    {Company:'Acme',Website:'https://acme.example'},
    {Company:'Beta',Website:'https://beta.example'}
  ],{sourceType:'csv'});
  const analyses={
    [rows[0].id]:{industry:'manufacturing',businessModel:'B2B',confidence:'high'},
    [rows[1].id]:{industry:'manufacturing',businessModel:'B2B',confidence:'medium'}
  };
  const segmentation=Ref.buildReferenceSegments(rows,analyses);
  let state=Ref.normalizeReferenceState({rows,analyses,segments:segmentation.segments,segmentationMeaningful:segmentation.meaningful});
  state=Ref.activateReferenceSegments(state,segmentation.segments.map(s=>s.id));
  state.dna=Ref.buildReferenceDna(state,analyses);
  return {state,rows};
}

test('published Reference Customer model survives library edits and remains available to Discovery',()=>{
  const {state,rows}=builtState();
  const published=Ref.publishReferenceModel(state);
  const fingerprint=published.publishedModel.fingerprint;
  const activeCount=published.publishedModel.activeCount;
  const edited=Ref.markReferenceDraftChanged({...published,rows:[rows[1]]});
  const normalized=Ref.normalizeReferenceState(edited);
  const active=Ref.getActiveReferenceModel(normalized);
  assert.equal(normalized.draftDirty,true);
  assert.equal(active.fingerprint,fingerprint);
  assert.equal(active.dna.fingerprint,fingerprint);
  assert.equal(active.dna.activeCount,activeCount);
});

test('publishing a refreshed model replaces the published model and clears pending state',()=>{
  const {state}=builtState();
  const first=Ref.publishReferenceModel(state);
  const dirty=Ref.markReferenceDraftChanged(first);
  assert.equal(dirty.draftDirty,true);
  let next=Ref.activateReferenceSegments({...dirty,segments:state.segments},state.segments.map(s=>s.id));
  next.analyses=state.analyses;
  next.dna=Ref.buildReferenceDna(next,next.analyses);
  const refreshed=Ref.publishReferenceModel(next);
  assert.equal(refreshed.draftDirty,false);
  assert.equal(refreshed.publishedModel.active,true);
  assert.equal(refreshed.publishedModel.dna.active,true);
});

test('individual reference profiles can be published without claiming shared traits',()=>{
  const rows=Ref.normalizeImportedRows(Array.from({length:5},(_,i)=>({Company:`Reference ${i+1}`,Website:`https://reference-${i+1}.example`})),{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map((row,index)=>[row.id,{industry:`industry ${index+1}`,businessModel:`model ${index+1}`,confidence:'high'}]));
  const segmentation=Ref.buildReferenceSegments(rows,analyses);
  let state=Ref.activateReferenceSegments({rows,analyses,...segmentation},[segmentation.segments[0].id]);
  state.dna=Ref.buildReferenceDna(state,analyses);

  assert.deepEqual(state.dna.dimensions,[]);
  assert.equal(Ref.publishReferenceModel(state).publishedModel.active,true);
  assert.equal(Ref.getActiveReferenceModel(state).dna.referenceProfiles.length,5);
  assert.equal(state.dna.profileConfidence,'low');
});

test('legacy published models retain individual seeds without inventing a shared pattern',()=>{
  const rows=Ref.normalizeImportedRows(Array.from({length:5},(_,i)=>({Company:`Reference ${i+1}`,Website:`https://reference-${i+1}.example`})),{sourceType:'csv'});
  const analyses=Object.fromEntries(rows.map((row,index)=>[row.id,{industry:`industry ${index+1}`,businessModel:`model ${index+1}`,confidence:'high'}]));
  const oldSegment={id:'legacy-segment',name:'Industrial equipment customers',rowIds:rows.map(row=>row.id),count:rows.length,confidence:'high',summary:'Previously marked high confidence',traits:['Industrial equipment']};
  const oldDna={version:2,active:true,fingerprint:'legacy-fingerprint',activeCount:rows.length,sampleSize:rows.length,analyzableCount:rows.length,confidence:'high',profileConfidence:'high',profileName:oldSegment.name,dimensions:[{key:'industry',values:Object.values(analyses).map(item=>item.industry),weight:1,confidence:'high',evidenceCount:1}]};
  const normalized=Ref.normalizeReferenceState({rows,analyses,segments:[oldSegment],activeSegmentIds:[oldSegment.id],activeIds:rows.map(row=>row.id),activated:true,fingerprint:'legacy-fingerprint',dna:oldDna,publishedModel:{active:true,fingerprint:'legacy-fingerprint',activeCount:rows.length,confidence:'high',dna:oldDna,activeRows:rows,activeSegments:[oldSegment],segmentIds:[oldSegment.id]},draftDirty:false});

  assert.equal(normalized.publishedModel.dna.calibrationVersion,2);
  assert.equal(Ref.getActiveReferenceModel(normalized).dna.referenceProfiles.length,5);
  assert.deepEqual(normalized.publishedModel.dna.dimensions,[]);
});

test('legacy activated models migrate to a persistent published model',()=>{
  const {state}=builtState();
  const migrated=Ref.normalizeReferenceState(state);
  assert.equal(migrated.publishedModel.active,true);
  assert.equal(Ref.getActiveReferenceModel(migrated).fingerprint,state.fingerprint);
});

test('Reference Customer library UI exposes persistent active-model and pending-update states',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-library-ui.js'),'utf8');
  const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-library.js'),'utf8');
  assert.match(ui,/Reference Companies/);
  assert.match(ui,/model changes waiting to be saved or activated|candidateReady/);
  assert.match(ui,/Save & Activate Model/);
  assert.match(ui,/Update Active Model/);
  assert.match(runtime,/markReferenceDraftChanged/);
  assert.match(runtime,/publishedModel/);
});

test('saved-list activation supports individual evidenced reference profiles',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-library-ui.js'),'utf8');
  assert.match(ui,/hasActivatableSegment/);
  assert.match(ui,/Individual reference profiles available/);
  assert.match(ui,/Opportunity discovery still works from your offers, market and signals/);
  assert.match(ui,/filter\(segment=>segment\.canActivate!==false&&checked\.includes\(segment\.id\)\)/);
  assert.match(ui,/No evidenced reference characteristics are available/);
});

test('Reference Customer library presents a simple list-first workflow and hides advanced metadata by default',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-library-ui.js'),'utf8');
  assert.match(ui,/Reference Companies/);
  assert.match(ui,/1\s*·\s*List/);
  assert.match(ui,/2\s*·\s*Analyze/);
  assert.match(ui,/3\s*·\s*Review/);
  assert.match(ui,/4\s*·\s*Activate/);
  assert.match(ui,/This list is not saved yet/);
  assert.match(ui,/Advanced list settings/);
  assert.match(ui,/Save List/);
  assert.match(ui,/Analyze List/);
  assert.match(ui,/Activate Model/);
  assert.match(ui,/Saved Lists/);
});

test('importing a customer file starts a separate draft without intercepting the native upload click',()=>{
  const uploadMode=fs.readFileSync(path.join(__dirname,'..','reference-customer-upload-mode.js'),'utf8');
  const baseUi=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');
  const aiRuntime=fs.readFileSync(path.join(__dirname,'..','reference-customer-ai-runtime.js'),'utf8');
  assert.match(uploadMode,/Import reference list/);
  assert.match(uploadMode,/Portfolio\.newList\(state\)/);
  assert.match(uploadMode,/reference-file-input/);
  assert.match(uploadMode,/consumeImportMode/);
  assert.doesNotMatch(uploadMode,/document\.addEventListener\('click'/);
  assert.doesNotMatch(uploadMode,/stopImmediatePropagation\s*\(/);
  assert.match(baseUi,/fileInput\.click\(\)/,'base UI must own the native file picker click');
  assert.match(aiRuntime,/reference-customer-upload-mode\.js\?v=20260911-reference-single-owner-v1/);
});

test('Excel smart import consumes new-vs-append mode itself before stopping propagation',()=>{
  const uploadMode=fs.readFileSync(path.join(__dirname,'..','reference-customer-upload-mode.js'),'utf8');
  const smartImport=fs.readFileSync(path.join(__dirname,'..','reference-customer-smart-import.js'),'utf8');
  const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  assert.match(uploadMode,/consumeImportMode/);
  assert.match(uploadMode,/if\(ext==='xlsx'\|\|ext==='xls'\)return/);
  assert.match(smartImport,/LeadIntelReferenceCustomerUploadMode\?\.consumeImportMode/);
  assert.match(smartImport,/LeadIntelReferenceCustomerPortfolio/);
  assert.match(smartImport,/Portfolio\?\.newList/);
  assert.match(smartImport,/Portfolio\.newList\(state\)/);
  assert.match(smartImport,/mode!=='append'/);
  assert.match(smartImport,/event\.stopImmediatePropagation\(\)/);
  assert.match(processMap,/reference-customer-smart-import\.js\?v=20260923-reference-interface-v1/);
});
test('refresh of an unchanged active list replaces the exact discovery seed and excludes weak references',()=>{
 const {state,rows}=builtState();const old=Ref.publishReferenceModel(state);const analyses={[rows[0].id]:{broadIndustry:'Lifting machinery',productionModel:'Equipment manufacturer',capabilities:['Welded assemblies'],confidence:'medium',sourceEvidence:[{field:'broadIndustry',quote:'We manufacture lifting machinery',url:'https://acme.example/products'}]},[rows[1].id]:{operatingComplexity:'Regional websites',confidence:'low'}};
 const refreshed=Ref.applyRefreshedAnalysis(Ref.markReferenceDraftChanged(old),analyses,'2026-09-30T20:00:00Z');const active=Ref.getActiveReferenceModel(refreshed);
 assert.equal(refreshed.draftDirty,false);assert.equal(active.activeRows.length,1);assert.equal(active.dna.referenceProfiles[0].companyName,'Acme');assert.equal(active.dna.referenceProfiles[0].dimensions.find(d=>d.key==='broadIndustry').values[0],'Lifting machinery');assert.equal(refreshed.analyzedAt,'2026-09-30T20:00:00Z');
});
test('failed refresh retains prior published evidence and an edited list requires review',()=>{
 const {state,rows}=builtState();const old=Ref.publishReferenceModel(state);const failed=Ref.applyRefreshedAnalysis(old,{[rows[0].id]:{confidence:'low'}});assert.equal(failed.draftDirty,true);assert.equal(Ref.getActiveReferenceModel(failed).dna.activeCount,2);
 const edited=Ref.applyRefreshedAnalysis({...old,rows:[rows[0]]},{[rows[0].id]:{broadIndustry:'Changed sector',sourceEvidence:[{field:'broadIndustry',quote:'We make equipment for construction',url:'https://acme.example/'}]}});assert.equal(edited.draftDirty,true);assert.equal(Ref.getActiveReferenceModel(edited).dna.activeCount,2);
});
test('refreshed profiles drive lookalike queries while directory-only classifications cannot activate',()=>{
 const AI=require('../reference-customer-ai.js'),Look=require('../lookalike-discovery.js');const {state,rows}=builtState();const quote='We manufacture lifting machinery and welded assemblies.';const evidence=[{id:rows[0].id,website:rows[0].website,text:quote,sources:[{url:rows[0].website,text:quote}]}];const parsed=AI.parseReferenceCustomerAnalysis(JSON.stringify({companies:[{id:rows[0].id,broadIndustry:'Lifting machinery',productionModel:'Equipment manufacturer',capabilities:['Welded assemblies'],sourceEvidence:['broadIndustry','productionModel','capabilities'].map(field=>({field,quote,url:rows[0].website})),confidence:'high'}]}),[rows[0].id],evidence);
 const refreshed=Ref.applyRefreshedAnalysis(Ref.publishReferenceModel(state),parsed.analyses);const model=Ref.getActiveReferenceModel(refreshed);const queries=Look.buildLookalikeDiscoveryQueries({targetMarkets:['Sweden']},model.dna,5);assert.ok(queries.some(q=>q.query.includes('Lifting machinery')));assert.ok(queries.some(q=>q.query.includes('Equipment manufacturer')));assert.ok(queries.every(q=>q.referenceCompany==='Acme'));
 const weak={rows:[rows[0]],analyses:{[rows[0].id]:{analysisVersion:4,operatingComplexity:'Country selector',sourceEvidence:[],confidence:'low'}}};let candidate=Ref.activateReferenceCustomers(weak,[rows[0].id]);candidate.dna=Ref.buildReferenceDna(candidate,candidate.analyses);assert.equal(Ref.hasUsableReferenceDna(candidate.dna),false);
});

test('published checkbox recovers row-based refreshes without selecting unsupported segments',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../reference-customer-ui.js'),'utf8');const scope={};vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('function isPublishedSegmentSelected('),source.indexOf('function individualReferenceCards(')),scope);
 const reference={publishedModel:{active:true,segmentIds:[],activeRows:[{id:'a'},{id:'b'}]},draftDirty:false};
 assert.equal(scope.isPublishedSegmentSelected(reference,{id:'new',rowIds:['a','b']}),true);
 assert.equal(scope.isPublishedSegmentSelected(reference,{id:'other',rowIds:['a','c']}),false);
 assert.equal(scope.isPublishedSegmentSelected({...reference,draftDirty:true},{id:'new',rowIds:['a','b']}),false);
 const {state,rows}=builtState();const analyses=Object.fromEntries(rows.map(row=>[row.id,{broadIndustry:'Machinery',productionModel:'Equipment manufacturer',sourceEvidence:[{field:'broadIndustry',quote:'We manufacture machinery',url:row.website}],confidence:'medium'}]));const refreshed=Ref.applyRefreshedAnalysis(Ref.publishReferenceModel(state),analyses);assert.ok(refreshed.activeSegmentIds.length);assert.deepEqual(refreshed.publishedModel.segmentIds,refreshed.activeSegmentIds);
});
