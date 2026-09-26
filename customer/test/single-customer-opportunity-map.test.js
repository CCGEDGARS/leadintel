const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const AI=require('../reference-customer-ai.js');
const Ref=require('../reference-customers.js');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('single-customer opportunity map uses seller deal context and never asks AI for market numbers',async()=>{
  let request;
  const hypotheses=await AI.requestOpportunityMap({workspaceId:'w1',customer:{companyName:'Paper Co',website:'https://paper.example'},analysis:{industry:'Paper'},seller:{website:'https://seller.example',priorityOffers:'Maintenance'},service:'Maintenance',problem:'Reduce downtime',dealTrigger:'New production line',market:'Sweden',fetchImpl:async(_url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({text:JSON.stringify({hypotheses:[{niche:'Food manufacturers',sharedNeed:'Reduce production downtime',whyRelevant:'They run continuous lines',evidenceToCheck:'Recent capacity investment'}]})})};}});
  assert.equal(hypotheses.length,1);
  assert.match(request.prompt,/Reduce downtime/);
  assert.match(request.prompt,/Do not give market counts/);
  assert.match(request.prompt,/hypotheses, not qualified companies/);
});

test('reject empty or untestable AI hypotheses',()=>{
  assert.throws(()=>AI.parseOpportunityMap('{"hypotheses":[{"niche":"Paper"}]}'),/no useful opportunity/);
});

test('opportunity map survives reference normalization and is removed with its customer',()=>{
  const row={companyName:'Paper Co',website:'https://paper.example'};
  const state=Ref.normalizeReferenceState({rows:[row]});
  const id=state.rows[0].id;
  const map={customerId:id,service:'Maintenance',problem:'Downtime',hypotheses:[{niche:'Food manufacturing',sharedNeed:'Keep lines running',whyRelevant:'Production',evidenceToCheck:'Investment'}],analysisAt:'date'};
  const saved=Ref.normalizeReferenceState({...state,opportunityMap:map});
  assert.equal(saved.opportunityMap.hypotheses[0].niche,'Food manufacturing');
  assert.equal(Ref.normalizeReferenceState({...saved,rows:[]}).opportunityMap,null);
});

test('the map is displayed only for one analyzed customer and shows unverified sizing',()=>{
  const ui=source('reference-customer-ui.js');
  assert.match(ui,/analyzed\.length!==1/);
  assert.match(ui,/Company count and market value have not been verified/);
  assert.match(ui,/leadintel:open-discovery/);
});

test('fresh opportunity hypotheses add bounded evidence searches to Company Discovery',()=>{
  const ui=source('discovery-ui.js');
  assert.match(ui,/function opportunityHypothesisQueries\(main,market\)/);
  assert.match(ui,/map\.analysisAt!==reference\.analyzedAt/);
  assert.match(ui,/map\.hypotheses\.slice\(0,2\)/);
  assert.match(ui,/\.\.\.opportunityHypothesisQueries\(main,targetMarket\)/);
});
