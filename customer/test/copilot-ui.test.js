import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../copilot.css',import.meta.url),'utf8');
const loader=fs.readFileSync(new URL('../copilot-loader.js',import.meta.url),'utf8');

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

test('chat uses safe screen context without preset prompt chips',()=>{
  assert.match(source,/currentCopilotScreenContext/);
  assert.match(source,/sendCopilotMessage/);
  assert.doesNotMatch(source,/contextualPromptSuggestions|copilot-prompts|copilot-prompt/);
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('copilot introduces itself before workspace checks',()=>{
  assert.match(source,/Your AI commercial copilot\./);
  assert.match(source,/understands your LeadIntel workspace/i);
  assert.match(source,/nothing is changed without your confirmation/i);
  const introIndex=source.indexOf('copilot-intro');
  const diagnosticsIndex=source.indexOf('copilot-diagnostics');
  assert.ok(introIndex>=0&&diagnosticsIndex>=0&&introIndex<diagnosticsIndex,'intro must be created before diagnostics');
});

test('composer is a full-width vertical layout with send below the textarea',()=>{
  assert.match(css,/\.copilot-composer\{[^}]*grid-template-columns\s*:\s*1fr[^}]*\}/s);
  assert.match(css,/\.copilot-composer textarea\{[^}]*min-height\s*:\s*(1[12][0-9]|1[3-9][0-9]|[2-9][0-9]{2})px/s);
  assert.match(css,/\.copilot-send\{[^}]*justify-self\s*:\s*end/s);
});

test('sidebar entry is a premium branded copilot control',()=>{
  assert.match(loader,/AI Commercial Copilot/);
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*border-radius\s*:\s*(1[4-9]|[2-9][0-9])px/s);
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*background\s*:\s*(linear-gradient|radial-gradient)/s);
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*box-shadow/s);
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
