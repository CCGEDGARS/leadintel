const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('the plan estimate module loads before the modules that show paid-run estimates',()=>{
  const html=read('index.html');
  const at=name=>html.indexOf(`src="${name}?`);
  assert.ok(at('firecrawl-plan.js')>=0,'firecrawl-plan.js must be included');
  assert.ok(at('firecrawl-plan.js')<at('market-engine.js')&&at('firecrawl-plan.js')<at('app.js')&&at('firecrawl-plan.js')<at('discovery-ui.js'));
  for(const entry of ['app.js','discovery-ui.js'])assert.match(html,new RegExp(`src="${entry.replace('.','\\.')}\\?[^"]*plan-estimate=20261023-v1`));
  assert.match(html,/api-transport\.js\?[^"]*shared-gets=20261023-v1/);assert.match(html,/server-bridge\.js\?[^"]*parallel-workspaces=20261023-v1/);
});

test('market research preview and the Companies budget line show credits, and minutes on the known plan',()=>{
  const app=read('app.js'),ui=read('discovery-ui.js');
  assert.match(app,/planApi\.describe\(\{searches:queries\.length,resultsPerSearch:limits\.resultsPerQuery,pages:0\},planStatus\.plan,\{remainingCredits:planStatus\.remainingCredits\}\)/);
  assert.match(app,/\$\("research-preview-scope"\)\.textContent=`\$\{queries\.length\} planned search[^`]*\$\{runCost\?` · \$\{runCost\.text\}`:""\}/);
  assert.match(ui,/Research budget: up to \$\{estimate\.cap\} Firecrawl calls\$\{cost\?` \(\$\{cost\.text\}\)`:''\}, billed on your plan/);
  assert.match(ui,/planApi\.describe\(\{searches:estimate\.searches,resultsPerSearch:8,pages:estimate\.pages\},status\.plan,\{remainingCredits:status\.remainingCredits\}\)/);
  for(const source of [app,ui])assert.match(source,/globalThis\.LeadIntelAttention\?\.providerStatus\?\.\(\)/,'the plan comes from the cached services status, never from a new paid call');
});
