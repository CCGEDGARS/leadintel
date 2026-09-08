import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../copilot.css',import.meta.url),'utf8');

test('copilot renders as a non-blocking right-side drawer with close and escape handling',()=>{
  assert.match(source,/leadintel-copilot-drawer/);
  assert.match(source,/role\s*=\s*['"]dialog['"]|setAttribute\(['"]role['"],['"]dialog['"]\)/);
  assert.match(source,/aria-modal[^\n]*false|aria-modal['"],['"]false['"]/);
  assert.match(source,/copilot-close/);
  assert.match(source,/Escape/);
  assert.match(css,/position\s*:\s*fixed/);
  assert.match(css,/right\s*:\s*0/);
  assert.doesNotMatch(css,/pointer-events\s*:\s*none[^}]*body|overflow\s*:\s*hidden[^}]*body/i);
});

test('model-controlled content is rendered as text and evidence links are hardened',()=>{
  assert.match(source,/textContent/);
  assert.doesNotMatch(source,/insertAdjacentHTML|\.innerHTML\s*=\s*[^'"`]/);
  assert.match(source,/^|\Whttps?:/m);
  assert.match(source,/noopener/);
  assert.match(source,/noreferrer/);
  assert.match(source,/_blank/);
});

test('chat uses safe screen context and contextual prompt suggestions',()=>{
  assert.match(source,/currentCopilotScreenContext/);
  assert.match(source,/contextualPromptSuggestions/);
  assert.match(source,/sendCopilotMessage/);
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('action proposals require explicit confirm or reject and use a fresh idempotency key',()=>{
  assert.match(source,/Confirm change/);
  assert.match(source,/Reject/);
  assert.match(source,/crypto\.randomUUID/);
  assert.match(source,/confirmCopilotAction/);
  assert.match(source,/rejectCopilotAction/);
  assert.doesNotMatch(source,/confirmCopilotAction\([^)]*\)\s*;?\s*$/m);
});

test('successful confirmed actions refresh authoritative workspace state and conflicts remain visible',()=>{
  assert.match(source,/leadintel:copilot-action-confirmed/);
  assert.match(source,/location\.reload|fetchWorkspaceState|saveNow/);
  assert.match(source,/409|conflict/i);
});

test('copilot CSS is responsive without taking over the main workspace',()=>{
  assert.match(css,/width\s*:\s*min\(/);
  assert.match(css,/@media\s*\(max-width/);
  assert.match(css,/z-index/);
});
