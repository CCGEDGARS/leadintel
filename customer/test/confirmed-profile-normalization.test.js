const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function normalizeWith(file,value){
 const root={LeadIntelProfile:{normalizeSavedState:v=>JSON.parse(JSON.stringify(v))}};vm.runInNewContext(fs.readFileSync(require.resolve('../'+file),'utf8'),root);
 if(file==='business-identity.js')root.LeadIntelBusinessIdentity.patchProfileEngine(root.LeadIntelProfile,root);
 return root.LeadIntelProfile.normalizeSavedState(value);
}
function state(status='user_confirmed'){return {website:'https://manufacturer.example',answers:{buying_outcomes:'Reduce maintenance downtime'},answerStatus:{buying_outcomes:'user'},profile:{companyName:'Manufacturer',customerPainPoints:'Legacy generated fallback',customerPainPointsStatus:'AI-inferred · review recommended',customerPainPointsLanguage:'lv',canonical:{version:1,fields:{customerPainPoints:{value:'Reduce maintenance downtime',status,provenance:'user',sourceIds:['U:buying_outcomes']}}}}};}
for(const file of ['company-brain.js','business-identity.js']){
 test(file+' preserves canonical confirmed context and existing metadata through reopen',()=>{const value=state(),result=normalizeWith(file,value);assert.equal(result.profile.customerPainPoints,'Reduce maintenance downtime');assert.equal(result.profile.canonical.fields.customerPainPoints.status,'user_confirmed');assert.equal(result.profile.customerPainPointsStatus,value.profile.customerPainPointsStatus);const reopened=normalizeWith(file,JSON.parse(JSON.stringify(result)));assert.equal(reopened.profile.customerPainPoints,result.profile.customerPainPoints);assert.equal(reopened.profile.customerPainPointsStatus,result.profile.customerPainPointsStatus);});
 test(file+' does not promote an inferred canonical record to confirmed context',()=>{const result=normalizeWith(file,state('ai_inference'));assert.notEqual(result.profile.customerPainPointsStatus,'Customer-confirmed');});
 test(file+' preserves a newer explicitly confirmed profile edit',()=>{const value=state();value.profile.customerPainPoints='New reviewed customer context';value.profile.customerPainPointsStatus='Customer-confirmed';assert.equal(normalizeWith(file,value).profile.customerPainPoints,value.profile.customerPainPoints);});
}
