import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync(new URL('../copilot-api.js',import.meta.url),'utf8');
const context=fs.readFileSync(new URL('../copilot-context.js',import.meta.url),'utf8');
const loader=fs.readFileSync(new URL('../copilot-loader.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');

test('browser copilot never serializes local workspace bundles or credential material into requests',()=>{
  assert.doesNotMatch(api,/localStorage|sessionStorage|leadintel_customer_v2_state|encrypted_api_key|refresh_token|APOLLO_API_KEY|FIRECRAWL_API_KEY/i);
  assert.doesNotMatch(context,/localStorage|sessionStorage|leadintel_customer_v2_state|api_key|token|secret/i);
  assert.match(api,/JSON\.stringify\(options\.body\)/);
});

test('browser supplies only bounded screen metadata rather than page or form contents',()=>{
  assert.match(context,/step/);assert.match(context,/label/);assert.match(context,/entity_type/);assert.match(context,/entity_id/);
  assert.doesNotMatch(context,/FormData|\.value\b|innerHTML|outerHTML|document\.body|querySelectorAll\([^)]*(?:input|textarea|select)/i);
});

test('copilot boot path has no body-wide observer or eager reasoning request',()=>{
  assert.doesNotMatch(loader,/MutationObserver|document\.body|sendCopilotMessage|bootstrapCopilot\s*\(/);
  assert.doesNotMatch(ui,/MutationObserver/);
});

test('model text is never treated as trusted HTML and unsafe protocols are rejected',()=>{
  assert.match(ui,/textContent/);
  assert.doesNotMatch(ui,/insertAdjacentHTML|DOMParser|createContextualFragment/);
  assert.match(ui,/\^https\?:\$/);
  assert.doesNotMatch(ui,/javascript:|data:text\/html/i);
});
