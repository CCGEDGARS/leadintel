const test = require('node:test');
const assert = require('node:assert/strict');
const Discovery = require('../discovery-engine.js');

test('an interrupted persisted search becomes runnable after a page reload', () => {
  const emptyRun = Discovery.recoverInterruptedDiscoveryState({
    status: 'running',
    queries: [{ id: 'q-1', market: 'Latvia', query: 'office furniture Latvia', offer: 'office furniture' }],
    rawResults: [],
    candidates: [],
    pipeline: [],
    lastRunAt: '2026-09-14T10:00:00.000Z'
  });
  assert.equal(emptyRun.status, 'error');

  const partialRun = Discovery.recoverInterruptedDiscoveryState({
    status: 'running',
    queries: [{ id: 'q-1', market: 'Latvia', query: 'office furniture Latvia', offer: 'office furniture' }],
    rawResults: [{
      queryId: 'q-1', market: 'Latvia', query: 'office furniture Latvia',
      url: 'https://example.lv/news', domain: 'example.lv', company: 'Example',
      title: 'Office project', description: 'A commercial office project', text: 'Evidence', date: '2026-09-14'
    }],
    candidates: [],
    pipeline: [],
    lastRunAt: '2026-09-14T10:00:00.000Z'
  });
  assert.equal(partialRun.status, 'partial');
  assert.equal(partialRun.rawResults.length, 1);
  assert.equal(partialRun.rawResults[0].domain, 'example.lv');
});
