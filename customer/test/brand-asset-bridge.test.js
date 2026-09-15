const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bridgeSource = fs.readFileSync(path.join(__dirname, '..', 'server-bridge.js'), 'utf8');
const resetSource = fs.readFileSync(path.join(__dirname, '..', 'workspace-reset-hygiene.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const processMapSource = fs.readFileSync(path.join(__dirname, '..', 'process-map.js'), 'utf8');
const API = 'https://leadintel-api.edgars-7e7.workers.dev';
const WORKSPACE_ID = 'workspace-1';
const CACHE_VERSION = '20260916-brand-assets-v1';
const CLEANUP_KEY = 'leadintel_customer_v2_brand_asset_cleanup_v1';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadBridge(fetchImpl, initialStorage = {}, workspaceId = WORKSPACE_ID) {
  const localStorage = storage(initialStorage);
  const sessionStorage = storage();
  const events = [];
  function Storage() {}
  Storage.prototype = localStorage;
  const document = {
    readyState: 'loading',
    addEventListener() {},
    querySelector() { return null; },
    getElementById() { return null; },
    head: {appendChild() {}}
  };
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    FormData,
    Blob,
    Response,
    Headers,
    Storage,
    localStorage,
    sessionStorage,
    document,
    location: {href: 'https://leadintel.ccgroup.lv/customer/', reload() {}},
    fetch: fetchImpl,
    setTimeout() { return 1; },
    clearTimeout() {},
    dispatchEvent(event) { events.push(event); },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(bridgeSource, sandbox, {filename: 'server-bridge.js'});
  const bridge = sandbox.LeadIntelServerBridge;
  bridge.session = {authenticated: true};
  bridge.workspace = {id: workspaceId};
  return {bridge, localStorage, sandbox, events};
}

function asset(id = 'a'.repeat(43)) {
  return {
    id,
    url: `${API}/api/customer/brand-assets/${id}`,
    mimeType: 'image/png',
    width: 200,
    height: 80,
    altText: 'Company logo',
    updatedAt: '2026-09-15T20:00:00.000Z'
  };
}

test('uploadBrandAsset sends authenticated multipart data scoped to the selected workspace', async () => {
  const calls = [];
  const expected = asset();
  const {bridge} = loadBridge(async (url, options) => {
    calls.push({url, options});
    if (url.includes('/brand-assets?')) return new Response(JSON.stringify({asset: expected}), {status: 201, headers: {'Content-Type': 'application/json'}});
    return new Response(JSON.stringify({version: 1}), {status: 200, headers: {'Content-Type': 'application/json'}});
  });
  const file = new Blob(['png-bytes'], {type: 'image/png'});

  const result = await bridge.uploadBrandAsset('logo', file, {altText: 'Company logo'});

  assert.deepEqual(result, expected);
  assert.equal(calls[0].url, `${API}/api/customer/brand-assets?workspace_id=${WORKSPACE_ID}`);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'include');
  assert.ok(calls[0].options.body instanceof FormData);
  assert.equal(calls[0].options.body.get('kind'), 'logo');
  assert.equal(calls[0].options.body.get('alt_text'), 'Company logo');
  assert.equal(calls[0].options.headers['Content-Type'], undefined);
  assert.equal(calls[1].url, `${API}/api/customer/state?workspace_id=${WORKSPACE_ID}`);
  assert.equal(JSON.parse(calls[1].options.body).payload.main.brandIdentity.assets.logo.id, expected.id);
});

test('importBrandAsset and deleteBrandAsset are workspace scoped and fail closed', async () => {
  const calls = [];
  const imported = asset('b'.repeat(43));
  const {bridge} = loadBridge(async (url, options) => {
    calls.push({url, options});
    if (url.includes('/import')) return new Response(JSON.stringify({asset: imported}), {status: 201});
    if (url.includes('/customer/state')) return new Response(JSON.stringify({version: 1}), {status: 200});
    return new Response(JSON.stringify({ok: true, asset_id: imported.id}), {status: 200});
  });

  assert.deepEqual(await bridge.importBrandAsset('logo', 'https://www.example.com/logo.png', {altText: 'Logo'}), imported);
  const deletion = await bridge.deleteBrandAsset('logo', imported);
  assert.equal(deletion.ok, true);
  assert.equal(deletion.status, 200);
  assert.equal(deletion.asset_id, imported.id);
  assert.deepEqual(Object.keys(deletion).sort(), ['asset_id', 'ok', 'status']);
  assert.equal(calls[0].url, `${API}/api/customer/brand-assets/import?workspace_id=${WORKSPACE_ID}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), {kind: 'logo', url: 'https://www.example.com/logo.png', alt_text: 'Logo'});
  assert.equal(calls[1].url, `${API}/api/customer/state?workspace_id=${WORKSPACE_ID}`);
  assert.equal(calls[2].url, `${API}/api/customer/brand-assets/${imported.id}?workspace_id=${WORKSPACE_ID}`);
  assert.equal(calls[2].options.method, 'DELETE');

  const {bridge: failing} = loadBridge(async () => new Response(JSON.stringify({error: 'Workspace access denied'}), {status: 403}));
  await assert.rejects(() => failing.deleteBrandAsset('logo', imported), /Workspace access denied/);
});

test('a failed replacement request cannot mutate the previously saved asset metadata', async () => {
  const oldAsset = asset('c'.repeat(43));
  const main = JSON.stringify({brandIdentity: {assets: {logo: oldAsset}}});
  const {bridge, localStorage} = loadBridge(
    async () => new Response(JSON.stringify({error: 'Upload unavailable'}), {status: 503}),
    {leadintel_customer_v2_state: main}
  );

  await assert.rejects(() => bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'})), /Upload unavailable/);

  assert.equal(localStorage.getItem('leadintel_customer_v2_state'), main);
});

test('failed identity persistence rolls back the new object and preserves old metadata', async () => {
  const oldAsset = asset('g'.repeat(43));
  const nextAsset = asset('h'.repeat(43));
  const main = JSON.stringify({brandIdentity: {status: 'ready', assets: {logo: oldAsset}}});
  const calls = [];
  const {bridge, localStorage, events} = loadBridge(async (url, options) => {
    calls.push({url, options});
    if (url.includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (url.includes('/customer/state')) return new Response(JSON.stringify({error: 'revision conflict'}), {status: 409});
    return new Response(JSON.stringify({ok: true, asset_id: nextAsset.id}), {status: 200});
  }, {leadintel_customer_v2_state: main});

  await assert.rejects(() => bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'})), /revision conflict|conflict/i);

  assert.equal(localStorage.getItem('leadintel_customer_v2_state'), main);
  assert.equal(calls.at(-1).url, `${API}/api/customer/brand-assets/${nextAsset.id}?workspace_id=${WORKSPACE_ID}`);
  assert.equal(localStorage.getItem(CLEANUP_KEY), null);
  const transaction = events.find(event => event.type === 'leadintel:brand-asset-transaction');
  assert.equal(transaction.detail.committed, false);
  assert.equal(transaction.detail.rollbackDeleted, true);
});

test('successful identity persistence retires the old object and queues observable retry on failure', async () => {
  const oldAsset = asset('i'.repeat(43));
  const nextAsset = asset('j'.repeat(43));
  const main = JSON.stringify({brandIdentity: {status: 'ready', assets: {logo: oldAsset}}});
  const calls = [];
  let oldDeleteAttempts = 0;
  const {bridge, localStorage, events} = loadBridge(async (url, options) => {
    calls.push({url, options});
    if (url.includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (url.includes('/customer/state')) return new Response(JSON.stringify({version: 2}), {status: 200});
    if (url.includes(oldAsset.id)) {
      oldDeleteAttempts++;
      if (oldDeleteAttempts === 1) return new Response(JSON.stringify({error: 'temporary delete failure'}), {status: 503});
      return new Response(JSON.stringify({ok: true, asset_id: oldAsset.id}), {status: 200});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: main});

  assert.deepEqual(await bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'})), nextAsset);
  assert.equal(JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity.assets.logo.id, nextAsset.id);
  let queue = JSON.parse(localStorage.getItem(CLEANUP_KEY));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, oldAsset.id);
  assert.equal(queue[0].reason, 'replacement');
  assert.equal(events.find(event => event.type === 'leadintel:brand-asset-transaction').detail.cleanupQueued, true);

  const retry = await bridge.flushBrandAssetCleanup();
  assert.equal(retry.deleted, 1);
  assert.equal(retry.failed, 0);
  assert.equal(localStorage.getItem(CLEANUP_KEY), null);
  assert.equal(events.at(-1).type, 'leadintel:brand-asset-cleanup');
});

test('mail senders map optional HTML and text bodies without changing legacy body', async () => {
  const calls = [];
  const {bridge} = loadBridge(async (url, options) => {
    calls.push({url, body: JSON.parse(options.body)});
    return new Response(JSON.stringify({sent: true}), {status: 200});
  });
  const base = {domain: 'example.com', recipient: 'buyer@example.com', subject: 'Hello', body: 'Legacy text', idempotencyKey: 'send-1'};

  await bridge.sendGmail({...base, textBody: 'Plain alternative', htmlBody: '<p>Branded</p>'});
  await bridge.sendMicrosoftMail({...base, idempotencyKey: 'send-2'});

  assert.equal(calls[0].body.body, 'Legacy text');
  assert.equal(calls[0].body.text_body, 'Plain alternative');
  assert.equal(calls[0].body.html_body, '<p>Branded</p>');
  assert.equal(calls[1].body.body, 'Legacy text');
  assert.equal('text_body' in calls[1].body, false);
  assert.equal('html_body' in calls[1].body, false);
});

test('workspace saves strip raw image bytes and data URLs from brand identity JSON', async () => {
  let requestBody;
  const unsafeMain = {
    brandIdentity: {
      companyDisplayName: 'Example',
      assets: {
        logo: {...asset('d'.repeat(43)), bytes: [137, 80, 78, 71], preview: 'data:image/png;base64,AAAA'},
        headshot: {url: 'data:image/jpeg;base64,BBBB', bytes: [1, 2, 3]}
      }
    }
  };
  const {bridge} = loadBridge(async (_url, options) => {
    requestBody = options.body;
    return new Response(JSON.stringify({version: 1}), {status: 200});
  }, {leadintel_customer_v2_state: JSON.stringify(unsafeMain)});

  await bridge.saveNow();

  assert.doesNotMatch(requestBody, /data:image\//);
  assert.doesNotMatch(requestBody, /\"bytes\"/);
  const saved = JSON.parse(requestBody).payload.main.brandIdentity;
  assert.equal(saved.assets.logo.id, 'd'.repeat(43));
  assert.equal(saved.assets.headshot, null);
});

test('workspace saves reject data-image values anywhere in malformed identity without rejecting normal prose', async () => {
  let requestBody;
  const unsafeMain = {
    brandIdentity: {
      companyDisplayName: '  DATA : IMAGE / png ; base64,AAAA',
      senderName: 'Normal sender',
      signatureText: 'We discuss data:image/png formats, not an embedded URL.',
      nested: {value: 'data:image/webp;base64,BBBB'},
      assets: {
        logo: 'data:image/png;base64,CCCC',
        headshot: {id: 'k'.repeat(43), url: ' data : image/jpeg;base64,DDDD ', bytes: [1]},
        banner: ['data:image/png;base64,EEEE']
      }
    }
  };
  const {bridge, sandbox} = loadBridge(async (_url, options) => {
    requestBody = options.body;
    return new Response(JSON.stringify({version: 1}), {status: 200});
  }, {leadintel_customer_v2_state: JSON.stringify(unsafeMain)});
  sandbox.LeadIntelBrandIdentity = require('../brand-identity.js');

  await bridge.saveNow();

  const saved = JSON.parse(requestBody).payload.main.brandIdentity;
  assert.equal(saved.companyDisplayName, '');
  assert.equal(saved.senderName, 'Normal sender');
  assert.equal(saved.signatureText, 'We discuss data:image/png formats, not an embedded URL.');
  assert.equal('nested' in saved, false);
  assert.deepEqual(saved.assets, {logo: null, headshot: null, banner: null});
  assert.doesNotMatch(JSON.stringify(saved), /^data\s*:\s*image/i);
});

test('all brand asset operations encode reserved workspace identifier characters', async () => {
  const workspaceId = 'workspace /?#&=✓';
  const encoded = encodeURIComponent(workspaceId);
  const created = asset('l'.repeat(43));
  const calls = [];
  const {bridge} = loadBridge(async (url) => {
    calls.push(url);
    if (url.includes('/brand-assets/import')) return new Response(JSON.stringify({asset: created}), {status: 201});
    if (url.includes('/brand-assets?')) return new Response(JSON.stringify({asset: created}), {status: 201});
    if (url.includes('/customer/state')) return new Response(JSON.stringify({version: calls.length}), {status: 200});
    return new Response(JSON.stringify({ok: true, asset_id: created.id}), {status: 200});
  }, {}, workspaceId);

  await bridge.uploadBrandAsset('logo', new Blob(['file'], {type: 'image/png'}));
  await bridge.importBrandAsset('logo', 'https://www.example.com/logo.png');
  await bridge.deleteBrandAsset('logo', created);

  const assetCalls = calls.filter(url => url.includes('/brand-assets'));
  assert.equal(assetCalls.length, 3);
  for (const url of assetCalls) assert.match(url, new RegExp(`workspace_id=${encoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
});

test('customer cache references use the Task 4 bridge and reset version everywhere', () => {
  assert.match(bridgeSource, new RegExp(`const ASSET_VERSION='${CACHE_VERSION}'`));
  assert.match(indexSource, new RegExp(`server-bridge\\.js\\?v=${CACHE_VERSION}`));
  assert.match(processMapSource, new RegExp(`server-bridge\\.js\\?v=${CACHE_VERSION}`));
  assert.match(processMapSource, new RegExp(`workspace-reset-hygiene\\.js\\?v=${CACHE_VERSION}`));
  assert.doesNotMatch(indexSource, /server-bridge\.js\?v=20260915-mail-choice-v2/);
  assert.doesNotMatch(processMapSource, /(?:server-bridge|workspace-reset-hygiene)\.js\?v=(?:20260915-mail-choice-v2|20260909-emergency-reset-v1)/);
});

test('workspace reset clears displayed identity and reports best-effort asset cleanup', async () => {
  const logo = asset('e'.repeat(43));
  const banner = asset('f'.repeat(43));
  const cleanupKey = 'leadintel_customer_v2_legacy_local_cleanup_20260901_v2';
  const mainKey = 'leadintel_customer_v2_state';
  const localStorage = storage({
    [cleanupKey]: 'done',
    leadintel_customer_v2_workspace: WORKSPACE_ID,
    [mainKey]: JSON.stringify({brandIdentity: {status: 'ready', assets: {logo, banner}}})
  });
  const listeners = {};
  const events = [];
  const deleted = [];
  const sandbox = {
    console,
    URLSearchParams,
    localStorage,
    sessionStorage: storage(),
    location: {search: '', replace() {}, reload() {}},
    document: {addEventListener(type, handler) { listeners[type] = handler; }},
    addEventListener() {},
    setTimeout(handler) { handler(); return 1; },
    dispatchEvent(event) { events.push(event); },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    LeadIntelServerBridge: {
      session: {authenticated: true},
      workspace: {id: WORKSPACE_ID},
      workspaces: [{id: WORKSPACE_ID}],
      conflict: false,
      async deleteBrandAsset(kind, value) {
        deleted.push([kind, value.id]);
        if (kind === 'banner') throw new Error('temporary delete failure');
        return {ok: true};
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(resetSource, sandbox, {filename: 'workspace-reset-hygiene.js'});
  const button = {dataset: {resetArmed: 'true'}};

  listeners.click({target: {closest(selector) { return selector === '#reset-workspace' ? button : null; }}});

  const localMain = JSON.parse(localStorage.getItem(mainKey));
  assert.equal('brandIdentity' in localMain, false);
  const result = await sandbox.LeadIntelWorkspaceResetHygiene.afterWorkspaceSaved(WORKSPACE_ID);
  assert.deepEqual(deleted, [['logo', logo.id], ['banner', banner.id]]);
  assert.equal(result.attempted, 2);
  assert.equal(result.deleted, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(Object.keys(result).sort(), ['attempted', 'deleted', 'failed']);
  assert.equal(events.at(-1).type, 'leadintel:brand-assets-reset-cleanup');
  assert.equal(events.at(-1).detail.attempted, result.attempted);
  assert.equal(events.at(-1).detail.deleted, result.deleted);
  assert.equal(events.at(-1).detail.failed, result.failed);
  const pending = JSON.parse(localStorage.getItem(sandbox.LeadIntelWorkspaceResetHygiene.RESET_PENDING_KEY));
  assert.deepEqual(pending.assets, [{kind: 'banner', id: banner.id}]);
});

test('workspace reset emits a cleanup result even when the delete bridge is unavailable', async () => {
  const logo = asset('m'.repeat(43));
  const cleanupKey = 'leadintel_customer_v2_legacy_local_cleanup_20260901_v2';
  const localStorage = storage({
    [cleanupKey]: 'done',
    leadintel_customer_v2_workspace: WORKSPACE_ID,
    leadintel_customer_v2_reset_pending_v1: JSON.stringify({workspace_id: WORKSPACE_ID, assets: [{kind: 'logo', id: logo.id}]})
  });
  const events = [];
  const sandbox = {
    console,
    URLSearchParams,
    localStorage,
    sessionStorage: storage(),
    location: {search: '', replace() {}, reload() {}},
    document: {addEventListener() {}},
    addEventListener() {},
    setTimeout() { return 1; },
    dispatchEvent(event) { events.push(event); },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    LeadIntelServerBridge: {session: {authenticated: true}, workspace: {id: WORKSPACE_ID}, workspaces: [{id: WORKSPACE_ID}]}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(resetSource, sandbox, {filename: 'workspace-reset-hygiene.js'});

  const result = await sandbox.LeadIntelWorkspaceResetHygiene.afterWorkspaceSaved(WORKSPACE_ID);

  assert.equal(result.attempted, 1);
  assert.equal(result.deleted, 0);
  assert.equal(result.failed, 1);
  assert.equal(events.at(-1).type, 'leadintel:brand-assets-reset-cleanup');
  assert.equal(events.at(-1).detail.unavailable, true);
});
