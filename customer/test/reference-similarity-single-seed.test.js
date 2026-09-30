const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Ref=require('../reference-customers.js');
require('../reference-customer-library.js');
const Portfolio=require('../reference-customer-portfolio.js');
const Look=require('../lookalike-discovery.js');
const AI=require('../reference-customer-ai.js');
const D=require('../discovery-engine.js');
function seed(count=1){
 const rows=Ref.normalizeImportedRows(Array.from({length:count},(_,i)=>({Company:`Best customer ${i}`,Website:`https://reference-${i}.example`})));
 const analyses=Object.fromEntries(rows.map((row,i)=>[row.id,{industry:`Equipment category ${i}`,productionModel:'Equipment manufacturer',capabilities:[`Machine type ${i}`],confidence:'high'}]));
 const groups=Ref.buildReferenceSegments(rows,analyses);
 let state=Ref.activateReferenceSegments({rows,analyses,segments:groups.segments},groups.segments.map(s=>s.id));
 state.dna=Ref.buildReferenceDna(state);return {rows,reference:Ref.publishReferenceModel(state)};
}
test('one best customer survives publish, account reload and Swedish query generation without a map or event',()=>{
 const {reference,rows}=seed();let state=Portfolio.saveCurrentList({referenceCustomers:reference},{name:'Best customer',markets:['Sweden']});
 state=Portfolio.setListActive(state,state.referenceCustomerPortfolio.selectedListId,true);
 state=Portfolio.ensurePortfolio(JSON.parse(JSON.stringify(state)));
 const model=Portfolio.getCombinedActiveModel(state);
 assert.equal(model.active,true);assert.equal(model.dna.referenceProfiles.length,1);assert.equal(reference.opportunityMap,null);
 const queries=Look.buildLookalikeDiscoveryQueries({targetMarkets:'Sweden'},model.dna,6);
 assert.ok(queries.length>=2);assert.ok(queries.every(q=>q.market==='Sweden'));assert.ok(queries.some(q=>q.query.includes('Equipment category 0')));
 assert.equal(model.models[0].activeRows[0].id,rows[0].id);
});
test('five distinct products remain five usable similarity seeds without inventing shared industry',()=>{
 const {reference}=seed(5);const model=Ref.getActiveReferenceModel(reference);
 assert.equal(model.dna.referenceProfiles.length,5);
 assert.equal(model.dna.dimensions.some(d=>d.key==='industry'),false);
 const queries=Look.buildLookalikeDiscoveryQueries({targetMarkets:'Sweden'},model.dna,8);
 assert.equal(new Set(queries.map(q=>q.referenceId).filter(Boolean)).size,5);
});
test('an exact single-company evidence match is not capped at 50 because population confidence is low',()=>{
 const {reference}=seed();const model=Ref.getActiveReferenceModel(reference);
 const result=Look.scoreLookalikeSet({description:'Equipment category 0 Equipment manufacturer Machine type 0'},model);
 assert.equal(model.dna.confidence,'low');assert.equal(result.total,100);assert.equal(result.referenceCompany,'Best customer 0');
});
test('no website characteristics means no active model even with a saved activation flag',()=>{
 const rows=Ref.normalizeImportedRows([{Company:'Unreadable',Website:'https://unreadable.example'}]);
 const state=Ref.normalizeReferenceState({rows,analyses:{[rows[0].id]:{confidence:'high',summary:'No evidence available'}},activeIds:[rows[0].id],activated:true});
 assert.equal(Ref.getActiveReferenceModel(state),null);
});
test('canonical commercial fields require a quote from the supplied first-party evidence',()=>{
 const rows=[{id:'a',website:'https://reference.example',text:'We manufacture cranes and lifting equipment for industrial customers.'}];
 const content=JSON.stringify({companies:[{id:'a',broadIndustry:'Industrial equipment manufacturing',productionModel:'Equipment manufacturer',capabilities:['cranes'],sourceEvidence:[{field:'broadIndustry',quote:'We manufacture cranes and lifting equipment',url:rows[0].website},{field:'productionModel',quote:'Invented sourcing quote',url:rows[0].website}],industry:'Cranes',confidence:'high'}]});
 const parsed=AI.parseReferenceCustomerAnalysis(content,['a'],rows).analyses.a;
 assert.equal(parsed.broadIndustry,'Industrial equipment manufacturing');assert.equal(parsed.productionModel,'');assert.deepEqual(parsed.capabilities,[]);
});
test('semantic similarity rejects fabricated companies, references, quotes, URLs and directory-only evidence',()=>{
 const {reference,rows}=seed();const model=Ref.getActiveReferenceModel(reference);
 const candidates=[{domain:'prospect.se',company:'Prospect',qualified:false,evidence:[{url:'https://prospect.se/about',text:'We manufacture industrial lifting equipment in Sweden.'},{url:'https://directory.example/list',text:'We manufacture industrial lifting equipment in Sweden.'}]}];
 const match={domain:'prospect.se',referenceId:rows[0].id,score:92,matchedTraits:[{trait:'Equipment manufacturer',quote:'We manufacture industrial lifting equipment',url:'https://prospect.se/about'}]};
 const valid=Look.parseEvidenceSimilarity(JSON.stringify({matches:[match]}),candidates,model);
 assert.equal(valid.get('prospect.se').total,85,'One source caps certainty');
 for(const invalid of [{...match,domain:'invented.se'},{...match,referenceId:'fake'}, {...match,matchedTraits:[{...match.matchedTraits[0],quote:'Invented quotation here'}]}, {...match,matchedTraits:[{...match.matchedTraits[0],url:'https://directory.example/list'}]}])assert.equal(Look.parseEvidenceSimilarity(JSON.stringify({matches:[invalid]}),candidates,model).size,0);
 assert.equal(candidates[0].qualified,false);
});
test('semantic research uses the authenticated route and preserves buying-intent qualification',async()=>{
 const {reference,rows}=seed();const model=Ref.getActiveReferenceModel(reference);
 const candidate={domain:'prospect.se',company:'Prospect',qualified:false,marketVerified:true,fitVerified:true,evidence:[{url:'https://prospect.se/about',text:'We manufacture industrial lifting equipment in Sweden.'}],qualificationGaps:['Buying signal unconfirmed']};
 let body;
 const results=await Look.researchEvidenceSimilarity({candidates:[candidate],model,workspaceId:'ws',fetchImpl:async(url,options)=>{assert.match(url,/workspace_id=ws/);assert.equal(options.credentials,'include');body=JSON.parse(options.body);return {ok:true,json:async()=>({text:JSON.stringify({matches:[{domain:'prospect.se',referenceId:rows[0].id,score:80,matchedTraits:[{trait:'Equipment manufacturer',quote:'We manufacture industrial lifting equipment',url:candidate.evidence[0].url}]}]})})};}});
 assert.match(body.prompt,/NOT buying intent/);assert.equal(results[0].lookalikeMatch.total,80);assert.equal(results[0].qualified,false);
 const restored=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,potentialMatches:results}).potentialMatches[0];assert.equal(restored.lookalikeMatch.total,80);assert.equal(restored.qualified,false);
});
test('single-reference activation has no required Opportunity Map gate in either UI owner',()=>{
 for(const file of ['reference-customer-ui.js','reference-customer-library-ui.js']){const source=fs.readFileSync(require.resolve(`../${file}`),'utf8');assert.doesNotMatch(source,/throw new Error\('Build the Opportunity Map/);assert.doesNotMatch(source,/needsMap=analyzed===1|needsMap=sampleSize===1|analyzed!==1\|\|mapReady/);}
});
