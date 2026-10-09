import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');

test('diagnostics expose Info Improve and Important without auto-opening the drawer',()=>{
  for(const label of ['Info','Improve','Important'])assert.match(source,new RegExp(label,'i'));
  assert.match(source,/unreadImportant|diagnostics/);
  assert.doesNotMatch(source,/unreadImportant[^\n]{0,120}openCopilot\s*\(/);
});

test('support clears proposals without displaying mutation controls',()=>{
 assert.match(source,/function renderProposals\(\)/);
 assert.doesNotMatch(source,/Confirm change|confirmCopilotAction|preview\?\.after/);
});

test('important diagnostics can update the entry badge without forcing model work',()=>{
  assert.match(source,/data-copilot-badge|leadintel-copilot-entry/);
  assert.doesNotMatch(source,/diagnostics[^\n]{0,160}sendCopilotMessage\s*\(/);
});
