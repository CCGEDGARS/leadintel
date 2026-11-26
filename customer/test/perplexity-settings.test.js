const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

// Perplexity joins Settings → Data & intelligence integrations as a customer-owned research key (26 Nov 2026).
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Settings offers Perplexity as a customer-owned research key with its own card',()=>{
  const extension=read('service-settings-extension.js');
  assert.match(extension,/\{provider:'perplexity',name:'Perplexity',placeholder:'pplx-…',purpose:'[^']+'\}/);
  assert.match(extension,/if\(!card&&config\.provider==='perplexity'\)\{card=document\.createElement\('article'\)/);
  assert.match(extension,/<small>Web and people search with page text<\/small>/);
  assert.match(extension,/Perplexity searches the web and public professional profiles/);
  assert.match(extension,/Each user pays their provider directly\./);
});

test('Perplexity account links point only to Perplexity destinations',()=>{
  assert.match(read('tool-account-links.js'),/perplexity:\{name:'Perplexity',links:\[\['Get API key','https:\/\/console\.perplexity\.ai\/'\],\['Pricing','https:\/\/docs\.perplexity\.ai\/docs\/getting-started\/pricing'\]\]\}/);
});

test('every importer of the changed settings files asks browsers for the Perplexity version',()=>{
  // process-map.js only documents import signatures in a comment that release tests pin; shell-support-loader.js loads.
  for(const [file,target] of [['shell-support-loader.js','service-settings-extension.js'],['ai-settings.js','tool-account-links.js'],['index.html','shell-support-loader.js'],['index.html','ai-settings.js']]){
    const match=read(file).match(new RegExp(target.replace('.','\\.')+'\\?([^"\'\\s`]+)'));
    assert.ok(match,`${file} loads ${target}`);
    assert.equal(new URLSearchParams(match[1]).get('perplexity'),'20261126-v1',`${file} → ${target}`);
  }
});
