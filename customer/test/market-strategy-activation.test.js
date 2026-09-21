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
  assert.match(index, /app\.js\?v=20260921-strategy-handoff-v2/);
  assert.match(marketCss, /\.strategy-handoff-dialog/);
});
