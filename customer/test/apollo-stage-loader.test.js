const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'content-variants.js'), 'utf8');

test('Apollo enrichment loads only when Company Discovery opens', async () => {
  const listeners = new Map();
  const appendedScripts = [];
  const eagerImports = [];
  const document = {
    querySelector(selector) {
      if (selector !== 'script[data-leadintel-apollo-enrichment]') return null;
      return appendedScripts.find((node) => node.dataset?.leadintelApolloEnrichment) || null;
    },
    createElement(tagName) {
      return { tagName: String(tagName).toUpperCase(), dataset: {} };
    },
    head: {
      appendChild(node) { appendedScripts.push(node); }
    }
  };
  const context = {
    document,
    addEventListener(type, listener) { listeners.set(type, listener); },
    console
  };
  context.globalThis = context;
  context.window = context;

  vm.runInNewContext(source, context, {
    filename: 'content-variants.js',
    importModuleDynamically(specifier) {
      eagerImports.push(specifier);
      return import('data:text/javascript,export default {}');
    }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(eagerImports.length, 0, 'Step 1 startup must not import Apollo enrichment');
  assert.equal(appendedScripts.length, 0, 'Step 1 startup must not append Apollo enrichment');

  listeners.get('leadintel:module-opened')?.({ detail: { step: 1 } });
  assert.equal(appendedScripts.length, 0, 'opening Step 1 must leave Apollo unloaded');

  listeners.get('leadintel:module-opened')?.({ detail: { step: 5 } });
  assert.equal(appendedScripts.length, 1, 'opening Discovery must load Apollo once');
  assert.equal(appendedScripts[0].type, 'module');
  assert.match(appendedScripts[0].src, /apollo-bulk-enrichment\.js\?v=20260921-contact-gated-v2/);

  listeners.get('leadintel:module-opened')?.({ detail: { step: 5 } });
  assert.equal(appendedScripts.length, 1, 'reopening Discovery must not duplicate Apollo');
});
