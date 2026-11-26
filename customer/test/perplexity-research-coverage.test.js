const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const D=require('../discovery-engine.js');

// Perplexity answers the shared public search first for a workspace with its own key (26 Nov 2026). A configured
// provider is never evidence that it ran, and a tool that ran must stay visible: Buyers research accountability,
// per-query receipts and the saved public-discovery status keep Perplexity like every other research tool.
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('Buyers research accountability records Perplexity searches and keeps them through save and reload',()=>{
  const report=D.createBuyerResearchAccountability();
  D.recordBuyerResearchTool(report,{provider:'perplexity',operation:'search',status:'succeeded',results:4});
  D.recordBuyerResearchTool(report,{provider:'perplexity',operation:'search',status:'failed',reason:'Perplexity search HTTP 503'});
  const row=report.tools.find(r=>r.provider==='perplexity');
  assert.ok(row,'Perplexity has its own accountability row');
  assert.deepEqual({attempted:row.attempted,succeeded:row.succeeded,failed:row.failed,results:row.results},{attempted:2,succeeded:1,failed:1,results:4});
  const saved=D.safeBuyerResearchAccountability(JSON.parse(JSON.stringify(report)));
  assert.equal(saved.tools.find(r=>r.provider==='perplexity').results,4);
});

test('a saved public web discovery status keeps Perplexity as a named source',()=>{
  const state=D.normalizeDiscoveryState({selectedProspects:[{company:'Example',domain:'example.com',website:'https://example.com/',buyerSearchMode:'user_selected_target',buyerDiscovery:{providerStatus:{firecrawl:{status:'complete',results:3,sources:['perplexity','grounded']}}}}]});
  assert.equal(state.selectedProspects.length,1,'the selected company is kept');
  assert.deepEqual(state.selectedProspects[0].buyerDiscovery.providerStatus.firecrawl.sources,['perplexity','grounded']);
});

test('the accountability panel names Perplexity when it ran and is unchanged when it did not',()=>{
  const source=read('discovery-ui.js'),start=source.indexOf('function buyerResearchAccountabilityHtml(candidate){'),end=source.indexOf('\nfunction buyerProviderStatusHtml(',start);
  assert.ok(start>=0&&end>start,'the accountability panel renderer is found');
  const context={LeadIntelDiscovery:D,esc};
  vm.runInNewContext(source.slice(start,end)+';globalThis.render=buyerResearchAccountabilityHtml;',context);
  const ran=D.createBuyerResearchAccountability();
  D.recordBuyerResearchTool(ran,{provider:'perplexity',operation:'search',status:'succeeded',results:6});
  assert.match(context.render({publicResearch:{accountability:ran}}),/<li><strong>Perplexity<\/strong> · 1 attempted · 1 succeeded · 0 failed · 0 skipped · 6 results<\/li>/);
  const unused=context.render({publicResearch:{accountability:D.createBuyerResearchAccountability()}});
  assert.doesNotMatch(unused,/Perplexity|undefined/);
  assert.equal((unused.match(/<li>/g)||[]).length,8,'the eight existing tool lines stay as they were');
});

test('browsers fetch the changed research engine and Buyers page',()=>{
  const html=read('index.html');
  for(const target of ['discovery-engine.js','discovery-ui.js']){
    const match=html.match(new RegExp(target.replace('.','\\.')+'\\?([^"\'\\s`]+)'));
    assert.ok(match,`index.html loads ${target}`);
    assert.equal(new URLSearchParams(match[1].replace(/&amp;/g,'&')).get('perplexity-search'),'20261126-v1',target);
  }
});
