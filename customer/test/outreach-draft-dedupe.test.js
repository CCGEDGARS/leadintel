const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../outreach-engine.js');

// Live 2026-10-22 (D1, read-only): the heaviest workspace stored its one active buyer email
// twice — once in outreach.items[] and once as a byte-identical outreach.buyerDrafts cache entry
// (451 942 B each). upsertItem() remembers the active item on every change; the cache only has
// to hold drafts of buyers that are NOT the active item of their company.
const KEY=O.buyerDraftKey('buyer.example','p1','email');
const history=[{key:'k'.repeat(20000),draft:{subject:'Earlier subject'}}];
function item(personId,body){return {domain:'buyer.example',selectedPersonId:personId,channel:'email',company:'Buyer',drafts:{emailBody:body},dossier:{company:'Buyer',domain:'buyer.example',people:[{id:'p1',name:'Sam'},{id:'p2',name:'Alex'}]},messageStudioDraft:{originalHistory:history}};}
const plain=value=>JSON.parse(JSON.stringify(value));
// Mirrors outreach-ui.js upsertItem() followed by saveOutreach().
function upsert(state,next){
  const previous=state.items.find(row=>row.domain===next.domain)||null;
  if(previous?.selectedPersonId)state=O.rememberBuyerDraft(state,previous);
  state=O.rememberBuyerDraft(state,next);
  const items=state.items.slice(),idx=items.findIndex(row=>row.domain===next.domain);
  if(idx>=0)items[idx]=next;else items.unshift(next);
  return O.normalizeOutreachState(plain({...state,items}));
}

test('the active buyer message is stored once and restores exactly as the cached copy did',()=>{
  const active=item('p1','Active email');
  const state=upsert({items:[]},active);
  assert.deepEqual(Object.keys(state.buyerDrafts),[],'an identical copy of the active item must not be cached');
  const cachedOnly=O.rememberBuyerDraft({items:[]},active);// previous behaviour: restore from the cache entry
  assert.deepEqual(plain(O.savedBuyerDraft(state,'buyer.example','p1','email')),plain(O.savedBuyerDraft(cachedOnly,'buyer.example','p1','email')));
  assert.equal(O.savedBuyerDraft(state,'buyer.example','p2','email'),null);
  assert.equal(O.savedBuyerDraft(state,'buyer.example','p1','linkedin'),null);
});

test('switching buyers caches only the inactive buyer and switching back restores it',()=>{
  let state=upsert({items:[]},item('p1','First buyer email'));
  state=upsert(state,item('p2','Second buyer email'));
  assert.deepEqual(Object.keys(state.buyerDrafts),[KEY]);
  assert.equal(O.savedBuyerDraft(state,'buyer.example','p1','email').drafts.emailBody,'First buyer email');
  assert.equal(O.savedBuyerDraft(state,'buyer.example','p2','email').drafts.emailBody,'Second buyer email');
  state=upsert(state,O.savedBuyerDraft(state,'buyer.example','p1','email'));
  assert.deepEqual(Object.keys(state.buyerDrafts),[O.buyerDraftKey('buyer.example','p2','email')]);
  assert.equal(O.savedBuyerDraft(state,'buyer.example','p1','email').drafts.emailBody,'First buyer email');
  assert.equal(O.savedBuyerDraft(state,'buyer.example','p2','email').drafts.emailBody,'Second buyer email');
});

test('stored workspaces with the duplicate shrink on the next save; a diverged cache entry is kept',()=>{
  const active=item('p1','Current text');
  const legacy=plain({items:[O.normalizeOutreachState({items:[active]}).items[0]],buyerDrafts:{[KEY]:O.normalizeOutreachState({items:[active]}).items[0]}});
  const normalized=O.normalizeOutreachState(plain(legacy));
  assert.deepEqual(Object.keys(normalized.buyerDrafts),[]);
  assert.ok(JSON.stringify(normalized).length<0.6*JSON.stringify(legacy).length,'the outreach section roughly halves');
  const diverged=O.normalizeOutreachState(plain({items:[active],buyerDrafts:{[KEY]:item('p1','Older text')}}));
  assert.deepEqual(Object.keys(diverged.buyerDrafts),[KEY],'a cache entry that differs from the active item is never dropped');
  assert.equal(O.savedBuyerDraft(diverged,'buyer.example','p1','email').drafts.emailBody,'Older text','the cache entry keeps precedence when it differs');
});

test('normalization stays idempotent',()=>{
  let state=upsert({items:[]},item('p1','First buyer email'));state=upsert(state,item('p2','Second buyer email'));
  const once=O.normalizeOutreachState(plain(state));
  assert.equal(JSON.stringify(O.normalizeOutreachState(plain(once))),JSON.stringify(once));
});
