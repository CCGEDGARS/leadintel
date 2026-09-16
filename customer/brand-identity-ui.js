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
  const ASSET_LABELS = Object.freeze({logo: 'Logo', headshot: 'Headshot', banner: 'Banner'});
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
      async upload(kind, file, identity) {
        const api = server();
        if (typeof api?.uploadBrandAsset !== 'function') return unavailable('upload');
        return api.uploadBrandAsset(kind, file, {mutation: {operation: 'replace', kind}, returnTransaction: true});
      },
      async import(kind, url, identity) {
        const api = server();
        if (typeof api?.importBrandAsset !== 'function') return unavailable('import');
        return api.importBrandAsset(kind, url, {expectedWebsite: identity.website, altText: identity.companyDisplayName ? identity.companyDisplayName + ' logo' : 'Company logo', mutation: {operation: 'replace', kind}, returnTransaction: true});
      },
      async delete(kind, asset, identity) {
        const api = server();
        if (typeof api?.deleteBrandAsset !== 'function') return unavailable('removal');
        return api.deleteBrandAsset(kind, asset, {mutation: {operation: 'remove', kind}, returnTransaction: true});
      }
    };
  }

  function createController(options = {}) {
    const model = requireModel();
    const assetAdapter = options.assetAdapter || createAssetAdapter(options.root || root);
    const onChange = typeof options.onChange === 'function' ? options.onChange : function() {};
    const website = typeof options.website === 'function' ? options.website : function() { return ''; };
    const publicEvidence = typeof options.publicEvidence === 'function' ? options.publicEvidence : function() { return {}; };
    const now = typeof options.now === 'function' ? options.now : function() { return new Date().toISOString(); };
    const extractSuggestions = typeof options.extractSuggestions === 'function'
      ? options.extractSuggestions
      : extractWebsiteSuggestions;
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

    function adoptCommitted(value) {
      identity = copyIdentity(value);
      onChange(copyIdentity(identity), {persist: false, committed: true});
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
      const result = await extractSuggestions(website(), publicEvidence());
      suggestions = sanitizeSuggestions(result);
      return {...suggestions};
    }

    function applySuggestion(key) {
      if (!Object.prototype.hasOwnProperty.call(suggestions, key) || !FIELD_KEYS.includes(key)) return copyIdentity(identity);
      return updateField(key, suggestions[key]);
    }

    async function applyLogoSuggestion() {
      if (!suggestions.logoUrl) throw new Error('No verified logo suggestion is available.');
      return replaceAsset('logo', suggestions.logoUrl);
    }

    async function replaceAsset(kind, source) {
      if (!ASSET_KINDS.includes(kind)) throw new TypeError('Unknown brand asset type.');
      const desired = copyIdentity(identity);
      desired.status = 'draft';
      const uploaded = typeof source === 'string'
        ? await assetAdapter.import(kind, source, desired)
        : await assetAdapter.upload(kind, source, desired);
      const committed = uploaded && typeof uploaded === 'object' && uploaded.identity ? copyIdentity(uploaded.identity) : null;
      const safe = managedAssetOnly(committed ? uploaded.asset : uploaded);
      if (!safe) throw new Error('The server returned an invalid managed image reference.');
      if (committed) {
        if (committed.assets[kind]?.id !== safe.id) throw new Error('The server returned inconsistent committed brand identity.');
        adoptCommitted(committed);
        return safe;
      }
      const next = copyIdentity(identity);
      next.assets[kind] = safe;
      emit(next);
      return safe;
    }

    async function removeAsset(kind) {
      if (!ASSET_KINDS.includes(kind)) throw new TypeError('Unknown brand asset type.');
      const previous = identity.assets[kind];
      if (!previous) return null;
      const next = copyIdentity(identity);
      next.assets[kind] = null;
      next.status = 'draft';
      const removed = await assetAdapter.delete(kind, previous, next);
      if (removed && typeof removed === 'object' && removed.identity) {
        const committed = copyIdentity(removed.identity);
        if (committed.assets[kind] !== null) throw new Error('The server returned inconsistent committed brand identity.');
        adoptCommitted(committed);
        return null;
      }
      emit(next);
      return null;
    }

    function saveReady() {
      const next = copyIdentity(identity);
      next.status = 'ready';
      next.updatedAt = now();
      const result = model.validate(next);
      if (!result.valid) return result;
      next.revision = Math.max(1, Number(identity.revision) || 1) + 1;
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
      if (!renderable.updatedAt) renderable.updatedAt = now();
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
      applyLogoSuggestion,
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
    const model = requireModel();
    for (const key of FIELD_KEYS) {
      if (typeof input[key] !== 'string' || !input[key].trim()) continue;
      const validation = model.validate({[key]: input[key]});
      if (!validation.errors[key]) output[key] = model.normalize({[key]: input[key]})[key];
    }
    if (safeHttpsUrl(input.logoUrl)) output.logoUrl = input.logoUrl.trim();
    return output;
  }

  async function extractWebsiteSuggestions(value, evidence = {}) {
    const website = safeHttpsUrl(value);
    if (!website) throw new Error('Add a valid HTTPS company website first.');
    const websiteUrl = new URL(website);
    const source = evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? evidence : {};
    const profile = source.profile && typeof source.profile === 'object' && !Array.isArray(source.profile) ? source.profile : {};
    const scrapedSources = Array.isArray(source.scrapedSources) ? source.scrapedSources : [];
    const publicSources = scrapedSources.filter(item => {
      if (!item || typeof item !== 'object' || !safeHttpsUrl(item.url)) return false;
      if (String(item.status || '').toLowerCase().startsWith('error')) return false;
      try { return new URL(item.url).origin === websiteUrl.origin && Boolean(String(item.text || item.title || '').trim()); }
      catch (_error) { return false; }
    });
    const profileHasEvidence = ['companyName', 'companyDisplayName', 'phone', 'linkedinUrl', 'primaryColor', 'logoUrl']
      .some(key => typeof profile[key] === 'string' && profile[key].trim());
    if (!publicSources.length && !profileHasEvidence) return {};

    const suggestions = {};
    const companyName = firstText(profile.companyDisplayName, profile.companyName, publicSources[0]?.title);
    if (companyName) suggestions.companyDisplayName = companyName;
    suggestions.website = websiteUrl.href;

    const publicText = publicSources.map(item => String(item.text || '')).join('\n');
    const phone = firstText(profile.phone, publicText.match(/\+\d[\d\s().-]{5,28}\d/)?.[0]);
    if (phone) suggestions.phone = phone;

    const links = [profile.linkedinUrl, ...(Array.isArray(source.additionalLinks) ? source.additionalLinks : [])];
    const linkedin = links.find(link => safeLinkedInUrl(link));
    if (linkedin) suggestions.linkedinUrl = linkedin;
    const primaryColor = [profile.primaryColor, ...publicSources.map(item => item.primaryColor)]
      .find(candidate => /^#[0-9a-f]{6}$/i.test(String(candidate || '').trim()));
    if (primaryColor) suggestions.primaryColor = String(primaryColor).trim().toLowerCase();

    const logoCandidates = [
      profile.logoUrl,
      source.websiteActivation?.logoUrl,
      ...publicSources.flatMap(item => [item.logoUrl, item.metadata?.logoUrl, item.metadata?.logo])
    ];
    const logoUrl = logoCandidates.find(candidate => sameOriginHttpsUrl(candidate, websiteUrl.origin));
    if (logoUrl) suggestions.logoUrl = logoUrl;
    return sanitizeSuggestions(suggestions);
  }

  function safeHttpsUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const parsed = new URL(value.trim());
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : '';
    } catch (_error) { return ''; }
  }

  function safeLinkedInUrl(value) {
    const safe = safeHttpsUrl(value);
    if (!safe) return '';
    const hostname = new URL(safe).hostname.toLowerCase();
    return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com') ? safe : '';
  }

  function sameOriginHttpsUrl(value, origin) {
    const safe = safeHttpsUrl(value);
    if (!safe) return '';
    return new URL(safe).origin === origin ? safe : '';
  }

  function firstText(...values) {
    return values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
  }

  function mount(options = {}) {
    if (!root.document) return null;
    const byId = id => root.document.getElementById(id);
    const host = byId('brand-identity');
    if (!host) return null;
    const controller = createController({
      identity: typeof options.getIdentity === 'function' ? options.getIdentity() : options.identity,
      website: options.getWebsite,
      publicEvidence: options.getPublicEvidence,
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
        if (output) {
          output.removeAttribute('data-load-error');
          output.innerHTML = asset
            ? `<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText || kind)}"><span><span aria-hidden="true">✓</span> Saved image</span>`
            : '<span>No image uploaded</span>';
          const image = output.querySelector('img');
          if (image) {
            image.addEventListener('load', () => renderAssetLoadState(output, image, kind, true));
            image.addEventListener('error', () => renderAssetLoadState(output, image, kind, false));
            if (image.complete) renderAssetLoadState(output, image, kind, image.naturalWidth > 0);
          }
        }
        if (remove) remove.hidden = !asset;
      }
    }

    function renderAssetLoadState(output, image, kind, loaded) {
      if (!output || !image || !output.contains(image)) return;
      const label = ASSET_LABELS[kind] || 'Managed';
      if (loaded) {
        output.removeAttribute('data-load-error');
        image.hidden = false;
        const status = output.querySelector('span');
        if (status) status.innerHTML = '<span aria-hidden="true">✓</span> Saved image';
        return;
      }
      output.dataset.loadError = 'true';
      image.hidden = true;
      const status = output.querySelector('span');
      if (status) status.innerHTML = `<span aria-hidden="true">!</span> ${label} image unavailable. Upload or replace it.`;
    }

    function attachPreviewImageStatus(frame) {
      frame.querySelectorAll('img').forEach(image => {
        const reportFailure = () => {
          if (!image.isConnected || !frame.contains(image)) return;
          const status = root.document.createElement('div');
          status.className = 'brand-preview-image-status';
          status.setAttribute('role', 'status');
          status.setAttribute('aria-live', 'polite');
          status.innerHTML = '<span aria-hidden="true">!</span> Preview image unavailable. Upload or replace the managed image.';
          image.replaceWith(status);
        };
        image.addEventListener('error', reportFailure);
        if (image.complete && image.naturalWidth < 1) reportFailure();
      });
    }

    function clearErrors() {
      host.querySelectorAll('[data-brand-error]').forEach(node => { node.textContent = ''; });
      host.querySelectorAll('[data-brand-field]').forEach(input => input.setAttribute('aria-invalid', 'false'));
    }

    function showErrors(errors) {
      clearErrors();
      let firstInvalid = null;
      for (const [key, message] of Object.entries(errors || {})) {
        const node = host.querySelector(`[data-brand-error="${key}"]`);
        if (node) node.textContent = message;
        const input = host.querySelector(`[data-brand-field="${key}"]`);
        if (input) {
          input.setAttribute('aria-invalid', 'true');
          if (!firstInvalid) firstInvalid = input;
        }
      }
      if (firstInvalid) firstInvalid.focus();
      return firstInvalid;
    }

    function hidePreview() {
      const panel = byId('brand-preview-panel');
      const frame = byId('brand-preview-frame');
      panel.hidden = true;
      panel.removeAttribute('data-viewport');
      frame.classList.remove('plain');
      frame.replaceChildren();
    }

    function renderSuggestions(value) {
      const area = byId('brand-suggestions');
      const entries = Object.entries(value || {}).filter(([key]) => FIELD_KEYS.includes(key));
      const logo = value && value.logoUrl;
      area.hidden = false;
      if (!entries.length && !logo) {
        area.innerHTML = '<p class="brand-suggestion-empty">No verified suggestions available yet. Complete company research or enter the details manually.</p>';
        return;
      }
      area.innerHTML = entries.map(([key, suggestion]) =>
        `<article class="brand-suggestion-item"><span>${escapeHtml(fieldLabel(key))}</span><strong>${escapeHtml(suggestion)}</strong><button class="text-btn" type="button" data-brand-suggestion="${key}">Apply</button></article>`
      ).join('') + (logo ? `<article class="brand-suggestion-item"><span>Logo</span><strong>Verified website image</strong><p>Copy this same-site image into secure LeadIntel storage. If the website blocks copying, download it and use Upload or replace.</p><button class="secondary-btn" type="button" data-brand-logo-copy>Copy logo securely</button> <a class="text-btn" href="${escapeHtml(logo)}" target="_blank" rel="noopener noreferrer" data-brand-logo-download>Download image</a></article>` : '');
    }

    function renderPreview(tab) {
      const result = controller.preview(tab);
      if (!result.valid) {
        hidePreview();
        showErrors(result.errors);
        byId('brand-action-error').textContent = 'Review the highlighted fields before previewing.';
        return;
      }
      clearErrors();
      byId('brand-action-error').textContent = '';
      const panel = byId('brand-preview-panel');
      panel.hidden = false;
      panel.dataset.viewport = result.viewport;
      host.querySelectorAll('[role="tab"]').forEach(button => {
        const selected = button.dataset.brandPreviewTab === result.viewport;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.tabIndex = selected ? 0 : -1;
      });
      const frame = byId('brand-preview-frame');
      frame.setAttribute('aria-labelledby', `brand-preview-tab-${result.viewport}`);
      if (result.contentType === 'text/html') {
        frame.classList.remove('plain');
        frame.innerHTML = result.content;
        attachPreviewImageStatus(frame);
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
      event.currentTarget.setAttribute('aria-invalid', 'false');
      const error = host.querySelector(`[data-brand-error="${key}"]`);
      if (error) error.textContent = '';
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
    byId('brand-suggestions').addEventListener('click', async event => {
      const logoButton = event.target.closest('[data-brand-logo-copy]');
      if (logoButton) {
        logoButton.disabled = true;
        byId('brand-action-error').textContent = '';
        try { await controller.applyLogoSuggestion(); renderAssets(); }
        catch (error) { byId('brand-action-error').textContent = error.message; }
        finally { logoButton.disabled = false; }
        return;
      }
      const button = event.target.closest('[data-brand-suggestion]');
      if (!button) return;
      controller.applySuggestion(button.dataset.brandSuggestion);
      renderFields();
    });

    for (const kind of ASSET_KINDS) {
      const fileInput = byId(`brand-${kind}-input`);
      const fileTrigger = host.querySelector(`[data-brand-file-trigger="${kind}"]`);
      fileTrigger?.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async event => {
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
      if (!result.valid) hidePreview();
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

  return {createController, createAssetAdapter, extractWebsiteSuggestions, mount};
});
