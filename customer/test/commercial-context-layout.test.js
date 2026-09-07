const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('commercial context layout defines two balanced paired rows',()=>{
  const layout=require('../commercial-context-layout.js');
  assert.deepEqual(layout.COMMERCIAL_CONTEXT_PAIRS,[
    ['marketFocus','customerPainPoints'],
    ['buyingTriggers','commercialObjective']
  ]);
});

test('commercial context defines compact, medium and deep card groups',()=>{
  const layout=require('../commercial-context-layout.js');
  assert.deepEqual(layout.CARD_GROUPS,{
    medium:['priorityOffers','idealCustomer'],
    compact:['lookalikeCustomers','decisionMakers','currentMarkets','targetMarkets'],
    deep:['marketFocus','customerPainPoints','buyingTriggers','commercialObjective']
  });
});

test('commercial context runtime removes full-width classes and moves paired fields together',()=>{
  const layout=require('../commercial-context-layout.js');
  const calls=[];
  const makeNode=key=>({
    key,
    classList:{remove:(...names)=>calls.push(['remove',key,...names]),add:(...names)=>calls.push(['add',key,...names])},
    after:node=>calls.push(['after',key,node.key])
  });
  const keys=['priorityOffers','idealCustomer','lookalikeCustomers','decisionMakers','currentMarkets','targetMarkets','marketFocus','customerPainPoints','buyingTriggers','commercialObjective'];
  const nodes=Object.fromEntries(keys.map(key=>[key,makeNode(key)]));
  const root={document:{querySelector:selector=>{
    const match=selector.match(/data-profile-field="([^"]+)"/);
    const node=match?nodes[match[1]]:null;
    return node?{closest:()=>node}:null;
  }}};

  assert.equal(layout.applyLayout(root),true);
  assert.deepEqual(calls.filter(row=>row[0]==='after'),[
    ['after','marketFocus','customerPainPoints'],
    ['after','buyingTriggers','commercialObjective']
  ]);
  for(const key of ['marketFocus','customerPainPoints','buyingTriggers','commercialObjective']){
    assert.ok(calls.some(row=>row[0]==='remove'&&row[1]===key&&row.includes('wide')&&row.includes('identity-wide')));
    assert.ok(calls.some(row=>row[0]==='add'&&row[1]===key&&row.includes('commercial-context-half')));
    assert.ok(calls.some(row=>row[0]==='add'&&row[1]===key&&row.includes('commercial-context-deep')));
  }
  for(const key of ['priorityOffers','idealCustomer'])assert.ok(calls.some(row=>row[0]==='add'&&row[1]===key&&row.includes('commercial-context-medium')));
  for(const key of ['lookalikeCustomers','decisionMakers','currentMarkets','targetMarkets'])assert.ok(calls.some(row=>row[0]==='add'&&row[1]===key&&row.includes('commercial-context-compact')));
});

test('commercial context view mode standardizes internal viewport and scrollbar treatment',()=>{
  const source=read('commercial-context-layout.js');
  assert.match(source,/resize:none/);
  assert.match(source,/overflow-y:auto/);
  assert.match(source,/scrollbar-width:thin/);
  assert.match(source,/commercial-context-medium/);
  assert.match(source,/commercial-context-compact/);
  assert.match(source,/commercial-context-deep/);
  assert.match(source,/textarea\[readonly\]/);
  assert.match(source,/pain-points-rendered/);
  assert.match(source,/min-height:0/);
});

test('commercial context layout is loaded by the customer shell',()=>{
  const evidenceView=read('evidence-view.js');
  assert.match(evidenceView,/commercial-context-layout\.js/);
});
