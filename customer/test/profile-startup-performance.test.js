const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

test('saved profile normalization cannot block startup on long punctuation-rich website tokens',()=>{
 const result=spawnSync(process.execPath,['-e',`
  const p=require('./customer/profile-engine.js');
  const identity=require('./customer/business-identity.js');
  identity.patchProfileEngine(p);
  const text='We manufacture industrial equipment. '+('asset-'.repeat(5000))+' Our team provides installation services.';
  const state={website:'https://example.test',profile:{companyName:'Example',priorityOffers:'Industrial equipment'},scrapedSources:Array.from({length:3},(_,i)=>({url:'https://example.test/'+i,text}))};
  const restored=p.normalizeSavedState(state);
  if(restored.website!==state.website+'/'||restored.scrapedSources.length!==3)process.exit(2);
 `],{cwd:path.resolve(__dirname,'../..'),timeout:3000,encoding:'utf8'});
 assert.ifError(result.error);
 assert.equal(result.status,0,result.stderr);
});

test('asset cleanup still removes image filenames and retains surrounding evidence',()=>{
 const p=require('../profile-engine.js');
 const result=p.buildCompanyIntelligenceProfile({website:'https://example.test',scrapedSources:[{url:'https://example.test',text:'We manufacture industrial equipment for factories. /assets/production-line.png?size=large Our team provides installation and qualified workforce solutions.'}]});
 assert.doesNotMatch(result.companyOverview,/production-line\.png/);
 assert.match(result.companyOverview,/manufacture industrial equipment/);
 assert.match(result.companyOverview,/installation/);
});
