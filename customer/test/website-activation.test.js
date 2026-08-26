const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const processMapSource=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const researchUiSource=fs.readFileSync(path.join(root,'company-research-ui.js'),'utf8');
const profile=require('../profile-engine.js');
const activationPath=path.join(root,'website-activation.js');
const activation=fs.existsSync(activationPath)?require(activationPath):null;

test('Step 1 exposes an explicit website activation control and live status',()=>{
  assert.match(indexSource,/id="activate-website"/);
  assert.match(indexSource,/ACTIVATE WEBSITE/);
  assert.match(indexSource,/id="website-activation-status"/);
  assert.match(processMapSource,/website-activation\.js\?v=/);
});

test('website activation is valid only for the matching URL with readable evidence',()=>{
  assert.ok(activation,'website-activation.js must exist');
  const state={
    website:'https://www.ccgroup.lv/',
    websiteActivation:{status:'active',url:'https://www.ccgroup.lv/',activatedAt:'2026-08-26T10:00:00.000Z'},
    scrapedSources:[{type:'website',url:'https://www.ccgroup.lv/',title:'CCGROUP',text:'Readable company evidence',status:'ready'}]
  };
  assert.equal(activation.isWebsiteActive(state,'www.ccgroup.lv'),true);
  assert.equal(activation.isWebsiteActive(state,'https://example.com'),false);
  assert.equal(activation.isWebsiteActive({...state,scrapedSources:[]},'www.ccgroup.lv'),false);
});

test('successful activation preserves customer inputs while resetting stale strategic outputs',()=>{
  assert.ok(activation,'website-activation.js must exist');
  const state={
    website:'https://old.example.com/',
    targetMarkets:['Sweden'],
    answers:{ideal_customer:'Manufacturers'},
    documents:[{name:'catalog.pdf',text:'catalog'}],
    additionalLinks:['https://old.example.com/cases'],
    profile:{companyName:'Old'},
    approved:true,
    market:{strategyApproved:true},
    scrapedSources:[{type:'website',url:'https://old.example.com/',text:'old'}]
  };
  const next=activation.buildActivatedState(state,{url:'www.ccgroup.lv',title:'CCGROUP',description:'Sales training and AI',text:'Fresh company evidence'},'2026-08-26T11:00:00.000Z');
  assert.equal(next.website,'https://www.ccgroup.lv/');
  assert.equal(next.websiteActivation.status,'active');
  assert.equal(next.websiteActivation.title,'CCGROUP');
  assert.equal(next.websiteActivation.contentChars,22);
  assert.deepEqual(next.targetMarkets,['Sweden']);
  assert.deepEqual(next.answers,{ideal_customer:'Manufacturers'});
  assert.deepEqual(next.documents,[{name:'catalog.pdf',text:'catalog'}]);
  assert.equal(next.profile,null);
  assert.equal(next.approved,false);
  assert.deepEqual(next.market,{});
  assert.equal(next.scrapedSources.length,1);
  assert.equal(next.scrapedSources[0].type,'website');
  assert.equal(next.scrapedSources[0].url,'https://www.ccgroup.lv/');
  assert.equal(next.scrapedSources[0].text,'Fresh company evidence');
});

test('normalized customer state keeps activation metadata across reloads',()=>{
  const normalized=profile.normalizeSavedState({
    website:'www.ccgroup.lv',
    targetMarkets:['Sweden'],
    websiteActivation:{status:'active',url:'www.ccgroup.lv',title:'CCGROUP',description:'Sales training and AI',activatedAt:'2026-08-26T11:00:00.000Z',contentChars:1234},
    scrapedSources:[{type:'website',url:'www.ccgroup.lv',title:'CCGROUP',text:'Readable evidence',status:'ready'}]
  });
  assert.deepEqual(normalized.websiteActivation,{
    status:'active',url:'https://www.ccgroup.lv/',title:'CCGROUP',description:'Sales training and AI',activatedAt:'2026-08-26T11:00:00.000Z',contentChars:1234
  });
});

test('company research requires activation and reuses the activated website evidence',()=>{
  assert.match(researchUiSource,/LeadIntelWebsiteActivation/);
  assert.match(researchUiSource,/isWebsiteActive\(/);
  assert.match(researchUiSource,/getActivatedSource\(/);
  assert.match(researchUiSource,/Activate your website first/);
});
