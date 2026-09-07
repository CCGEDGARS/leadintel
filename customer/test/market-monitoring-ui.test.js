const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'market.css'),'utf8');
const discovery=fs.readFileSync(path.join(root,'discovery-ui.js'),'utf8');

test('market strategy exposes Quick and Deep research with transparent limits',()=>{
  assert.match(html,/id="research-mode"/);
  assert.match(html,/value="quick"[\s\S]*Quick Research/);
  assert.match(html,/value="deep"[\s\S]*Deep Research/);
  assert.match(html,/id="run-market-research"[^>]*>Run quick research</);
  assert.match(html,/id="run-detailed-research"[^>]*>Run detailed research</);
  assert.match(html,/class="research-mode-hint"/);
  assert.match(html,/id="research-source-types"/);
  assert.match(html,/id="research-recommendations"/);
  assert.match(html,/id="research-instructions"/);
  assert.match(html,/id="research-custom-sources"/);
  assert.match(app,/RESEARCH_MODES\[state\.market\.researchMode\]/);
  assert.match(app,/buildResearchRecommendations/);
  assert.match(app,/researchCustomSources/);
  assert.match(app,/runMarketResearch\("quick"\)/);
  assert.match(app,/runMarketResearch\("deep"\)/);
  assert.match(app,/appendResearchHistory/);
});

test('research settings explain source choices and accept user guidance before a run',()=>{
  assert.match(html,/Why LeadIntel recommends these searches/);
  assert.match(html,/Specific public URLs/);
  assert.match(app,/function readResearchSettings/);
  assert.match(app,/researchInstructions/);
  assert.match(app,/searchCustomSource/);
});

test('activation exposes automatic monitoring configuration and alerts',()=>{
  for(const id of ['monitoring-enabled','monitoring-frequency','monitoring-minimum-score','save-monitoring','run-monitoring-now','monitoring-alerts','monitoring-history'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/\/api\/market-monitoring\/config/);
  assert.match(app,/\/api\/market-monitoring\/alerts/);
  assert.match(app,/saveMonitoringConfig/);
  assert.match(app,/renderMonitoringAlerts/);
  assert.match(css,/\.monitoring-grid/);
});

test('monitoring source and signal controls are generated from active strategy',()=>{
  assert.match(app,/data-monitor-source/);
  assert.match(app,/data-monitor-signal/);
  assert.match(app,/state\.market\.signals\.filter/);
});

test('market strategy progressively reveals research results, activation and monitoring',()=>{
  assert.match(html,/id="research-settings"/);
  assert.match(html,/Customize research settings/);
  assert.match(html,/id="research-results-details"/);
  assert.match(html,/id="strategy-activation-card"[^>]*hidden/);
  assert.match(html,/id="monitoring-panel"[^>]*hidden/);
  assert.match(app,/getMarketJourneyState/);
  assert.match(app,/research-results-details/);
  assert.match(app,/view\.showActivation/);
  assert.match(app,/view\.showMonitoring/);
});

test('monitoring keeps advanced sources, signals and history behind disclosure',()=>{
  assert.match(html,/id="monitoring-advanced"/);
  assert.match(html,/Advanced monitoring settings/);
  assert.match(html,/id="monitoring-custom-sources"/);
  assert.match(html,/id="monitoring-alerts"/);
});

test('company discovery becomes the clear next action only after strategy activation',()=>{
  assert.match(discovery,/gate\.hidden=!formal/);
  assert.match(discovery,/Find matching companies/);
});
