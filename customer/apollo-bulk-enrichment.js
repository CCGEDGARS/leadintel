const CREDIT_RATES = Object.freeze({ email: 1, phone: 9 });
const STORAGE_KEY = 'leadintel_apollo_enrichment_preferences_v1';
const DEFAULT_MODE = 'one-by-one';
const AUTO_LIMIT_MIN = 1;
const AUTO_LIMIT_MAX = 20;
const DEFAULT_AUTO_LIMIT = 10;
const MODES = Object.freeze(['one-by-one', 'batch', 'automatic']);
const selected = new Set();
let observer = null;
let decorating = false;
let bulkRunning = false;
let automaticRunning = false;
let bound = false;
let automaticTimer = null;

export function normalizeMode(value) {
  return MODES.includes(value) ? value : DEFAULT_MODE;
}

export function dailyKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function normalizeSettings(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const parsedLimit = Number.parseInt(source.dailyLimit, 10);
  const dailyLimit = Math.min(
    AUTO_LIMIT_MAX,
    Math.max(AUTO_LIMIT_MIN, Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_AUTO_LIMIT)
  );
  return {
    mode: normalizeMode(source.mode),
    automaticEnabled: source.automaticEnabled === true,
    dailyLimit,
    day: typeof source.day === 'string' ? source.day : '',
    processedKeys: Array.isArray(source.processedKeys)
      ? source.processedKeys.filter((key) => typeof key === 'string').slice(-200)
      : []
  };
}

function storage() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readSettings() {
  const store = storage();
  let raw = {};
  try {
    raw = store ? JSON.parse(store.getItem(STORAGE_KEY) || '{}') : {};
  } catch {
    raw = {};
  }
  const settings = normalizeSettings(raw);
  const today = dailyKey();
  if (settings.day !== today) {
    settings.day = today;
    settings.processedKeys = [];
    writeSettings(settings);
  }
  return settings;
}

export function writeSettings(settings) {
  const normalized = normalizeSettings(settings);
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Local persistence is a convenience; Apollo actions still remain guarded in memory.
  }
  return normalized;
}

export function estimateApolloCredits(count, type = 'email') {
  const safeCount = Math.max(0, Number.parseInt(count, 10) || 0);
  return safeCount * (CREDIT_RATES[type] || 0);
}

export function bulkConfirmationMessage(count, type = 'email') {
  const safeCount = Math.max(0, Number.parseInt(count, 10) || 0);
  const credits = estimateApolloCredits(safeCount, type);
  const action = type === 'phone' ? 'phone enrichment' : 'business-email verification';
  return safeCount + ' contacts selected. ' + action + ' may use up to ' + credits +
    ' Apollo credits. Only the selected contacts will be processed. Proceed?';
}

export function contactSelectionKey(companyIndex, personIndex, identity = '') {
  const safeIdentity = encodeURIComponent(String(identity || '').replace(/\s+/g, ' ').trim().toLowerCase()).slice(0, 120);
  return String(companyIndex) + ':' + String(personIndex) + ':' + safeIdentity;
}

export function isAutomaticEligible(row) {
  if (!row || typeof row.querySelector !== 'function') return false;
  const emailButton = row.querySelector('[data-action="enrich-contact"]');
  const linkedIn = row.querySelector('a.person-linkedin[href*="linkedin.com/in/"]');
  const name = row.querySelector('strong');
  const title = row.querySelector('span');
  if (!emailButton || emailButton.disabled || !linkedIn || !name || !title) return false;
  if (/verified|working|pending/i.test(emailButton.textContent || '')) return false;
  return true;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function rowIdentity(row) {
  return [row.querySelector('strong')?.textContent, row.querySelector('span')?.textContent, row.querySelector('small')?.textContent]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('|');
}

function keyForRow(row) {
  const source = row?.querySelector('[data-action="enrich-contact"],[data-action="find-phone"]');
  if (!source || source.dataset.companyIndex == null || source.dataset.personIndex == null) return '';
  return contactSelectionKey(source.dataset.companyIndex, source.dataset.personIndex, rowIdentity(row));
}

function currentMode() {
  return readSettings().mode;
}

function actionSelector(key, type = 'email') {
  const parts = String(key).split(':');
  const companyIndex = Number(parts.shift());
  const personIndex = Number(parts.shift());
  const action = type === 'phone' ? 'find-phone' : 'enrich-contact';
  return '[data-action="' + action + '"][data-company-index="' + companyIndex + '"][data-person-index="' + personIndex + '"]';
}

function confirmAction(message) {
  return typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(message) : true;
}

function style() {
  if (typeof document === 'undefined' || document.getElementById('apollo-enrichment-style')) return;
  const node = document.createElement('style');
  node.id = 'apollo-enrichment-style';
  node.textContent = [
    '.apollo-enrichment-toolbar{display:flex;flex-direction:column;gap:10px;margin:0 0 14px;padding:14px 16px;border:1px solid rgba(15,118,110,.22);border-radius:14px;background:rgba(15,118,110,.045)}',
    '.apollo-toolbar-main,.apollo-toolbar-actions,.apollo-auto-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.apollo-toolbar-main strong{font-size:14px;color:var(--ink,#10251f)}',
    '.apollo-toolbar-main small,.apollo-enrichment-toolbar small{color:var(--muted,#64748b);line-height:1.45}',
    '.apollo-mode-control{display:inline-flex;align-items:center;gap:7px;margin-left:auto;font-size:12px;font-weight:600;color:var(--muted,#64748b)}',
    '.apollo-mode-control select,.apollo-auto-controls select{min-height:34px;padding:6px 9px;border:1px solid rgba(15,118,110,.35);border-radius:8px;background:#fff;color:var(--ink,#10251f);font:inherit}',
    '.apollo-toolbar-status{font-size:12px;color:var(--muted,#64748b)}',
    '.apollo-select-wrap{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted,#64748b);margin-right:5px;white-space:nowrap}',
    '.apollo-select-wrap input{width:15px;height:15px;margin:0}',
    '.apollo-auto-controls{padding:9px 10px;border:1px solid rgba(148,163,184,.24);border-radius:10px;background:rgba(255,255,255,.65)}',
    '.apollo-auto-controls label{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink,#10251f)}',
    '.apollo-auto-controls input[type="checkbox"]{width:15px;height:15px}',
    '.apollo-batch-controls[hidden],.apollo-auto-controls[hidden],.apollo-select-wrap[hidden]{display:none!important}',
    '.apollo-cost-note{margin:8px 0 10px;padding:9px 11px;border:1px solid rgba(148,163,184,.24);border-radius:10px;background:rgba(148,163,184,.06);font-size:12px;line-height:1.45;color:var(--muted,#64748b)}'
  ].join('');
  document.head.appendChild(node);
}

function updateToolbar() {
  if (typeof document === 'undefined') return;
  const toolbar = document.getElementById('apollo-enrichment-toolbar');
  if (!toolbar) return;
  const settings = readSettings();
  const count = selected.size;
  const countNode = toolbar.querySelector('[data-apollo-selected-count]');
  if (countNode) countNode.textContent = String(count);
  const modeSelect = toolbar.querySelector('[data-apollo-mode]');
  if (modeSelect && modeSelect.value !== settings.mode) modeSelect.value = settings.mode;
  const batchControls = toolbar.querySelector('[data-apollo-batch-controls]');
  const autoControls = toolbar.querySelector('[data-apollo-auto-controls]');
  if (batchControls) batchControls.hidden = settings.mode !== 'batch';
  if (autoControls) autoControls.hidden = settings.mode !== 'automatic';
  const autoToggle = toolbar.querySelector('[data-apollo-auto-enabled]');
  if (autoToggle) autoToggle.checked = settings.automaticEnabled;
  const autoLimit = toolbar.querySelector('[data-apollo-auto-limit]');
  if (autoLimit) autoLimit.value = String(settings.dailyLimit);
  const autoStatus = toolbar.querySelector('[data-apollo-auto-status]');
  if (autoStatus) {
    autoStatus.textContent = settings.automaticEnabled
      ? 'Enabled: up to ' + settings.dailyLimit + ' qualified contacts per day while this workspace is open (' + settings.processedKeys.length + ' used today).'
      : 'Automatic mode is paused. Enable it only after reviewing the daily credit cap.';
  }
  toolbar.querySelectorAll('[data-apollo-bulk]').forEach((button) => {
    button.disabled = bulkRunning || count === 0;
  });
}

function applyMode() {
  if (typeof document === 'undefined') return;
  const settings = readSettings();
  document.querySelectorAll('[data-apollo-select]').forEach((input) => {
    input.closest('.apollo-select-wrap')?.toggleAttribute('hidden', settings.mode !== 'batch');
  });
  updateToolbar();
  if (settings.mode === 'automatic' && settings.automaticEnabled) scheduleAutomatic();
}

function ensureToolbar() {
  const target = document.getElementById('company-candidates');
  if (!target || document.getElementById('apollo-enrichment-toolbar')) return;
  target.insertAdjacentHTML('beforebegin', [
    '<div class="apollo-enrichment-toolbar" id="apollo-enrichment-toolbar">',
    '<div class="apollo-toolbar-main"><div><strong>Verify decision-makers with Apollo</strong><br><small>One-by-one is the default. Batch and Automatic are optional.</small></div>',
    '<label class="apollo-mode-control" for="apollo-enrichment-mode"><span>Mode</span><select id="apollo-enrichment-mode" data-apollo-mode aria-label="Apollo enrichment mode">',
    '<option value="one-by-one">One by one (default)</option><option value="batch">Batch</option><option value="automatic">Automatic (while open)</option>',
    '</select></label></div>',
    '<div class="apollo-toolbar-status">Email verification uses 1 Apollo credit per selected contact. Phone lookup can use up to 9 credits.</div>',
    '<div class="apollo-batch-controls" data-apollo-batch-controls hidden><div class="apollo-toolbar-actions"><strong><span data-apollo-selected-count>0</span> selected</strong>',
    '<button class="secondary-btn small" type="button" data-apollo-bulk="email">Verify selected emails</button>',
    '<button class="secondary-btn small" type="button" data-apollo-bulk="phone">Find selected phones</button></div>',
    '<small>Batch mode processes selected contacts sequentially after one credit estimate and confirmation.</small></div>',
    '<div class="apollo-auto-controls" data-apollo-auto-controls hidden><label><input type="checkbox" data-apollo-auto-enabled> Enable automatic email verification</label>',
    '<label for="apollo-auto-limit"><span>Daily limit</span><select id="apollo-auto-limit" data-apollo-auto-limit aria-label="Automatic Apollo daily contact limit"><option value="10">10 contacts</option><option value="20">20 contacts</option></select></label>',
    '<span data-apollo-auto-status>Automatic mode is paused. Enable it only after reviewing the daily credit cap.</span></div>',
    '<small>Automatic mode only considers contacts with a direct LinkedIn profile, a role, and an available Apollo email-verification action. It runs while this workspace is open and stops at the daily limit.</small>',
    '</div>'
  ].join(''));
  applyMode();
}

function decoratePersonRow(row) {
  const emailButton = row.querySelector('[data-action="enrich-contact"]');
  const phoneButton = row.querySelector('[data-action="find-phone"],[data-action="refresh-phone"]');
  const source = emailButton || phoneButton;
  if (!source) return;
  const companyIndex = source.dataset.companyIndex;
  const personIndex = source.dataset.personIndex;
  if (companyIndex == null || personIndex == null) return;
  const key = contactSelectionKey(companyIndex, personIndex, rowIdentity(row));
  const actions = row.querySelector('.person-actions');
  if (actions && !actions.querySelector('[data-apollo-select]')) {
    actions.insertAdjacentHTML('afterbegin',
      '<label class="apollo-select-wrap" title="Select this contact for an Apollo batch action"><input type="checkbox" data-apollo-select="' + esc(key) + '"> Select</label>');
  }
  const checkbox = actions?.querySelector('[data-apollo-select]');
  if (checkbox) {
    checkbox.dataset.apolloSelect = key;
    checkbox.checked = selected.has(key);
  }
  if (emailButton && !/Working|verified/i.test(emailButton.textContent || '')) {
    const label = emailButton.disabled ? 'Sign in to verify email' : 'Verify email with Apollo · 1 credit';
    if (emailButton.textContent !== label) emailButton.textContent = label;
  }
  if (phoneButton && phoneButton.dataset.action === 'find-phone' && !/verified/i.test(phoneButton.textContent || '')) {
    const label = phoneButton.disabled ? 'Sign in to find phone' : 'Find phone with Apollo · up to 9 credits';
    if (phoneButton.textContent !== label) phoneButton.textContent = label;
  }
}

function decorateDecisionSection(section) {
  if (!section.querySelector('.apollo-cost-note')) {
    const head = section.querySelector('.decision-head');
    head?.insertAdjacentHTML('afterend',
      '<div class="apollo-cost-note">Finding people does not reveal contact details. Verify email with Apollo · 1 credit per contact. Find phone with Apollo · up to 9 credits per contact.</div>');
  }
  section.querySelectorAll('.person-row').forEach(decoratePersonRow);
}

function pruneStaleSelections() {
  const live = new Set([...document.querySelectorAll('[data-apollo-select]')].map((input) => input.dataset.apolloSelect));
  for (const key of selected) if (!live.has(key)) selected.delete(key);
}

function decorate() {
  if (typeof document === 'undefined' || decorating) return;
  decorating = true;
  try {
    style();
    ensureToolbar();
    document.querySelectorAll('.decision-makers').forEach(decorateDecisionSection);
    pruneStaleSelections();
    applyMode();
  } finally {
    decorating = false;
  }
}

function setMode(mode) {
  const settings = readSettings();
  const nextMode = normalizeMode(mode);
  settings.mode = nextMode;
  if (nextMode !== 'automatic') settings.automaticEnabled = false;
  selected.clear();
  writeSettings(settings);
  applyMode();
  decorate();
}

async function waitForCompletion(key, type = 'email', timeoutMs = 30000) {
  const started = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 80));
  while (Date.now() - started < timeoutMs) {
    decorate();
    const button = document.querySelector(actionSelector(key, type));
    if (!button || !/Working|pending/i.test(button.textContent || '')) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function runBulk(type) {
  if (bulkRunning || selected.size === 0 || currentMode() !== 'batch') return;
  const keys = [...selected];
  if (!confirmAction(bulkConfirmationMessage(keys.length, type))) return;
  bulkRunning = true;
  updateToolbar();
  let started = 0;
  try {
    for (const key of keys) {
      decorate();
      const button = document.querySelector(actionSelector(key, type));
      if (!button || button.disabled) continue;
      started += 1;
      button.click();
      await waitForCompletion(key, type);
    }
  } finally {
    bulkRunning = false;
    selected.clear();
    decorate();
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'Apollo ' + (type === 'phone' ? 'phone' : 'email') + ' action started for ' + started + ' selected contact' + (started === 1 ? '' : 's') + '.';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  }
}

function markAutomaticProcessed(settings, key) {
  if (!settings.processedKeys.includes(key)) settings.processedKeys.push(key);
  settings.processedKeys = settings.processedKeys.slice(-200);
  writeSettings(settings);
}

function automaticRows() {
  return [...document.querySelectorAll('.decision-makers .person-row')].filter(isAutomaticEligible);
}

function updateAutomaticStatus(message) {
  const node = document.querySelector('[data-apollo-auto-status]');
  if (node && message) node.textContent = message;
}

async function runAutomatic() {
  if (automaticRunning || currentMode() !== 'automatic') return;
  const settings = readSettings();
  if (!settings.automaticEnabled) return;
  const available = Math.max(0, settings.dailyLimit - settings.processedKeys.length);
  if (available === 0) {
    updateAutomaticStatus('Daily automatic limit reached (' + settings.dailyLimit + '). It will reset tomorrow.');
    return;
  }
  automaticRunning = true;
  try {
    let processed = 0;
    for (const row of automaticRows()) {
      if (processed >= available) break;
      const key = keyForRow(row);
      if (!key || settings.processedKeys.includes(key)) continue;
      const button = row.querySelector('[data-action="enrich-contact"]');
      if (!button || button.disabled) continue;
      markAutomaticProcessed(settings, key);
      processed += 1;
      updateAutomaticStatus('Verifying ' + processed + ' of ' + available + ' automatically…');
      button.click();
      await waitForCompletion(key, 'email');
    }
    const refreshed = readSettings();
    updateAutomaticStatus(refreshed.processedKeys.length >= refreshed.dailyLimit
      ? 'Daily automatic limit reached (' + refreshed.dailyLimit + '). It will reset tomorrow.'
      : 'Enabled: up to ' + refreshed.dailyLimit + ' qualified contacts per day while this workspace is open (' + refreshed.processedKeys.length + ' used today).');
  } finally {
    automaticRunning = false;
  }
}

function scheduleAutomatic() {
  if (automaticTimer || !readSettings().automaticEnabled) return;
  automaticTimer = setTimeout(() => {
    automaticTimer = null;
    runAutomatic();
  }, 350);
}

function setAutomaticEnabled(enabled) {
  const settings = readSettings();
  if (enabled) {
    const credits = estimateApolloCredits(settings.dailyLimit, 'email');
    const approved = confirmAction('Automatic Apollo email verification may use up to ' + credits + ' credits per day (' + settings.dailyLimit + ' contacts). It runs only while this workspace is open and only for qualified contacts. Enable it?');
    if (!approved) {
      const toggle = document.querySelector('[data-apollo-auto-enabled]');
      if (toggle) toggle.checked = false;
      return;
    }
  }
  settings.mode = 'automatic';
  settings.automaticEnabled = Boolean(enabled);
  writeSettings(settings);
  applyMode();
  if (enabled) scheduleAutomatic();
}

function bind() {
  if (typeof document === 'undefined' || bound) return;
  bound = true;
  document.addEventListener('change', (event) => {
    const input = event.target.closest?.('[data-apollo-select]');
    if (input) {
      const key = input.dataset.apolloSelect;
      if (input.checked) selected.add(key);
      else selected.delete(key);
      updateToolbar();
      return;
    }
    const mode = event.target.closest?.('[data-apollo-mode]');
    if (mode) {
      setMode(mode.value);
      return;
    }
    const autoToggle = event.target.closest?.('[data-apollo-auto-enabled]');
    if (autoToggle) {
      setAutomaticEnabled(autoToggle.checked);
      return;
    }
    const autoLimit = event.target.closest?.('[data-apollo-auto-limit]');
    if (autoLimit) {
      const settings = readSettings();
      settings.dailyLimit = Math.min(AUTO_LIMIT_MAX, Math.max(AUTO_LIMIT_MIN, Number.parseInt(autoLimit.value, 10) || DEFAULT_AUTO_LIMIT));
      writeSettings(settings);
      applyMode();
      if (settings.automaticEnabled) scheduleAutomatic();
    }
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-apollo-bulk]');
    if (button) runBulk(button.dataset.apolloBulk);
  });
  if (typeof MutationObserver !== 'undefined' && document.body) {
    observer = new MutationObserver(() => decorate());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  decorate();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
}

export {
  CREDIT_RATES,
  STORAGE_KEY,
  AUTO_LIMIT_MAX,
  DEFAULT_AUTO_LIMIT,
  runBulk,
  runAutomatic
};
