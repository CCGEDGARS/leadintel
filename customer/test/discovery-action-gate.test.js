const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const source=fs.readFileSync(path.join(__dirname,"..","discovery-ui.js"),"utf8");

test("Apollo and CRM actions recheck candidate qualification",()=>{
  assert.match(source,/function candidateIsActionable\(/);
  assert.match(source,/async function findDecisionMakers\(index\).*?candidateIsActionable\(candidate\)/s);
  assert.match(source,/async function saveCandidate\(index,\{pipeline=false\}=\{\}\).*?candidateIsActionable\(candidate\)/s);
});

test("discovery labels results as qualified companies",()=>{
  assert.match(source,/qualified compan(?:y|ies)/i);
  assert.doesNotMatch(source,/company candidates ranked/);
});
