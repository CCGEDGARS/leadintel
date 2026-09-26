const test=require('node:test');
const assert=require('node:assert/strict');
const Ref=require('../reference-customers.js');
const Profile=require('../profile-engine.js');

test('chosen targets survive workspace normalization without entering the past customer model',()=>{
  const targetCompanies=Ref.normalizeTargetCompanies([
    {companyName:'Södra',website:'https://www.sodra.com/'},
    {companyName:'Södra duplicate',website:'sodra.com'},
    {companyName:'Ercon',website:'https://www.ercon.lv'},
    {companyName:'Boliden',website:'boliden.com'}
  ],'https://www.ercon.lv/');
  assert.deepEqual(targetCompanies.map(row=>row.companyName),['Södra','Boliden']);
  const saved=Profile.normalizeSavedState({website:'https://www.ercon.lv/',targetCompanies});
  assert.equal(saved.targetCompanies.length,2);
  assert.equal(saved.referenceCustomers,undefined);
  assert.equal(saved.targetCompanies[0].score,undefined);
});
