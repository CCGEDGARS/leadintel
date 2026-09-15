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
  assert.match(ui,/runDiscoverySearchBatch\(resolutionQueries,"resolving"\)/);
  assert.match(ui,/buildCandidateVerificationQueries\(resolved/);
  assert.match(ui,/attachSourceEvidenceToResolvedCompanies\(resolved,companyMentions,firstPass\)/);
  assert.match(ui,/mergeCompanyCandidates\(\[\.\.\.evidenceLinked,\.\.\.verified\]/);
  assert.doesNotMatch(ui,/buildCandidateVerificationQueries\(firstPass/);
});
