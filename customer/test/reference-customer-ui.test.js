const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');

test('manager supports CSV XLSX PDF and manual reference customer inputs',()=>{
  assert.match(source,/\.csv/i);
  assert.match(source,/\.xlsx/i);
  assert.match(source,/\.pdf/i);
  assert.match(source,/Add manually/i);
  assert.match(source,/parseCsv/);
  assert.match(source,/sheet_to_json/);
  assert.match(source,/PDFJS_VERSION\s*=\s*['"]6\.2\.108['"]/);
});

test('reference customer upload uses an explicit button-driven file picker',()=>{
  assert.match(source,/id=["']reference-upload-button["']/,'upload must expose a real button instead of relying on label-to-hidden-input activation');
  assert.match(source,/reference-upload-button[^\n]*addEventListener|querySelector\(['"]#reference-upload-button['"]\)\?\.addEventListener/,'upload button must have an explicit click handler');
  assert.match(source,/reference-file-input[^\n]*\.click\(\)|fileInput\.click\(\)/,'upload button must explicitly open the hidden file input');
  assert.match(source,/event\.target\.value\s*=\s*['"]["']/,'file input must reset after handling so the same file can be selected again');
});

test('PDF-derived rows require explicit review before activation',()=>{
  assert.match(source,/needs_review/);
  assert.match(source,/>Confirm</i);
  assert.match(source,/Activate selected/i);
});

test('reference customer manager reuses Step 1 markets and has no country selector',()=>{
  assert.match(source,/targetMarkets/);
  assert.match(source,/Search market|Target market/i);
  assert.doesNotMatch(source,/country-selector|lookalike-country|target-country/i);
});

test('activation performs bounded analysis and stores compact DNA without scraped bodies',()=>{
  assert.match(source,/MAX_REFERENCE_ANALYSIS\s*=\s*24/);
  assert.match(source,/firecrawl-scrape/);
  assert.match(source,/buildReferenceDna/);
  assert.match(source,/referenceCustomers\.dna/);
  assert.doesNotMatch(source,/referenceCustomers\.(?:raw|scrapedSources|pageBodies)/);
});

test('reference manager persists locally through the shared nonblocking workspace writer',()=>{
  assert.match(source,/leadintel_customer_v2_state/);
  assert.match(source,/Ref\.persistReferenceWorkspaceState\(root,state/);
});
