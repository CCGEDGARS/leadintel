const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function slice(start,end){const from=source.indexOf(start);assert.ok(from>=0,start);const to=source.indexOf(end,from);assert.ok(to>from,end);return source.slice(from,to);}
test('company identity domain folds careers, jobs and corporate hosts into the company domain',()=>{
 assert.equal(D.companyIdentityDomain('careers.westernunion.com'),'westernunion.com');
 assert.equal(D.companyIdentityDomain('https://jobs.thermofisher.com/'),'thermofisher.com');
 assert.equal(D.companyIdentityDomain('corporate.thermofisher.com'),'thermofisher.com');
 assert.equal(D.companyIdentityDomain('nasdaqbaltic.com'),'nasdaqbaltic.com');
});
test('research review shows one row per company and keeps the apex domain on equal evidence',()=>{
 const context={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain};vm.createContext(context);
 vm.runInContext(slice('function researchReviewKey(','function researchReviewRows('),context);
 const rows=[
  {company:'Thermo Fisher Scientific',domain:'corporate.thermofisher.com',evidence:[1]},
  {company:'Thermo Fisher Scientific',domain:'thermofisher.com',evidence:[1]},
  {company:'Thermo Fisher Scientific',domain:'jobs.thermofisher.com',evidence:[1,2]},
  {company:'Western Union',domain:'careers.westernunion.com',evidence:[1]},
  {company:'Western Union',domain:'westernunion.com',evidence:[1]},
  {company:'Nasdaq',domain:'nasdaq.com',evidence:[1]},
  {company:'Nasdaq',domain:'nasdaqbaltic.com',evidence:[1]},
  {company:'Nameless',domain:'',website:'',evidence:[]}
 ];
 const result=JSON.parse(JSON.stringify(context.dedupeResearchReview(rows)));
 assert.deepEqual(result.map(r=>r.domain),['jobs.thermofisher.com','westernunion.com','nasdaq.com','nasdaqbaltic.com','']);
 assert.equal(context.researchReviewKey({domain:'careers.westernunion.com'}),context.researchReviewKey({domain:'westernunion.com'}));
 assert.equal(context.researchReviewKey({company:'Only Name'}),'name:only name');
});
test('removing a review row removes every host of that company',()=>{
 const checked={company:'Checked',domain:'checked.lv'},people=[{name:'Saved Buyer'}];let saved=0;
 const context={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,discovery:{status:'partial',potentialMatches:[{domain:'jobs.example.lv'},{domain:'example.lv'},{domain:'other.lv'}],candidates:[checked,{domain:'corporate.example.lv',needsRecheck:true}],selectedProspects:[{domain:'example.lv',people}]},qualificationAssessment:c=>({eligible:c===checked}),saveDiscovery(){saved++;},renderAll(){},showToast(){}};
 vm.createContext(context);vm.runInContext(slice('function researchReviewKey(','function researchReviewRows(')+slice('function removeResearchReviewCompany(','function clearResearchReview('),context);
 assert.equal(context.removeResearchReviewCompany('example.lv'),true);assert.equal(saved,1);
 assert.deepEqual(Array.from(context.discovery.potentialMatches,c=>c.domain),['other.lv']);assert.deepEqual(Array.from(context.discovery.candidates,c=>c.domain),['checked.lv']);assert.equal(context.discovery.selectedProspects[0].people,people);
});
