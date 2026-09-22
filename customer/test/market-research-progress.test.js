import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const marketCss = fs.readFileSync(new URL("../market.css", import.meta.url), "utf8");
const journey = fs.readFileSync(new URL("../journey-progress.js", import.meta.url), "utf8");
const attention = fs.readFileSync(new URL("../attention-centre-model.js", import.meta.url), "utf8");

test("running market research renders a prominent phase-based progress card", () => {
  assert.match(index, /id="market-research-progress"/);
  assert.match(index, /id="market-research-progress-bar"/);
  assert.match(index, /id="market-research-progress-title"/);
  assert.match(index, /id="market-research-progress-phase"/);
  assert.match(index, /id="market-research-progress-meta"/);
  assert.match(app, /function researchProgressView\(\)/);
  assert.match(app, /Finding evidence/);
  assert.match(app, /Extracting information/);
  assert.match(app, /Verifying findings/);
  assert.match(app, /Building opportunities/);
  assert.match(app, /researchModeUi\(state\.market\.researchMode\)\.estimate/);
  assert.match(app, /usually 5–10 minutes/);
  assert.match(marketCss, /\.market-research-progress/);
  assert.match(marketCss, /\.market-research-progress-bar/);
});

test("every research mode rotates practical phase-specific research insights", () => {
  assert.match(app, /function quickResearchInsight\(view\)/);
  assert.doesNotMatch(app, /state\.market\.researchMode!==["']quick["']/);
  assert.match(app, /Market Research insight|\$\{mode\} insight/);
  assert.match(app, /Deep Analysis/);
  assert.match(app, /strongest buying points/i);
  assert.match(app, /market demand/i);
  assert.match(app, /potential resistance/i);
  assert.match(app, /buying triggers and motives/i);
  assert.match(app, /data-quick-research-insight/);
  assert.match(marketCss, /\.quick-research-insight/);
  assert.match(marketCss, /prefers-reduced-motion:\s*reduce/);
});

test("running research disables the final handoff and marks markets as in progress", () => {
  assert.match(app, /researchRunning\(\).*activate-market-strategy/s);
  assert.match(app, /Research in progress — please wait/);
  assert.match(app, /Research in progress/);
  assert.match(app, /Researching /);
  assert.match(app, /data-research-running/);
});

test("workspace attention exposes only the next actionable requirement", () => {
  assert.match(attention, /find\(step=>!step\.complete&&!step\.optional\)/);
  assert.doesNotMatch(attention, /filter\(step=>!step\.complete&&!step\.optional\)\.forEach/);
  assert.match(journey, /Market research in progress/);
  assert.match(journey, /Wait for market research to finish/);
});

test("market research health labels distinguish not run, running and completed states", () => {
  assert.match(journey, /Market research not run/);
  assert.match(journey, /Market research in progress/);
  assert.match(journey, /Market research completed/);
  assert.doesNotMatch(journey, /researchStatus==='running'\?'Market research in progress':'Market research completed'/);
});

test("production assets are cache-busted for the research progress release", () => {
  assert.match(index, /app\.js\?v=20260922-adaptive-evidence-v1/);
  assert.match(index, /market\.css\?v=20260921-research-progress-v1/);
  assert.match(index, /journey-progress\.js\?v=20260922-health-research-label-v1/);
  assert.match(index, /attention-centre-model\.js\?v=20260921-research-progress-v1/);
});
