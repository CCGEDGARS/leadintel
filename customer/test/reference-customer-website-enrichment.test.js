const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Enrichment=require('../reference-customer-website-enrichment.js');

test('company name is sufficient to keep a reference customer eligible for website enrichment',()=>{
  const row={id:'ref-1',companyName:'Example Company',website:'',domain:'',country:'Latvia',status:'unresolved'};
  assert.equal(Enrichment.needsWebsite(row),true);
});

test('official website selection prefers a matching company domain and rejects directories/social networks',()=>{
  const candidates=[
    {url:'https://www.linkedin.com/company/example-company',title:'Example Company | LinkedIn'},
    {url:'https://example.com/about',title:'Example Company — Official website',description:'Example Company in Latvia'},
    {url:'https://directory.test/example-company',title:'Example Company profile'}
  ];
  const result=Enrichment.selectOfficialWebsite({companyName:'Example Company',country:'Latvia'},candidates);
  assert.equal(result?.url,'https://example.com/');
  assert.equal(result?.confidence,'high');
});

test('ambiguous search results are not auto-accepted',()=>{
  const candidates=[
    {url:'https://unrelated-one.com',title:'Business directory'},
    {url:'https://unrelated-two.com',title:'Company listing'}
  ];
  assert.equal(Enrichment.selectOfficialWebsite({companyName:'Example Company'},candidates),null);
});

test('Reference Customer UI explains Company Name is required and Website can be found by LeadIntel',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');
  assert.match(ui,/Company Name is required/i);
  assert.match(ui,/Website is recommended/i);
  assert.match(ui,/Find missing websites/i);
});

test('process map loads the website enrichment runtime',()=>{
  const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  assert.match(processMap,/reference-customer-website-enrichment\.js\?v=/);
});
