const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function slice(start,end){const from=source.indexOf(start);assert.ok(from>=0,start);const to=source.indexOf(end,from);assert.ok(to>from,end);return source.slice(from,to);}
const saveDiscoverySource=slice('function saveDiscovery(','let clearCompanyResultsReturnFocus');

// Every page load re-hydrates the local pipeline from the CRM and calls saveDiscovery().
// Live on 2026-10-20 that rewrote an identical discovery section, raised
// leadintel:workspace-dirty, sent an identical PUT and bumped the server version on
// each load (83 → 90 across six loads), which made other tabs reload on their next
// save (409 → reconcile → location.reload()).
function harness(stored){
  const writes=[],events=[];let refreshed=0;
  const context={
    DISCOVERY_STORAGE_KEY:'leadintel_customer_v2_discovery',
    discovery:{selectedProspects:[{company:'Example',domain:'example.com'}],pipeline:[]},
    localStorage:{getItem:key=>key==='leadintel_customer_v2_discovery'?stored:null,setItem:(key,value)=>writes.push([key,value])},
    CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}},
  };
  context.window={dispatchEvent:event=>events.push(event.type),LeadIntelJourney:{refresh:()=>{refreshed++;}}};
  vm.createContext(context);vm.runInContext(saveDiscoverySource,context);
  return {context,writes,events,refreshed:()=>refreshed};
}

test('saveDiscovery writes and marks the workspace dirty when the discovery section changed',()=>{
  const h=harness(JSON.stringify({selectedProspects:[],pipeline:[]}));
  h.context.saveDiscovery();
  assert.equal(h.writes.length,1);
  assert.equal(h.writes[0][0],'leadintel_customer_v2_discovery');
  assert.equal(h.writes[0][1],JSON.stringify(h.context.discovery));
  assert.deepEqual(h.events,['leadintel:workspace-dirty']);
  assert.equal(h.refreshed(),1);
});

test('saveDiscovery neither writes nor marks the workspace dirty when the serialized discovery is unchanged',()=>{
  const h=harness(JSON.stringify({selectedProspects:[{company:'Example',domain:'example.com'}],pipeline:[]}));
  h.context.saveDiscovery();
  assert.equal(h.writes.length,0,'an identical section must not be rewritten (LZW re-encode on the main thread)');
  assert.deepEqual(h.events,[],'an identical section must not raise leadintel:workspace-dirty (identical PUT, version bump, cross-tab reload)');
  assert.equal(h.refreshed(),1,'journey refresh still runs so the UI reflects CRM hydration');
});

test('saveDiscovery still writes when nothing is stored yet',()=>{
  const h=harness(null);
  h.context.saveDiscovery();
  assert.equal(h.writes.length,1);
  assert.deepEqual(h.events,['leadintel:workspace-dirty']);
});
