const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'market.css'),'utf8');
const discovery=fs.readFileSync(path.join(root,'discovery-ui.js'),'utf8');

test('market strategy exposes Quick Overview, Market Research and Deep Analysis with transparent limits',()=>{
  assert.match(html,/id="research-mode"/);
  assert.match(html,/value="quick"[\s\S]*Quick Overview/);
  assert.match(html,/value="deep"[\s\S]*Market Research/);
  assert.match(html,/value="intelligence"[\s\S]*Deep Analysis/);
  assert.match(html,/id="run-market-research"[^>]*>Review Quick Overview</);
  assert.match(html,/id="run-detailed-research"[^>]*>Review Market Research</);
  assert.match(html,/id="run-market-intelligence"[^>]*>Review Deep Analysis</);
  assert.match(html,/Usually 2–4 minutes/);
  assert.match(html,/Usually 5–10 minutes/);
  assert.match(html,/class="research-mode-hint"/);
  assert.match(html,/id="research-source-types"/);
  assert.match(html,/id="research-recommendations"/);
  assert.match(html,/id="research-instructions"/);
  assert.match(html,/id="research-custom-sources"/);
  assert.match(app,/RESEARCH_MODES\[state\.market\.researchMode\]/);
  assert.match(app,/buildResearchRecommendations/);
  assert.match(app,/researchCustomSources/);
  assert.match(app,/openResearchPreview\("quick"\)/);
  assert.match(app,/openResearchPreview\("deep"\)/);
  assert.match(app,/openResearchPreview\("intelligence"\)/);
  assert.match(app,/appendResearchHistory/);
});

test('research settings explain source choices and accept user guidance before a run',()=>{
  assert.match(html,/Why LeadIntel recommends these searches/);
  assert.match(html,/Specific public URLs/);
  assert.match(app,/function readResearchSettings/);
  assert.match(app,/researchInstructions/);
  assert.match(app,/searchCustomSource/);
  assert.match(html,/id="research-suggested-sources"/);
  assert.match(html,/id="add-suggested-sources"/);
  assert.match(app,/buildSuggestedSources/);
  assert.match(app,/addSuggestedSources/);
});

test('research mode buttons open a review step before any network research starts',()=>{
  for(const id of ['research-run-preview','research-preview-title','research-preview-scope','research-preview-sources','research-preview-queries','confirm-market-research','cancel-market-research','edit-research-settings'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/function openResearchPreview/);
  assert.match(app,/function closeResearchPreview/);
  assert.match(app,/openResearchPreview\("quick"\)/);
  assert.match(app,/openResearchPreview\("deep"\)/);
  assert.match(app,/openResearchPreview\("intelligence"\)/);
  assert.match(app,/runMarketResearch\(pendingResearchMode\)/);
  assert.doesNotMatch(app,/\$\("run-market-research"\)\.addEventListener\("click",\(\)=>runMarketResearch/);
});

test('failed research keeps actionable diagnostics and clearly labels retry actions',()=>{
  assert.match(html,/id="research-run-feedback"/);
  assert.match(app,/researchErrors/);
  assert.match(app,/Research run failed/);
  assert.match(app,/Retry Quick Overview/);
  assert.match(app,/Retry Market Research/);
  assert.match(app,/Retry Deep Analysis/);
  assert.match(app,/No public evidence was saved/);
});

test('research status copy does not repeat the word research',()=>{
  assert.doesNotMatch(app,/\$\{modeLabel(?:\.toLowerCase\(\))?\} research/);
  assert.match(app,/title:\`Researching \$\{market\}\`/);
  assert.match(app,/\$\{esc\(modeLabel\)\} complete/);
});

test('market research cannot remain indefinitely busy and exposes live progress',()=>{
  assert.match(app,/recoverInterruptedResearch/);
  assert.match(app,/withTimeout/);
  assert.match(app,/mapWithConcurrency/);
  assert.match(app,/researchProgress/);
  assert.match(app,/finally\s*\{/);
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
  assert.match(html,/id="strategy-activation-card"/);
  assert.doesNotMatch(html,/id="strategy-activation-card"[^>]*hidden/);
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

test('research settings stay collapsed until the user opens the disclosure',()=>{
  assert.match(html,/details class="progressive-disclosure research-settings" id="research-settings">/);
  assert.doesNotMatch(html,/details class="progressive-disclosure research-settings" id="research-settings" open/);
  assert.match(html,/summary aria-controls="research-settings-fields">Customize research settings/);
  assert.match(html,/class="research-brief" id="research-settings-fields"/);
});

test('Market Strategy explains its four-step page journey before research',()=>{
  for(const step of ['Choose research depth','Review findings','Activate strategy','Discover companies'])assert.match(html,new RegExp(step));
  assert.match(html,/id="strategy-flow"/);
  assert.match(html,/Step 1 · Choose research depth/);
  assert.match(html,/id="research-results-intro" hidden/);
  assert.match(app,/Next step/);
});
