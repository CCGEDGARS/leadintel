const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const index=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
const processMap=fs.readFileSync(path.join(__dirname,"process-map.js"),"utf8");

assert.match(
  index,
  /process-map\.js\?v=20260911-company-context-isolation-v1/,
  "the HTML entry point must refresh the parent module that imports website activation"
);
assert.match(
  processMap,
  /website-activation\.js\?v=20260911-company-context-isolation-v1/,
  "the refreshed parent module must import the company-isolation runtime"
);

console.log("company isolation cache chain: PASS");
