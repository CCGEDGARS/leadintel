const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const budget=require('../state-budget.js');

const backend=fs.readFileSync(path.join(__dirname,'..','..','backend','src','customer-state.js'),'utf8');

test('customer sync budget is exactly 500 KB',()=>{
  assert.equal(budget.MAX_SYNC_BYTES,500*1024);
  assert.match(backend,/MAX_CUSTOMER_STATE_BYTES\s*=\s*500\*1024/);
  assert.match(backend,/500 KB limit/);
});

test('large research evidence is compacted below the 500 KB sync ceiling without losing core profile data',()=>{
  const huge='x'.repeat(40000);
  const input={
    main:{website:'https://example.com/',targetMarkets:['Sweden'],answers:{priority_offers:'Steel structures'},profile:{companyName:'Example'},scrapedSources:Array.from({length:12},(_,i)=>({url:`https://example.com/${i}`,text:huge,title:`Source ${i}`})),documents:Array.from({length:5},(_,i)=>({name:`doc-${i}.pdf`,text:huge}))},
    discovery:{},outreach:{},delivery:{},meta:{}
  };
  const result=budget.prepareForSync(input);
  assert.ok(result.bytes<=500*1024);
  assert.equal(result.payload.main.website,'https://example.com/');
  assert.equal(result.payload.main.answers.priority_offers,'Steel structures');
  assert.equal(result.payload.main.profile.companyName,'Example');
  assert.ok(result.payload.main.scrapedSources.every(row=>row.text.length<=8000));
  assert.ok(result.payload.main.documents.every(row=>row.text.length<=12000));
});

test('maximum reference-customer import plus compact DNA stays below the sync ceiling',()=>{
  const rows=Array.from({length:200},(_,i)=>({id:`ref-${i}`,companyName:`Reference Company ${i}`,website:`https://ref-${i}.example`,domain:`ref-${i}.example`,country:i%2?'Germany':'Poland',productService:'Industrial automation',approximateValue:'€25,000–€100,000',reason:'Strong commercial fit',notes:'Priority reference customer',status:'ready',active:i<50}));
  const dimensions=Array.from({length:7},(_,i)=>({key:`dimension-${i}`,values:['industrial manufacturing','100-500 employees','B2B'],weight:1,confidence:'high',evidenceCount:30}));
  const input={main:{website:'https://seller.example/',targetMarkets:['Germany','Poland'],answers:{priority_offers:'Industrial automation'},profile:{companyName:'Seller'},referenceCustomers:{version:1,rows,activeIds:rows.slice(0,50).map(r=>r.id),activated:true,fingerprint:'rc-test',dna:{version:1,active:true,activeCount:50,analyzableCount:45,confidence:'high',dimensions}}},discovery:{},outreach:{},delivery:{},meta:{}};
  const result=budget.prepareForSync(input);
  assert.ok(result.bytes<=500*1024,`reference state exceeded sync budget: ${result.bytes}`);
  assert.equal(result.payload.main.referenceCustomers.rows.length,200);
  assert.equal(result.payload.main.referenceCustomers.activeIds.length,50);
  assert.equal(result.payload.main.referenceCustomers.dna.dimensions.length,7);
});

test('non-research workspace overflow is rejected rather than silently deleting business data',()=>{
  const input={main:{website:'https://example.com/'},discovery:{criticalNotes:'x'.repeat(520*1024)},outreach:{},delivery:{},meta:{}};
  assert.throws(()=>budget.prepareForSync(input),/500 KB sync limit/);
});