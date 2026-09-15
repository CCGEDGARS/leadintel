const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const BrandIdentityUI = require('../brand-identity-ui.js');

const bridgeSource = fs.readFileSync(path.join(__dirname, '..', 'server-bridge.js'), 'utf8');
const resetSource = fs.readFileSync(path.join(__dirname, '..', 'workspace-reset-hygiene.js'), 'utf8');
const persistenceSource = fs.readFileSync(path.join(__dirname, '..', 'workspace-persistence.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const processMapSource = fs.readFileSync(path.join(__dirname, '..', 'process-map.js'), 'utf8');
const API = 'https://leadintel-api.edgars-7e7.workers.dev';
const WORKSPACE_ID = 'workspace-1';
const CACHE_VERSION = '20260916-brand-assets-v4';
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
    console: {warn() {}},
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

function loadProductionComposition(fetchImpl, initialStorage = {}, workspaceId = WORKSPACE_ID) {
  const loaded = loadBridge(fetchImpl, {
    leadintel_customer_v2_legacy_local_cleanup_20260901_v2: 'done',
    ...initialStorage
  }, workspaceId);
  vm.runInNewContext(resetSource, loaded.sandbox, {filename: 'workspace-reset-hygiene.js'});
  vm.runInNewContext(persistenceSource, loaded.sandbox, {filename: 'workspace-persistence.js'});
  return loaded;
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

function assertAssetValue(actual, expected) {
  const keys = ['altText', 'height', 'id', 'mimeType', 'updatedAt', 'url', 'width'];
  assert.deepEqual(Object.keys(actual).sort(), keys);
  for (const key of keys) assert.equal(actual[key], expected[key], `asset ${key}`);
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
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

  assertAssetValue(result, expected);
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

  assertAssetValue(await bridge.importBrandAsset('logo', 'https://www.example.com/logo.png', {altText: 'Logo'}), imported);
  const deletion = await bridge.deleteBrandAsset('logo', imported);
  assert.equal(deletion.ok, true);
  assert.equal(deletion.status, 200);
  assert.equal(deletion.asset_id, imported.id);
  assert.deepEqual(Object.keys(deletion).sort(), ['asset_id', 'ok', 'status']);
  assert.equal(calls[0].url, `${API}/api/customer/brand-assets/import?workspace_id=${WORKSPACE_ID}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), {kind: 'logo', url: 'https://www.example.com/logo.png', alt_text: 'Logo'});
  assert.equal(calls[1].url, `${API}/api/customer/state?workspace_id=${WORKSPACE_ID}`);
  assert.equal(calls[2].url, `${API}/api/customer/state?workspace_id=${WORKSPACE_ID}`);
  assert.equal(JSON.parse(calls[2].options.body).payload.main.brandIdentity.assets.logo, null);
  assert.equal(calls[3].url, `${API}/api/customer/brand-assets/${imported.id}?workspace_id=${WORKSPACE_ID}`);
  assert.equal(calls[3].options.method, 'DELETE');

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

  const rolledBack = JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity;
  assert.equal(rolledBack.status, 'draft');
  assert.equal(rolledBack.assets.logo.id, oldAsset.id);
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

  assertAssetValue(await bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'})), nextAsset);
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

test('post-commit cleanup queue storage failure returns the committed identity and emits an observable warning', async () => {
  const oldAsset = asset('v'.repeat(43));
  const nextAsset = asset('w'.repeat(43));
  const main = JSON.stringify({brandIdentity: {status: 'ready', senderName: 'Alex', assets: {logo: oldAsset}}});
  const {bridge, localStorage, sandbox, events} = loadBridge(async (url) => {
    if (url.includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (url.includes('/customer/state')) return new Response(JSON.stringify({version: 2}), {status: 200});
    if (url.includes(oldAsset.id)) return new Response(JSON.stringify({error: 'delete unavailable'}), {status: 503});
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: main});
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key, value) => {
    if (key === CLEANUP_KEY) throw new Error('Cleanup queue quota exceeded');
    return originalSetItem(key, value);
  };
  const warnings = [];
  sandbox.console.warn = (...values) => warnings.push(values.map(String).join(' '));

  const result = await bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'}), {returnTransaction: true});

  assert.equal(result.identity.assets.logo.id, nextAsset.id);
  assert.equal(result.cleanupQueued, false);
  assert.equal(result.cleanupWarning, true);
  assert.equal(JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity.assets.logo.id, nextAsset.id);
  const cleanupWarning = events.find(event => event.type === 'leadintel:brand-asset-cleanup-warning');
  assert.match(cleanupWarning.detail.message, /Cleanup queue quota exceeded/);
  const transaction = events.find(event => event.type === 'leadintel:brand-asset-transaction');
  assert.equal(transaction.detail.committed, true);
  assert.equal(transaction.detail.cleanupWarning, true);
  assert.equal(warnings.length, 1);
});

test('real UI and bridge chain has one persistence owner and adopts the committed Draft identity without another save', async () => {
  const nextAsset = asset('o'.repeat(43));
  const initialIdentity = {
    status: 'ready',
    revision: 3,
    companyDisplayName: 'Acme',
    senderName: 'Alex',
    senderTitle: 'Director',
    website: 'https://acme.example/',
    phone: '',
    linkedinUrl: '',
    primaryColor: '#0f6557',
    signatureText: 'Regards',
    legalFooter: '',
    postalAddress: '',
    options: {includeLogo: true, includeHeadshot: false, includeBanner: false},
    assets: {logo: null, headshot: null, banner: null},
    updatedAt: '2026-09-15T20:00:00.000Z'
  };
  const puts = [];
  const {bridge} = loadBridge(async (url, options) => {
    if (url.includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (url.includes('/customer/state')) {
      puts.push(JSON.parse(options.body));
      return new Response(JSON.stringify({version: 4}), {status: 200});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: JSON.stringify({brandIdentity: initialIdentity})});
  let uiPersistenceCalls = 0;
  let adoptedIdentity = null;
  const controller = BrandIdentityUI.createController({
    identity: initialIdentity,
    assetAdapter: BrandIdentityUI.createAssetAdapter({LeadIntelServerBridge: bridge}),
    onChange(identity, detail) {
      adoptedIdentity = identity;
      if (detail?.persist !== false) uiPersistenceCalls++;
    }
  });

  await controller.replaceAsset('logo', new Blob(['new'], {type: 'image/png'}));

  assert.equal(puts.length, 1);
  assert.equal(puts[0].payload.main.brandIdentity.status, 'draft');
  assert.equal(puts[0].payload.main.brandIdentity.assets.logo.id, nextAsset.id);
  assert.equal(controller.identity().assets.logo.id, nextAsset.id);
  assert.equal(adoptedIdentity.assets.logo.id, nextAsset.id);
  assert.equal(uiPersistenceCalls, 0);
});

test('upload commits only the asset mutation and preserves an unrelated user edit made while upload is in flight', async () => {
  const nextAsset = asset('x'.repeat(43));
  const initialIdentity = {
    status: 'ready', revision: 2, companyDisplayName: 'Acme', senderName: 'Before upload',
    senderTitle: '', website: 'https://acme.example/', phone: '', linkedinUrl: '', primaryColor: '#0f6557',
    signatureText: '', legalFooter: '', postalAddress: '',
    options: {includeLogo: true, includeHeadshot: false, includeBanner: false},
    assets: {logo: null, headshot: null, banner: null}, updatedAt: '2026-09-15T20:00:00.000Z'
  };
  const uploadStarted = deferred();
  const releaseUpload = deferred();
  const puts = [];
  const {bridge, localStorage} = loadBridge(async (url, options) => {
    if (url.includes('/brand-assets?')) {
      uploadStarted.resolve();
      await releaseUpload.promise;
      return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    }
    if (url.includes('/customer/state')) {
      puts.push(JSON.parse(options.body));
      return new Response(JSON.stringify({version: 3}), {status: 200});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: JSON.stringify({brandIdentity: initialIdentity})});
  const controller = BrandIdentityUI.createController({
    identity: initialIdentity,
    assetAdapter: BrandIdentityUI.createAssetAdapter({LeadIntelServerBridge: bridge}),
    onChange(identity, detail) {
      if (detail?.persist === false) return;
      const current = JSON.parse(localStorage.getItem('leadintel_customer_v2_state'));
      localStorage.setItem('leadintel_customer_v2_state', JSON.stringify({...current, brandIdentity: identity}));
    }
  });

  const replacing = controller.replaceAsset('logo', new Blob(['new'], {type: 'image/png'}));
  await uploadStarted.promise;
  controller.updateField('senderName', 'Edited during upload');
  releaseUpload.resolve();
  await replacing;

  assert.equal(puts.length, 1);
  assert.equal(puts[0].payload.main.brandIdentity.senderName, 'Edited during upload');
  assert.equal(puts[0].payload.main.brandIdentity.assets.logo.id, nextAsset.id);
  assert.equal(controller.identity().senderName, 'Edited during upload');
});

test('in-flight workspace save serializes before upload and removal state PUTs without overlap', async () => {
  const oldAsset = asset('y'.repeat(43));
  const nextAsset = asset('z'.repeat(43));
  const main = JSON.stringify({brandIdentity: {status: 'ready', senderName: 'Alex', assets: {logo: oldAsset}}});
  const firstPutStarted = deferred();
  const releaseFirstPut = deferred();
  const statePayloads = [];
  let activePuts = 0;
  let maximumActivePuts = 0;
  let stateCalls = 0;
  const {bridge, localStorage} = loadBridge(async (url, options) => {
    if (url.includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (url.includes('/customer/state')) {
      stateCalls++;
      activePuts++;
      maximumActivePuts = Math.max(maximumActivePuts, activePuts);
      statePayloads.push(JSON.parse(options.body));
      if (stateCalls === 1) {
        firstPutStarted.resolve();
        await releaseFirstPut.promise;
      }
      activePuts--;
      return new Response(JSON.stringify({version: stateCalls}), {status: 200});
    }
    if (url.includes('/brand-assets/')) return new Response(JSON.stringify({ok: true}), {status: 200});
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: main});

  const autosave = bridge.saveNow();
  await firstPutStarted.promise;
  const replacing = bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'}));
  const removing = bridge.deleteBrandAsset('logo', oldAsset);
  await new Promise(resolve => setImmediate(resolve));
  releaseFirstPut.resolve();
  await Promise.all([autosave, replacing, removing]);

  assert.equal(maximumActivePuts, 1);
  assert.equal(statePayloads.length, 3);
  assert.equal(statePayloads[0].payload.main.brandIdentity.assets.logo.id, oldAsset.id);
  assert.equal(statePayloads[1].payload.main.brandIdentity.assets.logo.id, nextAsset.id);
  assert.equal(statePayloads[2].payload.main.brandIdentity.assets.logo, null);
  assert.equal(JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity.assets.logo, null);
});

test('asset replacement crosses the production persistence boundary with exactly one backend state PUT', async () => {
  const nextAsset = asset('2'.repeat(43));
  const backendCalls = [];
  const {bridge} = loadProductionComposition(async (url, options = {}) => {
    backendCalls.push({url: String(url), options});
    if (String(url).includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (String(url).includes('/customer/state')) return new Response(JSON.stringify({version: 1, saved: true}), {status: 200});
    throw new Error(`Unexpected request: ${url}`);
  });

  await bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'}));

  const statePuts = backendCalls.filter(call => call.url.includes('/customer/state') && call.options.method === 'PUT');
  assert.equal(statePuts.length, 1);
  assert.equal(JSON.parse(statePuts[0].options.body).payload.main.brandIdentity.assets.logo.id, nextAsset.id);
});

test('HTTP 200 saved false rolls back the new asset without deleting the old managed object', async () => {
  const oldAsset = asset('3'.repeat(43));
  const nextAsset = asset('4'.repeat(43));
  const deletedIds = [];
  const main = JSON.stringify({brandIdentity: {status: 'ready', senderName: 'Alex', assets: {logo: oldAsset}}});
  const {bridge, localStorage, sandbox} = loadProductionComposition(async (url) => {
    const value = String(url);
    if (value.includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (value.includes('/customer/state')) return new Response(JSON.stringify({version: 1, saved: false}), {status: 200});
    if (value.includes('/brand-assets/')) {
      deletedIds.push(value.split('/brand-assets/')[1].split('?')[0]);
      return new Response(JSON.stringify({ok: true}), {status: 200});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: main});

  await assert.rejects(
    () => bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'})),
    /workspace save/i
  );

  assert.equal(JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity.assets.logo.id, oldAsset.id);
  assert.deepEqual(deletedIds, [nextAsset.id]);
  assert.equal(deletedIds.includes(oldAsset.id), false);
});

test('failed asset save restores only the matching asset field and preserves a concurrent identity edit', async () => {
  const oldAsset = asset('5'.repeat(43));
  const nextAsset = asset('6'.repeat(43));
  const putStarted = deferred();
  const releasePut = deferred();
  const main = JSON.stringify({brandIdentity: {status: 'ready', senderName: 'Before', legalFooter: 'Original', assets: {logo: oldAsset, banner: null}}});
  const {bridge, localStorage, sandbox} = loadProductionComposition(async (url) => {
    const value = String(url);
    if (value.includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (value.includes('/customer/state')) {
      putStarted.resolve();
      await releasePut.promise;
      return new Response(JSON.stringify({version: 1, saved: false}), {status: 200});
    }
    if (value.includes('/brand-assets/')) return new Response(JSON.stringify({ok: true}), {status: 200});
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: main});

  sandbox.sessionStorage.setItem(sandbox.LeadIntelWorkspacePersistence.SAVE_INTENT_KEY, '1');
  const replacing = bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'}));
  await putStarted.promise;
  const edited = JSON.parse(localStorage.getItem('leadintel_customer_v2_state'));
  edited.brandIdentity.senderName = 'Edited while saving';
  edited.brandIdentity.legalFooter = 'Concurrent footer';
  localStorage.setItem('leadintel_customer_v2_state', JSON.stringify(edited));
  releasePut.resolve();
  await assert.rejects(() => replacing, /workspace save/i);

  const rolledBack = JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity;
  assert.equal(rolledBack.assets.logo.id, oldAsset.id);
  assert.equal(rolledBack.senderName, 'Edited while saving');
  assert.equal(rolledBack.legalFooter, 'Concurrent footer');
});

test('production reset keeps asset cleanup pending until one reset PUT is followed by asset DELETE', async () => {
  const logo = asset('7'.repeat(43));
  const deleteStarted = deferred();
  const releaseDelete = deferred();
  const calls = [];
  const {bridge, localStorage, sandbox} = loadProductionComposition(async (url, options = {}) => {
    const value = String(url);
    calls.push({url: value, method: options.method || 'GET'});
    if (value.includes('/customer/state')) return new Response(JSON.stringify({version: 2, saved: true}), {status: 200});
    if (value.includes('/brand-assets/')) {
      deleteStarted.resolve();
      await releaseDelete.promise;
      return new Response(JSON.stringify({ok: true}), {status: 200});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, {
    leadintel_customer_v2_workspace: WORKSPACE_ID,
    leadintel_customer_v2_state: JSON.stringify({brandIdentity: {status: 'ready', assets: {logo}}})
  });
  const button = {dataset: {resetArmed: 'true'}};
  const event = {target: {closest(selector) { return selector === '#reset-workspace' ? button : null; }}};

  sandbox.LeadIntelWorkspaceResetHygiene.handleResetClick(event);
  sandbox.LeadIntelWorkspacePersistence.handleResetClick(event);
  const serverResetKey = sandbox.LeadIntelWorkspacePersistence.RESET_PENDING_KEY;
  const assetCleanupKey = sandbox.LeadIntelWorkspaceResetHygiene.ASSET_RESET_CLEANUP_KEY;
  assert.notEqual(assetCleanupKey, serverResetKey);
  assert.notEqual(localStorage.getItem(serverResetKey), null);
  assert.notEqual(localStorage.getItem(assetCleanupKey), null);

  await bridge.saveNow();
  await deleteStarted.promise;
  assert.equal(calls.filter(call => call.url.includes('/customer/state') && call.method === 'PUT').length, 1);
  assert.equal(calls.filter(call => call.url.includes('/brand-assets/') && call.method === 'DELETE').length, 1);
  assert.equal(localStorage.getItem(serverResetKey), null);
  assert.notEqual(localStorage.getItem(assetCleanupKey), null);

  const cleanup = sandbox.LeadIntelWorkspaceResetHygiene.afterWorkspaceSaved(WORKSPACE_ID);
  releaseDelete.resolve();
  const result = await cleanup;
  assert.equal(result.deleted, 1);
  assert.equal(localStorage.getItem(assetCleanupKey), null);
});

test('workspace transaction queue prevents a failed stale replacement from restoring or deleting a later success', async () => {
  const oldAsset = asset('p'.repeat(43));
  const firstAsset = asset('q'.repeat(43));
  const secondAsset = asset('r'.repeat(43));
  const main = JSON.stringify({brandIdentity: {status: 'ready', assets: {logo: oldAsset}}});
  const firstSaveStarted = deferred();
  const releaseFirstSave = deferred();
  const deleted = [];
  let uploadCalls = 0;
  let stateCalls = 0;
  const {bridge, localStorage} = loadBridge(async (url) => {
    if (url.includes('/brand-assets?')) {
      uploadCalls++;
      return new Response(JSON.stringify({asset: uploadCalls === 1 ? firstAsset : secondAsset}), {status: 201});
    }
    if (url.includes('/customer/state')) {
      stateCalls++;
      if (stateCalls === 1) {
        firstSaveStarted.resolve();
        await releaseFirstSave.promise;
        return new Response(JSON.stringify({error: 'temporary save failure'}), {status: 503});
      }
      return new Response(JSON.stringify({version: 2}), {status: 200});
    }
    if (url.includes('/brand-assets/')) {
      deleted.push(url);
      return new Response(JSON.stringify({ok: true}), {status: 200});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: main});

  const first = bridge.uploadBrandAsset('logo', new Blob(['first'], {type: 'image/png'}));
  await firstSaveStarted.promise;
  const second = bridge.uploadBrandAsset('logo', new Blob(['second'], {type: 'image/png'}));
  releaseFirstSave.resolve();
  const results = await Promise.allSettled([first, second]);

  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity.assets.logo.id, secondAsset.id);
  assert.equal(deleted.filter(url => url.includes(firstAsset.id)).length, 1);
  assert.equal(deleted.filter(url => url.includes(oldAsset.id)).length, 1);
  assert.equal(deleted.some(url => url.includes(secondAsset.id)), false);
});

test('post-upload local write failure restores prior metadata and cleans up the new object', async () => {
  const oldAsset = asset('s'.repeat(43));
  const nextAsset = asset('t'.repeat(43));
  const main = JSON.stringify({brandIdentity: {status: 'ready', assets: {logo: oldAsset}}});
  const deleted = [];
  const {bridge, localStorage} = loadBridge(async (url) => {
    if (url.includes('/brand-assets?')) return new Response(JSON.stringify({asset: nextAsset}), {status: 201});
    if (url.includes('/brand-assets/')) {
      deleted.push(url);
      return new Response(JSON.stringify({ok: true}), {status: 200});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: main});
  const originalSetItem = localStorage.setItem.bind(localStorage);
  let failNextMainWrite = true;
  localStorage.setItem = (key, value) => {
    if (key === 'leadintel_customer_v2_state' && failNextMainWrite) {
      failNextMainWrite = false;
      throw new Error('Quota exceeded');
    }
    return originalSetItem(key, value);
  };

  await assert.rejects(
    () => bridge.uploadBrandAsset('logo', new Blob(['new'], {type: 'image/png'})),
    /Quota exceeded/
  );

  assert.equal(localStorage.getItem('leadintel_customer_v2_state'), main);
  const preserved = JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity;
  assert.equal(preserved.status, 'ready');
  assert.equal(preserved.assets.logo.id, oldAsset.id);
  assert.equal(deleted.length, 1);
  assert.match(deleted[0], new RegExp(nextAsset.id));
});

test('failed asset removal restores only the asset while preserving concurrent fields and Draft status', async () => {
  const oldAsset = asset('u'.repeat(43));
  const main = JSON.stringify({brandIdentity: {status: 'ready', senderName: 'Before removal', legalFooter: 'Original footer', assets: {logo: oldAsset}}});
  const putStarted = deferred();
  const releasePut = deferred();
  const calls = [];
  const {bridge, localStorage} = loadBridge(async (url, options) => {
    calls.push({url, options});
    if (url.includes('/customer/state')) {
      putStarted.resolve();
      await releasePut.promise;
      return new Response(JSON.stringify({error: 'save unavailable'}), {status: 503});
    }
    if (url.includes('/brand-assets/')) return new Response(JSON.stringify({ok: true}), {status: 200});
    throw new Error(`Unexpected request: ${url}`);
  }, {leadintel_customer_v2_state: main});

  const removing = bridge.deleteBrandAsset('logo', oldAsset);
  await putStarted.promise;
  const concurrent = JSON.parse(localStorage.getItem('leadintel_customer_v2_state'));
  assert.equal(concurrent.brandIdentity.status, 'draft');
  assert.equal(concurrent.brandIdentity.assets.logo, null);
  concurrent.brandIdentity.senderName = 'Edited during removal';
  concurrent.brandIdentity.legalFooter = 'Newer footer';
  localStorage.setItem('leadintel_customer_v2_state', JSON.stringify(concurrent));
  releasePut.resolve();
  await assert.rejects(() => removing, /save unavailable/i);

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/customer\/state\?/);
  const persisted = JSON.parse(calls[0].options.body).payload.main.brandIdentity;
  assert.equal(persisted.status, 'draft');
  assert.equal(persisted.assets.logo, null);
  const rolledBack = JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).brandIdentity;
  assert.equal(rolledBack.status, 'draft');
  assert.equal(rolledBack.assets.logo.id, oldAsset.id);
  assert.equal(rolledBack.senderName, 'Edited during removal');
  assert.equal(rolledBack.legalFooter, 'Newer footer');
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
        banner: {...asset('n'.repeat(43)), altText: ' DATA : IMAGE / png ; base64,EEEE '}
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
  assert.equal(saved.assets.logo, null);
  assert.equal(saved.assets.headshot, null);
  assert.equal(saved.assets.banner.id, 'n'.repeat(43));
  assert.equal(saved.assets.banner.altText, '');
  for (const [key, value] of Object.entries(saved)) {
    if (key === 'signatureText' || typeof value !== 'string') continue;
    assert.doesNotMatch(value, /^data\s*:\s*image/i, key);
  }
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
  assert.match(processMapSource, new RegExp(`workspace-persistence\\.js\\?v=${CACHE_VERSION}`));
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
    console: {warn() {}},
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
  assert.equal(result.queued, 0);
  assert.equal(result.failed, 1);
  assert.deepEqual(Object.keys(result).sort(), ['attempted', 'deleted', 'failed', 'queued']);
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
  assert.equal(result.queued, 0);
  assert.equal(result.failed, 1);
  assert.equal(events.at(-1).type, 'leadintel:brand-assets-reset-cleanup');
  assert.equal(events.at(-1).detail.unavailable, true);
});

test('workspace reset reports queued cleanup separately from deleted and failed assets', async () => {
  const logo = asset('1'.repeat(43));
  const resetKey = 'leadintel_customer_v2_brand_asset_reset_cleanup_v1';
  const localStorage = storage({
    leadintel_customer_v2_workspace: WORKSPACE_ID,
    [resetKey]: JSON.stringify({workspace_id: WORKSPACE_ID, assets: [{kind: 'logo', id: logo.id}]})
  });
  const events = [];
  const sandbox = {
    console: {warn() {}}, URLSearchParams, localStorage, sessionStorage: storage(),
    location: {search: '', replace() {}, reload() {}}, document: {addEventListener() {}}, addEventListener() {},
    setTimeout() { return 1; }, dispatchEvent(event) { events.push(event); },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    LeadIntelServerBridge: {
      session: {authenticated: true}, workspace: {id: WORKSPACE_ID}, workspaces: [{id: WORKSPACE_ID}],
      async deleteBrandAsset() { return {ok: false, queued: true, asset_id: logo.id}; }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(resetSource, sandbox, {filename: 'workspace-reset-hygiene.js'});

  const result = await sandbox.LeadIntelWorkspaceResetHygiene.afterWorkspaceSaved(WORKSPACE_ID);

  assert.equal(result.attempted, 1);
  assert.equal(result.deleted, 0);
  assert.equal(result.queued, 1);
  assert.equal(result.failed, 0);
  assert.equal(localStorage.getItem(resetKey), null);
  assert.equal(events.at(-1).detail.queued, 1);
});
