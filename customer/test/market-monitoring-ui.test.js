const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'market.css'),'utf8');

test('market strategy exposes Quick and Deep research with transparent limits',()=>{
  assert.match(html,/id="research-mode"/);
  assert.match(html,/value="quick"[\s\S]*Quick Research/);
  assert.match(html,/value="deep"[\s\S]*Deep Research/);
  assert.match(html,/id="research-source-types"/);
  assert.match(app,/RESEARCH_MODES\[state\.market\.researchMode\]/);
  assert.match(app,/appendResearchHistory/);
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
