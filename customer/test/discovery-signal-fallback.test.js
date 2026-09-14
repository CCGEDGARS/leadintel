const test=require('node:test');
const assert=require('node:assert/strict');
const Discovery=require('../discovery-engine.js');

test('evidence-backed companies remain visible when exact signal terms are absent',()=>{
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

  assert.equal(candidates.length,1);
  assert.equal(candidates[0].matchedSignals.length,0);
  assert.equal(candidates[0].score.signal,0);
  assert.equal(candidates[0].domain,'ergostock.lv');
});
