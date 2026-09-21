import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const discovery = fs.readFileSync(new URL("../discovery-ui.js", import.meta.url), "utf8");
const marketCss = fs.readFileSync(new URL("../market.css", import.meta.url), "utf8");

test("market strategy activation has a visible handoff to Company Discovery", () => {
  assert.match(app, /function openDiscoveryAfterActivation\(\)/);
  assert.match(app, /setActivationFeedback\("Strategy activated · opening Company Discovery/);
  assert.match(app, /\$\("activate-market-strategy"\)\.addEventListener\("click",event=>/);
  assert.match(app, /event\.stopImmediatePropagation\(\)/);
  assert.match(app, /void activateMarketStrategy\(\)/);
  assert.match(app, /void Promise\.resolve\(\)\.then\(\(\)=>window\.LeadIntelWorkspacePersistence/);
  assert.match(index, /id="strategy-activation-feedback"/);
  assert.match(index, /id="activate-market-strategy"[^>]*>Continue to Company Discovery →<\/button>/);
  assert.doesNotMatch(index, />Use this strategy<\/button>/);
  assert.doesNotMatch(discovery, /insertAdjacentHTML\("beforeend"[\s\S]*Continue to Discovery/);
  assert.match(discovery, /\$\("continue-to-discovery"\)\?\.remove\(\)/);
  assert.match(app, /button\.textContent="Preparing Company Discovery…"/);
  assert.match(app, /button\.textContent="Continue to Company Discovery →"/);
  assert.match(index, /app\.js\?v=20260921-two-stage-profile-action-v1/);
  assert.match(index, /market\.css\?v=20260920-compact-discovery-footer-v2/);
  assert.match(marketCss, /\.strategy-activation\{[\s\S]*place-items:center/);
  assert.match(marketCss, /\.strategy-activation \.stage-next-action\{[\s\S]*justify-self:center[\s\S]*justify-content:center[\s\S]*text-align:center/);
});
