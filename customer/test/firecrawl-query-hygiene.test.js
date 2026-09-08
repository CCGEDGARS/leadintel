import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(__dirname,'..','firecrawl-workspace-router.js'),'utf8');

function productionQueryHelpers(){
  const start=source.indexOf('function compactSearchQuery');
  const end=source.indexOf('function retryableStatus');
  assert.ok(start>=0&&end>start,'query hygiene helpers must exist in Firecrawl router');
  const helperSource=source.slice(start,end);
  return new Function('FIRECRAWL_SEARCH_QUERY_MAX_CHARS',`${helperSource}; return {compactSearchQuery,sanitizeSearchRequestOptions};`)(600);
}

test('Firecrawl router compacts overlong market search queries before backend validation',()=>{
  const {sanitizeSearchRequestOptions}=productionQueryHelpers();
  const raw='Latvija Korporatīvās pārdošanas apmācības, biznesa koučings un mentorings, pielāgota MI integrācija ' + 'papildu tirgus signāli un uzņēmumu izaugsme '.repeat(30);
  assert.ok(raw.length>600);

  const options={
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:raw,limit:4})
  };
  const sanitized=sanitizeSearchRequestOptions(options);
  const body=JSON.parse(sanitized.body);

  assert.ok(body.query.length>0);
  assert.ok(body.query.length<=600);
  assert.equal(/\s{2,}/.test(body.query),false);
  assert.equal(body.limit,4);
  assert.equal(sanitized.method,'POST');
});

test('Firecrawl router preserves short search queries unchanged',()=>{
  const {sanitizeSearchRequestOptions}=productionQueryHelpers();
  const options={method:'POST',body:JSON.stringify({query:'Latvian companies expanding offices',limit:4})};
  assert.equal(sanitizeSearchRequestOptions(options),options);
});
