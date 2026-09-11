const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Enrichment=require('../reference-customer-website-enrichment.js');
const Detection=require('../reference-customer-table-detection.js');

test('company name is sufficient to keep a reference customer eligible for website enrichment',()=>{
  const row={id:'ref-1',companyName:'Example Company',website:'',domain:'',country:'Latvia',status:'unresolved'};
  assert.equal(Enrichment.needsWebsite(row),true);
});

test('name-only spreadsheets are valid reference-customer tables',()=>{
  const detected=Detection.detectCustomerTable([{name:'Companies',rows:[
    ['Customer list'],
    ['Company Name'],
    ['Alpha SIA'],
    ['Beta SIA'],
    ['Gamma SIA']
  ]}]);
  assert.equal(detected.sheetName,'Companies');
  assert.equal(detected.headerRowIndex,1);
  assert.equal(detected.rows.length,3);
  assert.equal(detected.rows[0]['Company Name'],'Alpha SIA');
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

test('website enrichment runtime adds the approved guidance and action to the existing modal',()=>{
  const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-website-enrichment.js'),'utf8');
  assert.match(runtime,/Company Name is required/i);
  assert.match(runtime,/Website is recommended/i);
  assert.match(runtime,/Find missing websites/i);
  assert.match(runtime,/reference-find-websites/);
});

test('process map loads the website enrichment runtime',()=>{
  const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  assert.match(processMap,/reference-customer-website-enrichment\.js\?v=/);
});


test('missing-info detection works in both directions',()=>{
  assert.equal(Enrichment.needsInfo({companyName:'Example',website:''}),true);
  assert.equal(Enrichment.needsInfo({companyName:'',website:'https://example.lv'}),true);
  assert.equal(Enrichment.needsInfo({companyName:'Example',website:'https://example.lv'}),false);
});

test('company identity can be extracted conservatively from website metadata',()=>{
  assert.equal(Enrichment.companyNameFromPayload({data:{metadata:{title:'Example SIA | Official website'}}}),'Example SIA');
  assert.equal(Enrichment.companyNameFromPayload({data:{metadata:{title:''}}}),'');
});

test('Find Missing Info is placed after Clear current draft',()=>{
  const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-website-enrichment.js'),'utf8');
  assert.match(runtime,/FIND_INFO_LABEL='Find Missing Info'/);
  assert.match(runtime,/reference-import-actions/);
  assert.match(runtime,/reference-clear-list/);
  assert.match(runtime,/insertAdjacentElement\('afterend',button\)/);
  assert.match(runtime,/Find Missing Info \(\$\{missingCount\}\)/);
});
