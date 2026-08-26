const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const processMapSource=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');
const discoveryUiSource=fs.readFileSync(path.join(root,'discovery-ui.js'),'utf8');
const activationPath=path.join(root,'website-activation.js');
const activation=fs.existsSync(activationPath)?require(activationPath):null;

test('Step 1 activation markup exposes an explicit button and live status',()=>{
  assert.ok(activation,'website-activation.js must exist');
  assert.equal(typeof activation.activationMarkup,'function');
  const markup=activation.activationMarkup();
  assert.match(markup,/id="activate-website"/);
  assert.match(markup,/ACTIVATE WEBSITE/);
  assert.match(markup,/id="website-activation-status"/);
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

test('successful activation preserves customer inputs while resetting stale strategic outputs and navigation',()=>{
  assert.ok(activation,'website-activation.js must exist');
  const state={
    step:5,
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
  assert.equal(next.step,1,'website activation must return the journey to Step 1 instead of preserving a stale later step');
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

test('activation registry survives ordinary workspace saves and still proves the same website is active',()=>{
  assert.ok(activation,'website-activation.js must exist');
  assert.equal(typeof activation.buildActivationRecord,'function');
  assert.equal(typeof activation.isActivationRecordActive,'function');
  const record=activation.buildActivationRecord({url:'www.ccgroup.lv',title:'CCGROUP',description:'Sales training',text:'Readable evidence'},'2026-08-26T11:00:00.000Z');
  assert.equal(record.status,'active');
  assert.equal(record.url,'https://www.ccgroup.lv/');
  assert.equal(record.source.text,'Readable evidence');
  assert.equal(activation.isActivationRecordActive(record,'www.ccgroup.lv'),true);
  assert.equal(activation.isActivationRecordActive(record,'example.com'),false);
});

test('process readiness requires an activated website instead of a merely visible URL',()=>{
  assert.match(processMapSource,/LeadIntelWebsiteActivation/);
  assert.match(processMapSource,/isCurrentWebsiteActive\(/);
});

test('website activation resynchronizes the app and stale discovery metadata cannot reopen Step 5',()=>{
  assert.match(appSource,/leadintel:website-activated/,'app.js must resynchronize its in-memory state after website activation');
  assert.match(appSource,/state\s*=\s*loadState\(\)/,'app.js must reload the canonical local state after activation');
  assert.doesNotMatch(discoveryUiSource,/else if\(loadMeta\(\)\.visibleStep===5&&moduleReady\(\)\)showDiscoveryStep\(\)/,'discovery-ui.js must not override the canonical main step with stale visibleStep metadata');
});
