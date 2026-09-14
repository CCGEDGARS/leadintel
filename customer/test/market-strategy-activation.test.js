import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("market strategy activation has a visible handoff to Company Discovery", () => {
  assert.match(app, /function openDiscoveryAfterActivation\(\)/);
  assert.match(app, /setActivationFeedback\("Strategy activated · opening Company Discovery/);
  assert.match(app, /event\.target\?\.closest\?\.\("#activate-market-strategy"\)/);
  assert.match(app, /event\.stopImmediatePropagation\(\)/);
  assert.match(index, /id="strategy-activation-feedback"/);
  assert.match(index, /app\.js\?v=20260914-discovery-signal-seeding-v2/);
});
