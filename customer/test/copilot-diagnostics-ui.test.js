import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');

test('support keeps workspace checks out of the conversation panel',()=>{
  assert.doesNotMatch(source,/Workspace checks|copilot-diagnostics|renderDiagnostics|unreadImportant/);
});

test('support clears proposals without displaying mutation controls',()=>{
 assert.match(source,/function renderProposals\(\)/);
 assert.doesNotMatch(source,/Confirm change|confirmCopilotAction|preview\?\.after/);
});

test('support preserves the freshness guard for workspace context',()=>{
  assert.match(source,/copilotWorkspaceSaveState/);
  assert.match(source,/Save your workspace, then reopen Ask LeadIntel to use the latest context/);
});
