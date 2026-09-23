const test=require('node:test');
const assert=require('node:assert/strict');
const Ref=require('../reference-customers.js');

test('a pending server sync does not block the local save or interface refresh',()=>{
  assert.equal(typeof Ref.persistReferenceWorkspaceState,'function');
  const values=new Map();
  const events=[];
  let serverSaveCalls=0;
  let renderCalls=0;
  const neverSettles=new Promise(()=>{});
  const root={
    localStorage:{setItem(key,value){values.set(key,value);}},
    CustomEvent:class{constructor(type){this.type=type;}},
    dispatchEvent(event){events.push(event.type);},
    LeadIntelServerBridge:{saveNow(){serverSaveCalls++;return neverSettles;}},
    LeadIntelReferenceCustomerUI:{render(){renderCalls++;}}
  };
  const state={referenceCustomers:{rows:[{id:'r5',companyName:'Ivarssons i Metsjö AB'}]}};

  const saved=Ref.persistReferenceWorkspaceState(root,state);

  assert.equal(saved,state);
  assert.deepEqual(JSON.parse(values.get('leadintel_customer_v2_state')),state);
  assert.deepEqual(events,['leadintel:reference-customers-updated']);
  assert.equal(serverSaveCalls,1);
  assert.equal(renderCalls,1);
});
