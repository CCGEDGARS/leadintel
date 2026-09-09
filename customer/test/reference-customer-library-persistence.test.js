const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Ref=require('../reference-customers.js');

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
  let state=Ref.normalizeReferenceState({
    rows,
    analyses,
    segments:segmentation.segments,
    segmentationMeaningful:segmentation.meaningful
  });
  state=Ref.activateReferenceSegments(state,segmentation.segments.map(s=>s.id));
  state.dna=Ref.buildReferenceDna(state,analyses);
  return {state,rows};
}

test('published Reference Customer model survives library edits and remains available to Discovery',()=>{
  const {state,rows}=builtState();
  const published=Ref.publishReferenceModel(state);
  const fingerprint=published.publishedModel.fingerprint;
  const activeCount=published.publishedModel.activeCount;

  const edited=Ref.markReferenceDraftChanged({
    ...published,
    rows:[rows[1]]
  });

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

  let next=Ref.activateReferenceSegments(
    {...dirty,segments:state.segments},
    state.segments.map(s=>s.id)
  );
  next.analyses=state.analyses;
  next.dna=Ref.buildReferenceDna(next,next.analyses);
  const refreshed=Ref.publishReferenceModel(next);

  assert.equal(refreshed.draftDirty,false);
  assert.equal(refreshed.publishedModel.active,true);
  assert.equal(refreshed.publishedModel.dna.active,true);
});

test('Reference Customer library UI exposes persistent active-model and pending-update states',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');
  const enrich=fs.readFileSync(path.join(__dirname,'..','reference-customer-website-enrichment.js'),'utf8');

  assert.match(ui,/Reference Customer Library/);
  assert.match(ui,/Pending model update/);
  assert.match(ui,/New version ready/);
  assert.match(ui,/Update active model/);
  assert.match(ui,/markReferenceDraftChanged/);
  assert.match(enrich,/markReferenceDraftChanged/);
});
