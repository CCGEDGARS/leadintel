import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-context.js',import.meta.url),'utf8');

test('screen context exposes only navigation metadata',()=>{
  assert.match(source,/export\s+function\s+currentCopilotScreenContext/);
  assert.match(source,/step/);assert.match(source,/label/);
  assert.match(source,/entity_type/);assert.match(source,/entity_id/);
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
  assert.doesNotMatch(source,/\.value\b|FormData|innerHTML|textContent\s*\.slice|querySelectorAll\([^)]*(?:input|textarea|select)/i);
});

test('contextual prompts are step-based and do not trigger model calls',()=>{
  assert.match(source,/export\s+function\s+contextualPromptSuggestions/);
  assert.doesNotMatch(source,/fetch\s*\(|sendCopilotMessage|requestCopilot/);
});
