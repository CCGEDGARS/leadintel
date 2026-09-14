import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = path.resolve(process.cwd(), 'customer/apollo-bulk-enrichment.js');
const PAUSED_STATUS = 'Automatic mode is paused. Enable it only after reviewing the daily credit cap.';

test('Apollo observer decoration does not mutate an unchanged toolbar', async (t) => {
  let observerCallback = null;
  let autoStatusWrites = 0;
  const storage = new Map();
  const autoStatus = {
    value: PAUSED_STATUS,
    get textContent() { return this.value; },
    set textContent(value) {
      autoStatusWrites += 1;
      this.value = String(value);
    }
  };
  const nodes = new Map([
    ['[data-apollo-selected-count]', { textContent: '0' }],
    ['[data-apollo-mode]', { value: 'one-by-one' }],
    ['[data-apollo-batch-controls]', { hidden: true }],
    ['[data-apollo-auto-controls]', { hidden: true }],
    ['[data-apollo-auto-enabled]', { checked: false }],
    ['[data-apollo-auto-limit]', { value: '10' }],
    ['[data-apollo-auto-status]', autoStatus]
  ]);
  const toolbar = {
    querySelector(selector) { return nodes.get(selector) || null; },
    querySelectorAll() { return []; }
  };
  const documentStub = {
    readyState: 'complete',
    body: {},
    head: { appendChild() {} },
    addEventListener() {},
    getElementById(id) {
      if (id === 'apollo-enrichment-style') return {};
      if (id === 'apollo-enrichment-toolbar') return toolbar;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const windowStub = {
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    confirm() { return true; }
  };
  class MutationObserverStub {
    constructor(callback) { observerCallback = callback; }
    observe() {}
  }

  globalThis.document = documentStub;
  globalThis.window = windowStub;
  globalThis.MutationObserver = MutationObserverStub;
  t.after(() => {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.MutationObserver;
  });

  await import(`${pathToFileURL(modulePath).href}?observer-stability=${Date.now()}`);
  assert.equal(autoStatusWrites, 0, 'initial decoration must not rewrite identical status text');

  observerCallback?.([]);
  assert.equal(autoStatusWrites, 0, 'an observer replay must leave identical toolbar text untouched');
});
