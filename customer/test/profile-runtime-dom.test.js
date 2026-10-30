const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const MAIN='leadintel_customer_v2_state';

function harness({step=3,canonicalBeforeInit=false}={}){
  const errors=[];
  const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error));
  // Use the shipping document. In particular, do not add back the gaps panel
  // removed by the real canonical runtime below.
  const dom=new JSDOM(read('index.html'),{url:'https://leadintel.example/customer/',runScripts:'outside-only',virtualConsole:console});
  const w=dom.window;
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.LeadIntelServerBridge={ready:true,session:{authenticated:true},workspace:{id:'profile-runtime-test'},saveNow:async()=>{}};
  let verifiedInit;
  w.LeadIntelAccountCache={current:()=>true,afterVerification:init=>{verifiedInit=init;}};
  const load=file=>w.eval(read(file));
  for(const file of ['content-language.js','step2-brief-schema.js','profile-engine.js','market-engine.js','targeting-policy.js','company-brain.js','canonical-intelligence.js','canonical-profile-runtime.js','intelligence-profile-ui.js','profile-approval-ui.js'])load(file);
  w.eval(read('evidence-view.js').slice(read('evidence-view.js').indexOf('(function(root,factory)')));
  const answers=Object.fromEntries(w.LeadIntelStep2Brief.FIELD_IDS.map(id=>[id,`Confirmed ${id}`]));
  Object.assign(answers,{priority_offers:'Industrial maintenance and installation services',ideal_customer:'Manufacturing plants',buyer_roles:'Maintenance Director; Operations Director',exclusions:'Residential customers',buying_triggers:'Factory expansion and equipment upgrades',buying_outcomes:'Reliable production and shorter downtime'});
  const saved={step,website:'https://seller.example/',targetMarkets:['Sweden'],answers,answerStatus:Object.fromEntries(Object.keys(answers).map(key=>[key,'user'])),documents:[],additionalLinks:[],scrapedSources:[{url:'https://seller.example/',type:'website',title:'Seller',text:'Seller provides industrial maintenance and equipment installation services for manufacturing plants.',status:'ready'}],approved:true,market:{strategyApproved:true},workspaceGoals:{successOutcome:'Research suitable manufacturers'}};
  saved.profile=w.LeadIntelProfile.buildCompanyIntelligenceProfile(saved);
  saved.targetingConfirmation=w.LeadIntelTargeting.confirm(saved);
  w.localStorage.setItem(MAIN,JSON.stringify(saved));
  if(canonicalBeforeInit){load('intelligence-profile-runtime.js');w.LeadIntelIntelligenceProfileRuntime.apply();}
  w.eval(read('app.js').replace(/^import .*;\s*$/gm,'')+'\nwindow.__profileRuntimeTest={getState:()=>state,saveState,renderProfile,approveProfile};');
  return {w,dom,errors,load,init:()=>verifiedInit(),state:()=>w.__profileRuntimeTest.getState(),saved:()=>JSON.parse(w.localStorage.getItem(MAIN)),close:()=>dom.window.close()};
}

test('verified startup and repeated Profile navigation survive the canonical runtime removing legacy DOM',async()=>{
  for(const canonicalBeforeInit of [false,true]){
    const h=harness({canonicalBeforeInit});
    try{
      assert.doesNotThrow(h.init);
      if(!canonicalBeforeInit){assert.ok(h.w.document.getElementById('information-gaps'));h.load('intelligence-profile-runtime.js');}
      h.w.LeadIntelIntelligenceProfileRuntime.apply();
      assert.equal(h.w.document.getElementById('information-gaps'),null,'the shipping canonical runtime has retired this obsolete node');
      assert.ok(h.w.document.querySelector('.intel-profile-shell'));
      let opened=0;h.w.addEventListener('leadintel:module-opened',event=>{if(event.detail.step===3)opened++;});
      for(let i=0;i<3;i++){
        assert.doesNotThrow(()=>h.w.LeadIntelCustomerNavigation.setStep(2));
        assert.doesNotThrow(()=>h.w.LeadIntelCustomerNavigation.setStep(3));
      }
      assert.equal(opened,3,'navigation must finish and announce the mounted module');
      assert.ok(h.w.document.querySelector('#profile-editor .intel-quality'));
      assert.ok(h.w.document.querySelector('#evidence-digest .evidence-source-card'));
      assert.match(h.w.document.getElementById('source-summary').textContent,/First-party evidence 1/);
      assert.equal(h.saved().approved,true);
      assert.equal(h.w.document.getElementById('continue-market-strategy').disabled,false);
      assert.deepEqual(h.errors,[]);
    }finally{h.close();}
  }
});

test('canonical Profile edits survive navigation, app saves and a real normalization reload',()=>{
  const h=harness({canonicalBeforeInit:true});
  try{
    h.init();const runtime=h.w.LeadIntelIntelligenceProfileRuntime;
    runtime.enterEditMode();
    const input=h.w.document.querySelector('[data-profile-field="priorityOffers"]');
    input.value='Customer-approved rotating equipment maintenance';
    const editor=h.w.document.getElementById('profile-editor');
    h.w.LeadIntelCustomerNavigation.setStep(2);h.w.LeadIntelCustomerNavigation.setStep(3);
    assert.equal(h.w.document.querySelector('[data-profile-field="priorityOffers"]'),input,'navigation preserves the active canonical editor');
    assert.equal(input.value,'Customer-approved rotating equipment maintenance');
    assert.equal(runtime.saveCanonicalEdits(),true);
    assert.equal(h.state().answers.priority_offers,input.value,'the app adopts the editor write before its next save');
    h.w.LeadIntelCustomerNavigation.setStep(2);h.w.LeadIntelCustomerNavigation.setStep(3);
    const saved=h.saved();
    assert.equal(saved.profile.priorityOffers,input.value);
    assert.equal(saved.profile.canonical.fields.priorityOffers.value,input.value);
    assert.equal(saved.profile.canonical.fields.priorityOffers.status,'user_confirmed');
    assert.equal(saved.answers.priority_offers,input.value);
    assert.equal(saved.approved,false);
    assert.equal(saved.market.strategyApproved,false);
    const restored=h.w.LeadIntelProfile.normalizeSavedState(saved);
    assert.equal(restored.profile.priorityOffers,input.value);
    assert.equal(restored.answers.priority_offers,input.value);
    assert.equal(h.w.document.querySelector('#profile-editor .intel-profile-shell')?.parentNode,editor);
    assert.match(editor.textContent,/Customer-approved rotating equipment maintenance/);
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});

test('adopting a canonical edit preserves active research and unrelated unsaved app state',()=>{
  const h=harness();
  try{
    h.init();h.load('intelligence-profile-runtime.js');
    const state=h.state(),runtime=h.w.LeadIntelIntelligenceProfileRuntime;
    runtime.enterEditMode();
    h.w.document.querySelector('[data-profile-field="priorityOffers"]').value='Approved plant maintenance';
    // These changes are newer than the editor storage snapshot and must stay in
    // memory when its explicit save event is consumed.
    state.market.researchStatus='running';state.market.researchProgress={completed:7,total:11};
    state.market.researchResults=[{url:'https://research.example/new',title:'New evidence'}];
    state.answers.proof_points='New proof still in the active app state';
    state.workspaceGoals.other='Unrelated goal';state.profile.researchProfileLink={sourceCount:9};
    runtime.saveCanonicalEdits();
    const saved=h.saved();
    assert.equal(saved.profile.priorityOffers,'Approved plant maintenance');
    assert.equal(saved.market.researchStatus,'running');
    assert.deepEqual(saved.market.researchProgress,{completed:7,total:11});
    assert.equal(saved.market.researchResults[0].url,'https://research.example/new');
    assert.equal(saved.answers.proof_points,'New proof still in the active app state');
    assert.equal(saved.workspaceGoals.other,'Unrelated goal');
    assert.equal(saved.profile.researchProfileLink.sourceCount,9);
    const before=JSON.stringify(state);
    h.w.localStorage.setItem(MAIN,JSON.stringify({...saved,answers:{...saved.answers,proof_points:'Stale generic event'}}));
    h.w.dispatchEvent(new h.w.CustomEvent('leadintel:workspace-changed',{detail:{source:'research-progress'}}));
    assert.equal(JSON.stringify(state),before,'generic workspace events cannot replace active app state');
    h.w.localStorage.setItem(MAIN,JSON.stringify({...saved,website:'https://another-seller.example/'}));
    h.w.dispatchEvent(new h.w.CustomEvent('leadintel:workspace-changed',{detail:{source:'canonical-profile-edit'}}));
    assert.equal(JSON.stringify(state),before,'another company cannot replace the active Profile through an edit event');
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});

test('approval saves an active canonical edit through its owner before checking targeting',()=>{
  const h=harness({canonicalBeforeInit:true});
  try{
    h.init();const runtime=h.w.LeadIntelIntelligenceProfileRuntime;
    runtime.enterEditMode();
    const value='Approved service for production equipment';
    h.w.document.querySelector('[data-profile-field="priorityOffers"]').value=value;
    // Approval normally follows Save edits. This direct path is also used by
    // approval actions while the canonical editor is still open.
    assert.equal(h.w.__profileRuntimeTest.approveProfile(),false);
    assert.equal(runtime.profileIsEditing(),false);
    assert.equal(h.saved().answers.priority_offers,value);
    assert.equal(h.state().profile.canonical.fields.priorityOffers.value,value);
    assert.equal(h.saved().targetingConfirmation,null,'changed targeting requires confirmation again');
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});

test('page-quality denied actions can focus Profile after canonical reconstruction',()=>{
  const h=harness({canonicalBeforeInit:true});
  try{
    h.init();h.load('page-quality.js');h.load('page-quality-ui.js');
    // Exercise the actual denied() -> focus() -> setStep(3) path, rather than
    // calling a fixture navigation implementation.
    const Q=h.w.LeadIntelPageQuality;
    Q.register('strategy',{read:()=>({loaded:true,checks:[Q.check('profile-review','Profile reviewed',false,'Review the profile first.',{actions:['approve'],target:{step:3,id:'edit-profile'}})]})});
    h.w.document.getElementById('activate-market-strategy').click();
    assert.equal(h.state().step,3);
    assert.equal(h.w.document.querySelector('.step-view.active').dataset.step,'3');
    assert.equal(h.w.document.activeElement.id,'edit-profile');
    assert.match(h.w.document.getElementById('toast').textContent,/Review the profile first/);
    assert.equal(h.w.document.getElementById('information-gaps'),null);
    assert.ok(h.w.document.querySelector('#profile-editor .intel-profile-shell'));
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});

test('canonical offer edits rebase current core ICPs while preserving custom strategy and live research',()=>{
 const h=harness({canonicalBeforeInit:true});try{
  h.init();const state=h.state();state.market.icps=[{id:'icp-core',type:'core',offers:'Old offer',buyerRoles:'Current buyer'},{id:'custom-1',type:'custom',offers:'Manual offer'}];
  state.market.researchStatus='running';state.market.researchResults=[{url:'https://research.example/new'}];
  const runtime=h.w.LeadIntelIntelligenceProfileRuntime;runtime.enterEditMode();const input=h.w.document.querySelector('[data-profile-field="priorityOffers"]');input.value='New reviewed maintenance offer';assert.equal(runtime.saveCanonicalEdits(),true);
  const saved=h.saved();assert.equal(saved.market.icps[0].offers,input.value);assert.equal(saved.market.icps[0].buyerRoles,'Current buyer');assert.equal(saved.market.icps[1].offers,'Manual offer');assert.equal(saved.market.researchStatus,'running');assert.equal(saved.market.researchResults[0].url,'https://research.example/new');
 }finally{h.close();}
});
