const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const processMapSource=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const activationPath=path.join(root,'website-activation.js');
const activationSource=fs.readFileSync(activationPath,'utf8');
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

test('returnToWebsiteStep rewrites stale canonical navigation and activates Step 1 in the live UI',()=>{
  assert.equal(typeof activation.returnToWebsiteStep,'function');
  const previous={localStorage:global.localStorage,document:global.document,MouseEvent:global.MouseEvent};
  let stored=JSON.stringify({step:5,website:'https://www.ccgroup.lv/'});let clicks=0;
  global.localStorage={getItem:key=>key===activation.STORAGE_KEY?stored:null,setItem:(key,value)=>{if(key===activation.STORAGE_KEY)stored=value;}};
  global.MouseEvent=class MouseEvent{constructor(type,options={}){this.type=type;Object.assign(this,options);}};
  global.document={querySelector:selector=>selector==='[data-step-marker="1"]'?{dispatchEvent:()=>{clicks+=1;}}:null,querySelectorAll:()=>[]};
  try{
    assert.equal(activation.returnToWebsiteStep(),true);
    assert.equal(JSON.parse(stored).step,1);
    assert.equal(clicks,1);
  }finally{
    if(previous.localStorage===undefined)delete global.localStorage;else global.localStorage=previous.localStorage;
    if(previous.document===undefined)delete global.document;else global.document=previous.document;
    if(previous.MouseEvent===undefined)delete global.MouseEvent;else global.MouseEvent=previous.MouseEvent;
  }
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

test('successful activation clears stale Discovery navigation and returns the visible UI to Step 1',()=>{
  assert.match(activationSource,/DISCOVERY_META_KEY/);
  assert.match(activationSource,/removeItem\(DISCOVERY_META_KEY\)/);
  assert.match(activationSource,/returnToWebsiteStep\(\)/);
});
