const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const index=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const processMap=fs.readFileSync(path.join(__dirname,"process-map.js"),"utf8");

assert.match(
  index,
  /process-map\.js\?v=20260917-shell-stability-v1/,
  "the HTML entry point must load the stable journey shell"
);
assert.match(
  index,
  /website-activation\.js\?v=20260916-ercon-context-v1/,
  "website activation must load directly without waiting on optional modules"
);

console.log("company isolation cache chain: PASS");
