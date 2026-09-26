const test=require('node:test');
const assert=require('node:assert/strict');
const Discovery=require('../discovery-engine.js');

test('companies without exact signal evidence are withheld from the actionable shortlist',()=>{
  const candidates=Discovery.mergeCompanyCandidates([
    {
      domain:'ergostock.lv',
      url:'https://ergostock.lv/projects/office',
      company:'Ergostock',
      market:'Latvia',
      title:'Office furniture project',
      description:'Commercial office furniture and workplace planning project.',
      text:'The company presents office furniture delivery and workplace planning for commercial customers.'
    }
  ],{
    companyName:'AJ Produkti',
    website:'https://ajprodukti.lv',
    priorityOffers:'Office furniture; warehouse equipment',
    idealCustomer:'Companies in Latvia seeking workplace furniture.'
  },{
    signals:[{
      id:'facility-expansion',
      name:'Facility expansion',
      keywords:'facility expansion;new premises',
      active:true,
      weight:9
    }],
    icps:[],
    opportunities:[]
  },10);

  assert.deepEqual(candidates,[]);
});

test('Company Discovery resolves named companies from evidence before verifying official domains',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const ui=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
  assert.match(ui,/extractCompaniesFromEvidence/);
  assert.match(ui,/buildCompanyResolutionQueries/);
  assert.match(ui,/runDiscoverySearchBatch\(resolutionQueries,"resolving",runController\.signal,resolutionRows\)/);
  assert.match(ui,/buildCandidateVerificationQueries\(resolved/);
  assert.match(ui,/attachSourceEvidenceToResolvedCompanies\(resolved,mentions,allMarketEvidence\)/);
  assert.match(ui,/mergeCompanyCandidates\(\[\.\.\.linkedEvidence,\.\.\.allVerified\]/);
  assert.doesNotMatch(ui,/buildCandidateVerificationQueries\(firstPass/);
});

test('target research stays scoped to selected companies and reports recovered credit errors',()=>{
  const fs=require('node:fs');const path=require('node:path');
  const ui=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
  assert.match(ui,/runCompanyDiscovery\(\{targetOnly:true\}\)/);
  assert.match(ui,/targetOnly\?targetEvidenceQueries\(researchTargets/);
  assert.match(ui,/if\(!targetOnly&&firstPassSucceeded/);
  assert.match(ui,/providerFallbacks\.push\(\{queryId:queryMeta\.id,status:/);
  assert.match(ui,/HTTP 402: check Firecrawl credits or billing/);
  const normalized=Discovery.normalizeDiscoveryState({providerFallbacks:[{queryId:'target-evidence-1',status:402}]});
  assert.deepEqual(normalized.providerFallbacks,[{queryId:'target-evidence-1',status:402}]);
});
