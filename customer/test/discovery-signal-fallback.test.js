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

test('company-name extraction requests Gemini failover explicitly and displays the provider used',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const ui=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');
  assert.match(ui,/purpose:"company_discovery_extraction"/);
  assert.match(ui,/payload\.failover\?\.used\?"Gemini fallback"/);
  assert.match(ui,/Company extraction\$\{discovery\.extraction\.method/);
  assert.match(ui,/configured Gemini backup was also unavailable/);
  assert.match(ui,/verify the saved Gemini key in Settings/);
  assert.match(ui,/const ASSET_VERSION="20260925-gemini-company-extraction-fallback-v1"/);
});
