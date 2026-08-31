const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const processMapSource=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
const helperPath=path.join(__dirname,'..','website-input-sync.js');

test('process shell installs a restored/autofilled website state synchronizer',()=>{
  assert.match(processMapSource,/website-input-sync\.js/);
  assert.equal(fs.existsSync(helperPath),true);
});

test('visible browser-restored website takes precedence over stale saved state',()=>{
  assert.equal(fs.existsSync(helperPath),true);
  const helper=require(helperPath);
  assert.equal(helper.resolveWebsite('', 'www.ccgroup.lv'),'https://www.ccgroup.lv/');
  assert.equal(helper.resolveWebsite('https://old.example.com/','www.ccgroup.lv'),'https://www.ccgroup.lv/');
  assert.equal(helper.resolveWebsite('https://saved.example.com/',''),'https://saved.example.com/');
});

test('website synchronizer can update saved state from the visible input without deleting other state',()=>{
  assert.equal(fs.existsSync(helperPath),true);
  const helper=require(helperPath);
  const next=helper.mergeVisibleWebsite({targetMarkets:['Latvia'],answers:{priority_offers:'Training'}},'www.ccgroup.lv');
  assert.equal(next.website,'https://www.ccgroup.lv/');
  assert.deepEqual(next.targetMarkets,['Latvia']);
  assert.equal(next.answers.priority_offers,'Training');
});

test('browser-restored full URLs are converted to a protocol-free field value so the fixed https prefix can never duplicate',()=>{
  assert.equal(fs.existsSync(helperPath),true);
  const helper=require(helperPath);
  const source=fs.readFileSync(helperPath,'utf8');
  assert.equal(helper.toVisibleWebsite('https://www.ccgroup.lv/'),'www.ccgroup.lv');
  assert.equal(helper.toVisibleWebsite('http://example.com/path/'),'example.com/path');
  assert.match(source,/input\.value\s*=\s*display/);
});
