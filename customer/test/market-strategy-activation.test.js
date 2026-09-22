import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const discovery = fs.readFileSync(new URL("../discovery-ui.js", import.meta.url), "utf8");
const marketCss = fs.readFileSync(new URL("../market.css", import.meta.url), "utf8");

test("Step 4 places optional monitoring before the final Company Discovery handoff", () => {
  const monitoring = index.indexOf('id="monitoring-panel"');
  const activation = index.indexOf('id="strategy-activation-card"');
  assert.ok(monitoring >= 0, "monitoring panel is present");
  assert.ok(activation > monitoring, "final handoff follows monitoring");
  assert.match(index, /Step 3 · Optional Continuous Monitoring/);
  assert.match(index, /id="activate-market-strategy"[^>]*>Review & Continue to Company Discovery →<\/button>/);
});

test("Company Discovery handoff has a review dialog with explicit blockers and warnings", () => {
  assert.match(index, /id="strategy-handoff-dialog"/);
  assert.match(index, /id="strategy-handoff-summary"/);
  assert.match(index, /id="strategy-handoff-blockers"/);
  assert.match(index, /id="strategy-handoff-warnings"/);
  assert.match(index, /id="cancel-strategy-handoff"/);
  assert.match(index, /id="confirm-strategy-handoff"/);
  assert.match(app, /function strategyHandoffModel\(\)/);
  assert.match(app, /function openStrategyHandoff\(\)/);
  assert.match(app, /Monitoring is off/);
  assert.match(app, /No active ICP/);
  assert.match(app, /No active buying signal/);
  assert.match(app, /No active market opportunity/);
  assert.match(app, /Market research has not completed/);
});

test("pre-flight explains weak signal coverage and provides direct repair actions", () => {
  assert.match(index, /id="strategy-handoff-repair-actions"/);
  assert.match(index, /id="review-buying-signals"/);
  assert.match(index, /id="retry-signal-recommendations"/);
  assert.match(app, /Only one active buying signal/);
  assert.match(app, /At least 3 active signals are recommended/);
  assert.match(app, /function reviewBuyingSignalsFromHandoff\(\)/);
  assert.match(app, /function retrySignalRecommendationsFromHandoff\(\)/);
});

test("pre-flight blocks zero signals but permits an explicit limited-results continuation", () => {
  assert.match(app, /No active buying signal[\s\S]{0,240}required/);
  assert.match(app, /Continue with limited results →/);
  assert.match(app, /Fewer than 3 evidence sources/);
});

test("recommended tender signals are not silently disabled by research-source settings", () => {
  assert.doesNotMatch(app, /!tendersAllowed[\s\S]{0,180}active:false/);
  assert.match(app, /LeadIntelMarket\.normalizeSignals\(generatedSignals,state\.market\.signals\)/);
});

test("activation waits for the canonical Discovery API and recovers visibly on timeout", () => {
  assert.match(app, /async function openDiscoveryAfterActivation\(\)/);
  assert.match(app, /await waitForDiscoveryOpen/);
  assert.match(app, /Company Discovery did not open\. Please try again\./);
  assert.match(app, /Try Company Discovery Again →/);
  assert.match(app, /await openDiscoveryAfterActivation\(\)/);
  assert.doesNotMatch(app, /\[100,300,700,1200\]/);
  assert.match(app, /\$\("confirm-strategy-handoff"\)\.addEventListener/);
  assert.doesNotMatch(app, /\$\("activate-market-strategy"\)\.addEventListener\("click",event=>[\s\S]{0,180}activateMarketStrategy/);
  assert.match(discovery, /window\.LeadIntelDiscoveryUI=\{open:openDiscoveryFromHandoff\}/);
  assert.match(index, /app\.js\?v=20260922-adaptive-evidence-v1&icp-data-gates=1/);
  assert.match(marketCss, /\.strategy-handoff-dialog/);
});


test("data-dependent ICP switches are disabled until their real prerequisites exist", () => {
  assert.match(app, /function icpActivationRequirement\(icp=\{\}\)/);
  assert.match(app, /profileOnly!==true/);
  assert.match(app, /Array\.isArray\(item\?\.evidence\)&&item\.evidence\.length>0/);
  assert.match(app, /referenceModelAvailable===true/);
  assert.match(app, /data-icp-field="active"[\s\S]{0,240}disabled/);
  assert.match(app, /function enforceIcpActivationRequirements\(\)/);
  assert.match(app, /Cannot activate yet/);
  assert.match(marketCss, /\.market-toggle input:disabled\+span/);
  assert.match(marketCss, /\.icp-requirement/);
});
