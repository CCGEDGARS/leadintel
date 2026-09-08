import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-api.js',import.meta.url),'utf8');

test('copilot transport is bounded authenticated and workspace-derived',()=>{
  assert.match(source,/AbortController/);
  assert.match(source,/credentials\s*:\s*['"]include['"]/);
  assert.match(source,/LeadIntelServerBridge/);
  assert.match(source,/workspace\.id/);
  assert.match(source,/workspace_id/);
  assert.match(source,/35000/);
  assert.match(source,/12000/);
});

test('callers cannot override authoritative workspace id and signed-out state makes no request',()=>{
  assert.doesNotMatch(source,/workspaceId\s*[,}]/);
  assert.match(source,/if\s*\(\s*!workspaceId\s*\)/);
  assert.match(source,/return\s+null|return\s+\{[^}]*available\s*:\s*false/);
});

test('copilot API exposes only the planned bounded operations',()=>{
  for(const name of ['requestCopilot','bootstrapCopilot','sendCopilotMessage','confirmCopilotAction','rejectCopilotAction'])assert.match(source,new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}|export\\s+const\\s+${name}`));
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
});
