const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Portfolio=require('../reference-customer-portfolio.js');
const source=fs.readFileSync(require.resolve('../reference-customer-delete-ui.js'),'utf8');
const key='leadintel_customer_v2_state';
function runtime(){
  const reference={rows:[{id:'a',companyName:'Acme',website:'https://acme.example'}]};
  const state=Portfolio.saveCurrentList({referenceCustomers:reference},{name:'My references'});
  state.referenceCustomers.rows[0].notes='Unsaved edit';
  const id=state.referenceCustomerPortfolio.selectedListId;
  const storage=new Map([[key,JSON.stringify(state)]]),children=[],clicks=[];
  function node(){return {dataset:{},textContent:'',disabled:false,style:{},setAttribute(){},matches(){return false},remove(){const i=children.indexOf(this);if(i>=0)children.splice(i,1);}};}
  const button=node();button.dataset.deleteReferenceList=id;button.disabled=true;children.push(button);
  const buttons={appendChild(n){children.push(n)},querySelectorAll(){return [...children]}};
  const row={dataset:{referenceListRow:id},querySelector(s){if(s==='.reference-saved-buttons')return buttons;const k=s.includes('confirm-delete')?'confirmDeleteList':'deleteReferenceList';return children.find(n=>n.dataset[k]);}};
  const status=node();
  const modal={querySelector(){return null},querySelectorAll(s){return s==='[data-reference-list-row]'?[row]:[]}};
  const bridge={workspace:{id:'workspace-a'}};
  const scope={document:{readyState:'complete',documentElement:{},getElementById(id){return id==='reference-customer-modal'?modal:id==='reference-import-status'?status:null},createElement:node,addEventListener(type,fn){if(type==='click')clicks.push(fn)}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},LeadIntelReferenceCustomerPortfolio:Portfolio,LeadIntelServerBridge:bridge,CustomEvent:class{},dispatchEvent(){},addEventListener(){},setTimeout(){},queueMicrotask(){},MutationObserver:class{observe(){}},console};
  vm.createContext(scope);vm.runInContext(source,scope);
  function click(k){const target=children.find(n=>n.dataset[k]);assert.ok(target,`missing ${k}`);for(const fn of clicks)fn({target:{closest(s){return s.includes(k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()))?target:null}},preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});}
  return {scope,storage,id,children,click,status,bridge};
}
test('Delete stays usable with unsaved edits; confirmation warns, cancel preserves, confirmed deletion persists',async()=>{
  const r=runtime();
  assert.equal(r.children.find(n=>n.dataset.deleteReferenceList).disabled,false);
  const before=r.storage.get(key);
  r.click('deleteReferenceList');
  assert.match(r.children.find(n=>n.dataset.deleteWarning).textContent,/unsaved/i);
  r.click('cancelDeleteList');
  assert.equal(r.storage.get(key),before);
  r.click('deleteReferenceList');r.click('confirmDeleteList');
  await new Promise(resolve=>setImmediate(resolve));
  const saved=JSON.parse(r.storage.get(key));
  assert.equal(saved.referenceCustomerPortfolio.lists.length,0);
  assert.equal(saved.referenceCustomers.rows.length,0);
  assert.equal(Portfolio.migrateLegacy(saved).referenceCustomerPortfolio.lists.length,0);
});
test('a pending delete confirmation cannot delete a list in a different workspace',async()=>{
  const r=runtime();r.click('deleteReferenceList');
  r.bridge.workspace={id:'workspace-b'};
  const before=r.storage.get(key);r.click('confirmDeleteList');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.storage.get(key),before);
});
