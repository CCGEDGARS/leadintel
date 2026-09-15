const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bridgeSource = fs.readFileSync(path.join(__dirname, '..', 'server-bridge.js'), 'utf8');
const resetSource = fs.readFileSync(path.join(__dirname, '..', 'workspace-reset-hygiene.js'), 'utf8');
const API = 'https://leadintel-api.edgars-7e7.workers.dev';
const WORKSPACE_ID = 'workspace-1';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadBridge(fetchImpl, initialStorage = {}) {
  const localStorage = storage(initialStorage);
  const sessionStorage = storage();
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
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(bridgeSource, sandbox, {filename: 'server-bridge.js'});
  const bridge = sandbox.LeadIntelServerBridge;
  bridge.session = {authenticated: true};
  bridge.workspace = {id: WORKSPACE_ID};
  return {bridge, localStorage, sandbox};
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
  let call;
  const expected = asset();
  const {bridge} = loadBridge(async (url, options) => {
    call = {url, options};
    return new Response(JSON.stringify({asset: expected}), {status: 201, headers: {'Content-Type': 'application/json'}});
  });
  const file = new Blob(['png-bytes'], {type: 'image/png'});

  const result = await bridge.uploadBrandAsset('logo', file, {altText: 'Company logo'});

  assert.deepEqual(result, expected);
  assert.equal(call.url, `${API}/api/customer/brand-assets?workspace_id=${WORKSPACE_ID}`);
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.credentials, 'include');
  assert.ok(call.options.body instanceof FormData);
  assert.equal(call.options.body.get('kind'), 'logo');
  assert.equal(call.options.body.get('alt_text'), 'Company logo');
  assert.equal(call.options.headers['Content-Type'], undefined);
});

test('importBrandAsset and deleteBrandAsset are workspace scoped and fail closed', async () => {
  const calls = [];
  const imported = asset('b'.repeat(43));
  const {bridge} = loadBridge(async (url, options) => {
    calls.push({url, options});
    if (url.includes('/import')) return new Response(JSON.stringify({asset: imported}), {status: 201});
    return new Response(JSON.stringify({ok: true, asset_id: imported.id}), {status: 200});
  });

  assert.deepEqual(await bridge.importBrandAsset('logo', 'https://www.example.com/logo.png', {altText: 'Logo'}), imported);
  assert.deepEqual(await bridge.deleteBrandAsset('logo', imported), {ok: true, status: 200, asset_id: imported.id});
  assert.equal(calls[0].url, `${API}/api/customer/brand-assets/import?workspace_id=${WORKSPACE_ID}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), {kind: 'logo', url: 'https://www.example.com/logo.png', alt_text: 'Logo'});
  assert.equal(calls[1].url, `${API}/api/customer/brand-assets/${imported.id}?workspace_id=${WORKSPACE_ID}`);
  assert.equal(calls[1].options.method, 'DELETE');

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
  assert.deepEqual(result, {attempted: 2, deleted: 1, failed: 1});
  assert.equal(events.at(-1).type, 'leadintel:brand-assets-reset-cleanup');
  assert.deepEqual(events.at(-1).detail, result);
  const pending = JSON.parse(localStorage.getItem(sandbox.LeadIntelWorkspaceResetHygiene.RESET_PENDING_KEY));
  assert.deepEqual(pending.assets, [{kind: 'banner', id: banner.id}]);
});
