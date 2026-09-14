const test=require("node:test");
const assert=require("node:assert/strict");
const discovery=require("../discovery-engine.js");

test("discovery excludes the customer website and tender portals when tenders are disabled",()=>{
  const results=discovery.mergeCompanyCandidates([
    {url:"https://ajprodukti.lv/levelpath",domain:"ajprodukti.lv",title:"Levelpath – AJ Produkti",description:"AJ Produkti office furniture",text:"AJ Produkti office furniture"},
    {url:"https://eis.gov.lv/EKEIS/Supplier/ViewProcurement",domain:"eis.gov.lv",title:"Public procurement tender",description:"Supplier procurement notice",text:"Tender procurement notice"},
    {url:"https://buyer.lv/news/new-factory",domain:"buyer.lv",title:"Buyer opens a new factory in Latvia",description:"Expansion announcement",text:"The company opens a new factory and expands capacity in Latvia."}
  ],{website:"https://www.ajprodukti.lv",targetMarkets:"Latvia",priorityOffers:"Office furniture",idealCustomer:"Companies and institutions",exclusions:"Tenders"},{researchSourceTypes:["news"],signals:[{id:"facility-expansion",name:"Facility expansion",active:true,weight:9,keywords:"new factory; expansion"}]});
  assert.deepEqual(results.map(item=>item.domain),["buyer.lv"]);
  assert.deepEqual(results[0].matchedSignals.map(item=>item.name),["Facility expansion"]);
  assert.equal(results[0].score.signal>0,true);
});

test("discovery query is buyer-oriented and omits tender terms when tenders are disabled",()=>{
  const queries=discovery.buildDiscoveryQueries({website:"https://www.ajprodukti.lv",targetMarkets:"Latvia",priorityOffers:"Office furniture",idealCustomer:"Companies and institutions",buyingTriggers:"New facilities and office expansion"},{researchSourceTypes:["news"],icps:[{active:true,description:"Companies opening or expanding facilities"}],signals:[{id:"tender",name:"Tender or procurement activity",active:true,weight:9,keywords:"tender; procurement"}]},1);
  assert.match(queries[0].query,/buyer|organization|customer/i);
  assert.doesNotMatch(queries[0].query,/manufacturer|tender|procurement|iepirk/i);
});

test("discovery requires at least one active buying signal",()=>{
  assert.equal(discovery.hasActiveSignals({signals:[]}),false);
  assert.equal(discovery.hasActiveSignals({signals:[{name:"Expansion",active:false}]}),false);
  assert.equal(discovery.hasActiveSignals({signals:[{name:"Expansion",active:true}]}),true);
});

test("discovery does not classify a company as qualified without signal evidence",()=>{
  const results=discovery.mergeCompanyCandidates([{url:"https://generic.lv",domain:"generic.lv",title:"Generic office furniture",text:"Office furniture company in Latvia"}],{website:"https://ajprodukti.lv",priorityOffers:"Office furniture",idealCustomer:"Companies"},{researchSourceTypes:["news"],signals:[{name:"Facility expansion",active:true,weight:9,keywords:"new factory; expansion"}]});
  assert.equal(results.length,1);
  assert.equal(results[0].matchedSignals.length,0);
  assert.equal(results[0].score.signal,0);
  assert.equal(results[0].confidence,"Low");
});
