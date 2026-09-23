const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','reference-customer-library-ui.js'),'utf8');

function makeStep(){
  const classes=new Set();
  const attributes={};
  return {
    classList:{
      add(name){classes.add(name);},
      remove(name){classes.delete(name);},
      toggle(name,force){if(force)classes.add(name);else classes.delete(name);return classes.has(name);},
      contains(name){return classes.has(name);}
    },
    setAttribute(name,value){attributes[name]=value;},
    removeAttribute(name){delete attributes[name];},
    getAttribute(name){return attributes[name]??null;},
    textContent:''
  };
}

function setup(){
  const companies=['Epiroc','Sandvik','Komatsu Forest','Volvo Construction Equipment','Ivassons i Metsjö AB'];
  const reference={
    rows:companies.map((company,index)=>({id:`company-${index}`,companyName:company,website:`https://company-${index}.se`,domain:`company-${index}.se`,status:'ready'})),
    analyses:Object.fromEntries(companies.map((_,index)=>[`company-${index}`,{confidence:'high'}])),
    segments:[{id:'reference-group',name:'Reference customer group',count:5,confidence:'high'}],
    activeSegmentIds:[],
    publishedModel:null,
    draftDirty:false
  };
  const portfolio={
    selectedListId:'demo',
    lists:[{id:'demo',name:'Demo',markets:['Sweden'],purpose:'',active:false,reference}]
  };
  const workspace={referenceCustomers:reference,referenceCustomerPortfolio:portfolio,targetMarkets:['Sweden']};
  const store=new Map([['leadintel_customer_v2_state',JSON.stringify(workspace)]]);
  const localStorage={
    getItem(key){return store.get(key)||null;},
    setItem(key,value){store.set(key,String(value));}
  };
  const steps=[makeStep(),makeStep(),makeStep(),makeStep()];steps[0].classList.add('active');
  const status={textContent:'Reference Customers deleted from Saved Lists.'};
  const panel={innerHTML:''};
  const review={scrollCount:0,scrollIntoView(){this.scrollCount++;}};
  const modal={
    querySelector(selector){return selector==='[data-reference-library-summary]'?panel:null;},
    querySelectorAll(selector){return selector==='.reference-workflow span'?steps:[];}
  };
  const document={
    head:{appendChild(){}},
    body:{},
    addEventListener(){},
    getElementById(id){
      if(id==='reference-library-styles')return {};
      if(id==='reference-customer-modal')return modal;
      if(id==='reference-segment-review')return review;
      if(id==='reference-import-status')return status;
      return null;
    },
    querySelector(){return null;}
  };
  const context={
    document,
    localStorage,
    LeadIntelReferenceCustomers:{
      publishReferenceModel(value){return value;},
      markReferenceDraftChanged(value){return value;},
      normalizeReferenceState(value){return value;},
      persistReferenceWorkspaceState(_root,value){localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(value));return value;}
    },
    LeadIntelReferenceCustomerPortfolio:{
      migrateLegacy(value){return value;},
      normalizePortfolio(value){return value;},
      hasUnsavedCurrentListDraft(){return false;},
      selectListSafely(value,id){return {ok:true,state:{...value,referenceCustomerPortfolio:{...value.referenceCustomerPortfolio,selectedListId:id}}};}
    },
    LeadIntelReferenceCustomerUI:{render(){}},
    addEventListener(){},
    dispatchEvent(){},
    CustomEvent:function CustomEvent(){}
  };
  vm.runInNewContext(source,context,{filename:'reference-customer-library-ui.js'});
  return {library:context.LeadIntelReferenceCustomerLibraryUI,steps,status,review};
}

test('View Results visibly moves an analyzed saved list into Review',async()=>{
  const {library,steps,status,review}=setup();

  await library.viewResults('demo');

  assert.equal(steps[0].classList.contains('active'),false,'List should no longer appear as the current step');
  assert.equal(steps[2].classList.contains('active'),true,'Review should appear as the current step');
  assert.equal(steps[2].getAttribute('aria-current'),'step');
  assert.match(status.textContent,/Reviewing Demo/);
  assert.match(status.textContent,/5 analyzed/);
  assert.match(status.textContent,/1 segment/);
  assert.equal(review.scrollCount,1);
});
