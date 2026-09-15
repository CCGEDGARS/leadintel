(function(root, factory) {
  const model = root && root.LeadIntelBrandIdentity
    ? root.LeadIntelBrandIdentity
    : (typeof module !== 'undefined' && module.exports ? require('./brand-identity.js') : null);
  const api = factory(root || {}, model);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LeadIntelBrandIdentityUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root, BrandIdentity) {
  'use strict';

  const TABS = ['desktop', 'mobile', 'plain'];
  const ASSET_KINDS = ['logo', 'headshot', 'banner'];
  const FIELD_KEYS = [
    'companyDisplayName', 'senderName', 'senderTitle', 'website', 'phone',
    'linkedinUrl', 'primaryColor', 'signatureText', 'legalFooter', 'postalAddress'
  ];

  function requireModel() {
    if (!BrandIdentity) throw new Error('Brand identity model is unavailable.');
    return BrandIdentity;
  }

  function hasConfiguredValue(identity) {
    if (!identity) return false;
    return FIELD_KEYS.filter(key => key !== 'primaryColor').some(key => String(identity[key] || '').trim()) ||
      Boolean(identity.primaryColor && identity.primaryColor.toLowerCase() !== '#0f6557') ||
      ASSET_KINDS.some(kind => Boolean(identity.assets && identity.assets[kind]));
  }

  function copyIdentity(value) {
    const normalized = requireModel().normalize(value || {});
    return {
      ...normalized,
      options: {...normalized.options},
      assets: {...normalized.assets}
    };
  }

  function managedAssetOnly(value) {
    return requireModel().safeAssetReference(value);
  }

  function createAssetAdapter(scope = root) {
    function server() {
      return scope.LeadIntelServer || scope.LeadIntelServerBridge || null;
    }
    function unavailable(action) {
      throw new Error(`Brand asset ${action} is unavailable until the secure server connection is ready.`);
    }
    return {
      async upload(kind, file) {
        const api = server();
        if (typeof api?.uploadBrandAsset !== 'function') return unavailable('upload');
        return api.uploadBrandAsset(kind, file);
      },
      async import(kind, url) {
        const api = server();
        if (typeof api?.importBrandAsset !== 'function') return unavailable('import');
        return api.importBrandAsset(kind, url);
      },
      async delete(kind, asset) {
        const api = server();
        if (typeof api?.deleteBrandAsset !== 'function') return unavailable('removal');
        return api.deleteBrandAsset(kind, asset);
      }
    };
  }

  function createController(options = {}) {
    const model = requireModel();
    const assetAdapter = options.assetAdapter || createAssetAdapter(options.root || root);
    const onChange = typeof options.onChange === 'function' ? options.onChange : function() {};
    const website = typeof options.website === 'function' ? options.website : function() { return ''; };
    const now = typeof options.now === 'function' ? options.now : function() { return new Date().toISOString(); };
    const extractSuggestions = typeof options.extractSuggestions === 'function'
      ? options.extractSuggestions
      : defaultWebsiteSuggestions;
    let identity = copyIdentity(options.identity);
    let expanded = false;
    let activeTab = 'desktop';
    let suggestions = {};

    function emit(next, forceDraft = true) {
      identity = copyIdentity(next);
      if (forceDraft && hasConfiguredValue(identity)) identity.status = 'draft';
      onChange(copyIdentity(identity));
      return copyIdentity(identity);
    }

    function statusText() {
      if (identity.status === 'ready' && model.validate(identity).valid) return 'Ready';
      return hasConfiguredValue(identity) ? 'Draft' : 'Not configured';
    }

    function updateField(key, value) {
      if (!FIELD_KEYS.includes(key)) return copyIdentity(identity);
      const next = copyIdentity(identity);
      next[key] = typeof value === 'string' ? value.trim() : '';
      return emit(next);
    }

    function updateOption(key, value) {
      if (!['includeLogo', 'includeHeadshot', 'includeBanner'].includes(key)) return copyIdentity(identity);
      const next = copyIdentity(identity);
      next.options[key] = Boolean(value);
      return emit(next);
    }

    async function extractFromWebsite() {
      const result = await extractSuggestions(website());
      suggestions = sanitizeSuggestions(result);
      return {...suggestions};
    }

    function applySuggestion(key) {
      if (!Object.prototype.hasOwnProperty.call(suggestions, key) || !FIELD_KEYS.includes(key)) return copyIdentity(identity);
      return updateField(key, suggestions[key]);
    }

    async function replaceAsset(kind, source) {
      if (!ASSET_KINDS.includes(kind)) throw new TypeError('Unknown brand asset type.');
      const previous = identity.assets[kind];
      let uploaded;
      try {
        uploaded = typeof source === 'string'
          ? await assetAdapter.import(kind, source)
          : await assetAdapter.upload(kind, source);
        const safe = managedAssetOnly(uploaded);
        if (!safe) throw new Error('The server returned an invalid managed image reference.');
        const next = copyIdentity(identity);
        next.assets[kind] = safe;
        emit(next);
        return safe;
      } catch (error) {
        identity.assets[kind] = previous;
        throw error;
      }
    }

    async function removeAsset(kind) {
      if (!ASSET_KINDS.includes(kind)) throw new TypeError('Unknown brand asset type.');
      const previous = identity.assets[kind];
      if (!previous) return null;
      await assetAdapter.delete(kind, previous);
      const next = copyIdentity(identity);
      next.assets[kind] = null;
      emit(next);
      return null;
    }

    function saveReady() {
      const next = copyIdentity(identity);
      next.status = 'ready';
      const result = model.validate(next);
      if (!result.valid) return result;
      next.revision = Math.max(1, Number(identity.revision) || 1) + 1;
      next.updatedAt = now();
      identity = copyIdentity(next);
      onChange(copyIdentity(identity));
      return {valid: true, errors: {}, identity: copyIdentity(identity)};
    }

    function handleTabKey(key) {
      let index = TABS.indexOf(activeTab);
      if (key === 'ArrowRight') index = (index + 1) % TABS.length;
      else if (key === 'ArrowLeft') index = (index - 1 + TABS.length) % TABS.length;
      else if (key === 'Home') index = 0;
      else if (key === 'End') index = TABS.length - 1;
      activeTab = TABS[index];
      return activeTab;
    }

    function preview(tab = activeTab) {
      const selected = TABS.includes(tab) ? tab : activeTab;
      const renderable = copyIdentity(identity);
      if (renderable.status !== 'ready') renderable.status = 'ready';
      const validation = model.validate(renderable);
      if (!validation.valid) return {valid: false, errors: validation.errors, viewport: selected};
      const rendered = model.renderEmail({
        subject: 'A personal introduction from ' + renderable.companyDisplayName,
        bodyText: 'Hello,\n\nThis is how your LeadIntel outreach email will look.',
        brandSnapshot: renderable
      });
      if (selected === 'plain') {
        return {valid: true, viewport: 'plain', contentType: 'text/plain', content: rendered.textBody};
      }
      return {valid: true, viewport: selected, contentType: 'text/html', content: rendered.htmlBody};
    }

    return {
      identity: () => copyIdentity(identity),
      replaceIdentity(value) { identity = copyIdentity(value); return copyIdentity(identity); },
      statusText,
      ctaText: () => statusText() === 'Not configured' ? 'Set up email identity' : 'Edit identity',
      isStepOneBlocking: () => false,
      isExpanded: () => expanded,
      toggleExpanded() { expanded = !expanded; return expanded; },
      updateField,
      updateOption,
      extractFromWebsite,
      suggestions: () => ({...suggestions}),
      applySuggestion,
      replaceAsset,
      removeAsset,
      saveReady,
      activeTab: () => activeTab,
      setActiveTab(tab) { if (TABS.includes(tab)) activeTab = tab; return activeTab; },
      handleTabKey,
      preview
    };
  }

  function sanitizeSuggestions(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = {};
    for (const key of FIELD_KEYS) {
      if (typeof input[key] === 'string' && input[key].trim()) output[key] = input[key].trim();
    }
    if (typeof input.logoUrl === 'string' && /^https:\/\//i.test(input.logoUrl)) output.logoUrl = input.logoUrl.trim();
    return output;
  }

  async function defaultWebsiteSuggestions(value) {
    if (!value) throw new Error('Add the main company website before extracting suggestions.');
    let parsed;
    try { parsed = new URL(value); } catch (_error) { throw new Error('Add a valid HTTPS company website first.'); }
    const name = parsed.hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());
    return {companyDisplayName: name, website: parsed.href};
  }

  function mount(options = {}) {
    if (!root.document) return null;
    const byId = id => root.document.getElementById(id);
    const host = byId('brand-identity');
    if (!host) return null;
    const controller = createController({
      identity: typeof options.getIdentity === 'function' ? options.getIdentity() : options.identity,
      website: options.getWebsite,
      onChange: identity => {
        if (typeof options.setIdentity === 'function') options.setIdentity(identity);
        renderSummary();
      },
      assetAdapter: options.assetAdapter || createAssetAdapter(root),
      extractSuggestions: options.extractSuggestions
    });

    function renderSummary() {
      byId('brand-identity-status').textContent = controller.statusText();
      byId('brand-identity-cta').textContent = controller.ctaText();
    }

    function renderFields() {
      const value = controller.identity();
      const fieldIds = {
        companyDisplayName: 'brand-company-name', senderName: 'brand-sender-name',
        senderTitle: 'brand-sender-title', website: 'brand-website', phone: 'brand-phone',
        linkedinUrl: 'brand-linkedin', primaryColor: 'brand-primary-color-hex',
        signatureText: 'brand-signature', legalFooter: 'brand-legal-footer', postalAddress: 'brand-postal-address'
      };
      for (const [key, id] of Object.entries(fieldIds)) if (byId(id)) byId(id).value = value[key] || '';
      byId('brand-primary-color').value = /^#[0-9a-f]{6}$/i.test(value.primaryColor) ? value.primaryColor : '#0f6557';
      byId('brand-include-logo').checked = value.options.includeLogo;
      byId('brand-include-headshot').checked = value.options.includeHeadshot;
      byId('brand-include-banner').checked = value.options.includeBanner;
      renderAssets();
      renderSummary();
    }

    function renderAssets() {
      const value = controller.identity();
      for (const kind of ASSET_KINDS) {
        const asset = value.assets[kind];
        const output = byId(`brand-${kind}-current`);
        const remove = byId(`brand-${kind}-remove`);
        if (output) output.innerHTML = asset
          ? `<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText || kind)}"><span>Saved image</span>`
          : '<span>No image uploaded</span>';
        if (remove) remove.hidden = !asset;
      }
    }

    function clearErrors() {
      host.querySelectorAll('[data-brand-error]').forEach(node => { node.textContent = ''; });
    }

    function showErrors(errors) {
      clearErrors();
      for (const [key, message] of Object.entries(errors || {})) {
        const node = host.querySelector(`[data-brand-error="${key}"]`);
        if (node) node.textContent = message;
      }
    }

    function renderSuggestions(value) {
      const area = byId('brand-suggestions');
      const entries = Object.entries(value || {}).filter(([key]) => FIELD_KEYS.includes(key));
      area.hidden = !entries.length;
      area.innerHTML = entries.map(([key, suggestion]) =>
        `<button type="button" data-brand-suggestion="${key}"><span>${escapeHtml(fieldLabel(key))}</span><strong>${escapeHtml(suggestion)}</strong><small>Use suggestion</small></button>`
      ).join('');
    }

    function renderPreview(tab) {
      const result = controller.preview(tab);
      if (!result.valid) { showErrors(result.errors); return; }
      const panel = byId('brand-preview-panel');
      panel.hidden = false;
      panel.dataset.viewport = result.viewport;
      host.querySelectorAll('[role="tab"]').forEach(button => {
        const selected = button.dataset.brandPreviewTab === result.viewport;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.tabIndex = selected ? 0 : -1;
      });
      const frame = byId('brand-preview-frame');
      if (result.contentType === 'text/html') {
        frame.classList.remove('plain');
        frame.innerHTML = result.content;
      } else {
        frame.classList.add('plain');
        frame.textContent = result.content;
      }
    }

    byId('brand-identity-toggle').addEventListener('click', () => {
      const expanded = controller.toggleExpanded();
      byId('brand-identity-toggle').setAttribute('aria-expanded', expanded ? 'true' : 'false');
      byId('brand-identity-body').hidden = !expanded;
      if (expanded) renderFields();
    });

    host.querySelectorAll('[data-brand-field]').forEach(input => input.addEventListener('input', event => {
      const key = event.currentTarget.dataset.brandField;
      controller.updateField(key, event.currentTarget.value);
      if (key === 'primaryColor' && /^#[0-9a-f]{6}$/i.test(event.currentTarget.value)) byId('brand-primary-color').value = event.currentTarget.value;
    }));
    byId('brand-primary-color').addEventListener('input', event => {
      byId('brand-primary-color-hex').value = event.currentTarget.value;
      controller.updateField('primaryColor', event.currentTarget.value);
    });
    host.querySelectorAll('[data-brand-option]').forEach(input => input.addEventListener('change', event => {
      controller.updateOption(event.currentTarget.dataset.brandOption, event.currentTarget.checked);
    }));

    byId('brand-extract').addEventListener('click', async () => {
      const button = byId('brand-extract');
      button.disabled = true;
      clearErrors();
      try { renderSuggestions(await controller.extractFromWebsite()); }
      catch (error) { byId('brand-action-error').textContent = error.message; }
      finally { button.disabled = false; }
    });
    byId('brand-suggestions').addEventListener('click', event => {
      const button = event.target.closest('[data-brand-suggestion]');
      if (!button) return;
      controller.applySuggestion(button.dataset.brandSuggestion);
      renderFields();
    });

    for (const kind of ASSET_KINDS) {
      byId(`brand-${kind}-input`).addEventListener('change', async event => {
        const file = event.currentTarget.files && event.currentTarget.files[0];
        if (!file) return;
        byId('brand-action-error').textContent = '';
        try { await controller.replaceAsset(kind, file); renderAssets(); }
        catch (error) { byId('brand-action-error').textContent = error.message; }
        finally { event.currentTarget.value = ''; }
      });
      byId(`brand-${kind}-remove`).addEventListener('click', async () => {
        byId('brand-action-error').textContent = '';
        try { await controller.removeAsset(kind); renderAssets(); }
        catch (error) { byId('brand-action-error').textContent = error.message; }
      });
    }

    byId('brand-preview').addEventListener('click', () => renderPreview(controller.activeTab()));
    host.querySelectorAll('[role="tab"]').forEach(button => {
      button.addEventListener('click', () => { controller.setActiveTab(button.dataset.brandPreviewTab); renderPreview(controller.activeTab()); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tab = controller.handleTabKey(event.key);
        const next = host.querySelector(`[data-brand-preview-tab="${tab}"]`);
        next?.focus();
        renderPreview(tab);
      });
    });
    byId('brand-save').addEventListener('click', () => {
      const result = controller.saveReady();
      showErrors(result.errors);
      byId('brand-action-error').textContent = result.valid ? 'Brand identity saved and ready for future outreach.' : 'Review the highlighted fields.';
      renderSummary();
    });

    renderSummary();
    return {
      controller,
      sync(value) { controller.replaceIdentity(value); renderFields(); }
    };
  }

  function fieldLabel(key) {
    return ({companyDisplayName: 'Company name', senderName: 'Sender name', senderTitle: 'Sender title', website: 'Website', phone: 'Phone', linkedinUrl: 'LinkedIn', primaryColor: 'Brand colour', signatureText: 'Signature', legalFooter: 'Footer', postalAddress: 'Address'})[key] || key;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  }

  return {createController, createAssetAdapter, mount};
});
