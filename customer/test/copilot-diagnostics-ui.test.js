import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');

test('diagnostics expose Info Improve and Important without auto-opening the drawer',()=>{
  for(const label of ['Info','Improve','Important'])assert.match(source,new RegExp(label,'i'));
  assert.match(source,/unreadImportant|diagnostics/);
  assert.doesNotMatch(source,/unreadImportant[^\n]{0,120}openCopilot\s*\(/);
});

test('proposal preview visibly separates before and after state',()=>{
  assert.match(source,/Before/);
  assert.match(source,/After/);
  assert.match(source,/preview/);
});

test('important diagnostics can update the entry badge without forcing model work',()=>{
  assert.match(source,/data-copilot-badge|leadintel-copilot-entry/);
  assert.doesNotMatch(source,/diagnostics[^\n]{0,160}sendCopilotMessage\s*\(/);
});
