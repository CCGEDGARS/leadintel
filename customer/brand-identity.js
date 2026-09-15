(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LeadIntelBrandIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const DEFAULT_COLOR = '#0f6557';
  const ASSET_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const ASSET_ORIGIN = 'https://leadintel-api.edgars-7e7.workers.dev';
  const ASSET_PATH_PREFIX = '/api/customer/brand-assets/';

  function stringValue(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function booleanValue(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
  }

  function positiveInteger(value, fallback) {
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }

  function safeAssetReference(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const id = stringValue(value.id);
    const url = stringValue(value.url);
    const mimeType = stringValue(value.mimeType).toLowerCase();
    const width = value.width;
    const height = value.height;
    const altText = stringValue(value.altText);
    const updatedAt = stringValue(value.updatedAt);

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
    const assetPath = ASSET_PATH_PREFIX + encodeURIComponent(id);
    const absoluteUrl = ASSET_ORIGIN + assetPath;
    if (url !== assetPath && url !== absoluteUrl) return null;
    if (!ASSET_MIME_TYPES.has(mimeType)) return null;
    if (!Number.isSafeInteger(width) || width < 1 || width > 6000) return null;
    if (!Number.isSafeInteger(height) || height < 1 || height > 6000) return null;
    if (!isIsoTimestamp(updatedAt)) return null;

    return {id, url: absoluteUrl, mimeType, width, height, altText, updatedAt};
  }

  function normalize(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const options = input.options && typeof input.options === 'object' && !Array.isArray(input.options)
      ? input.options
      : {};
    const assets = input.assets && typeof input.assets === 'object' && !Array.isArray(input.assets)
      ? input.assets
      : {};
    const color = stringValue(input.primaryColor);

    return {
      schemaVersion: 1,
      status: input.status === 'ready' ? 'ready' : 'draft',
      revision: positiveInteger(input.revision, 1),
      companyDisplayName: stringValue(input.companyDisplayName),
      senderName: stringValue(input.senderName),
      senderTitle: stringValue(input.senderTitle),
      website: stringValue(input.website),
      phone: stringValue(input.phone),
      linkedinUrl: stringValue(input.linkedinUrl),
      primaryColor: color ? color.toLowerCase() : DEFAULT_COLOR,
      signatureText: stringValue(input.signatureText),
      legalFooter: stringValue(input.legalFooter),
      postalAddress: stringValue(input.postalAddress),
      options: {
        includeLogo: booleanValue(options.includeLogo, true),
        includeHeadshot: booleanValue(options.includeHeadshot, false),
        includeBanner: booleanValue(options.includeBanner, false)
      },
      assets: {
        logo: safeAssetReference(assets.logo),
        headshot: safeAssetReference(assets.headshot),
        banner: safeAssetReference(assets.banner)
      },
      updatedAt: stringValue(input.updatedAt)
    };
  }

  function validate(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const identity = normalize(input);
    const errors = {};

    if (identity.status === 'ready' && !identity.companyDisplayName) {
      errors.companyDisplayName = 'Company display name is required when identity is ready.';
    }
    if (identity.status === 'ready' && !identity.senderName) {
      errors.senderName = 'Sender name is required when identity is ready.';
    }
    if (identity.website && !safeHttpsUrl(identity.website)) {
      errors.website = 'Website must be a valid HTTPS URL.';
    }
    if (identity.phone && !validPhone(identity.phone)) {
      errors.phone = 'Phone number is invalid.';
    }
    if (identity.linkedinUrl && !safeLinkedInUrl(identity.linkedinUrl)) {
      errors.linkedinUrl = 'LinkedIn URL must be a valid HTTPS linkedin.com URL.';
    }
    if (!/^#[0-9a-f]{6}$/.test(identity.primaryColor)) {
      errors.primaryColor = 'Primary brand colour must be a six-digit hex value.';
    }

    const rawAssets = input.assets && typeof input.assets === 'object' && !Array.isArray(input.assets)
      ? input.assets
      : {};
    for (const kind of ['logo', 'headshot', 'banner']) {
      if (rawAssets[kind] != null && !identity.assets[kind]) {
        errors['assets.' + kind] = 'Image reference must use an approved managed asset.';
      }
    }

    return {valid: Object.keys(errors).length === 0, errors};
  }

  function snapshot(value) {
    const identity = normalize(value);
    const result = validate(value);
    if (identity.status !== 'ready' || !result.valid) {
      throw new TypeError('Cannot snapshot without a valid ready brand identity.');
    }
    return deepFreeze(identity);
  }

  function renderEmail(input) {
    const source = input && typeof input === 'object' ? input : {};
    const subject = typeof source.subject === 'string' ? source.subject : '';
    const bodyText = typeof source.bodyText === 'string' ? source.bodyText : '';
    const identity = normalize(source.brandSnapshot);
    const validation = validate(source.brandSnapshot);

    if (!source.brandSnapshot || identity.status !== 'ready') {
      return {subject, textBody: bodyText, htmlBody: null};
    }
    if (!validation.valid) {
      throw new TypeError('Cannot render a present invalid ready brand identity.');
    }

    const signatureLines = [
      identity.signatureText,
      identity.senderName,
      identity.senderTitle,
      identity.companyDisplayName,
      identity.phone,
      identity.website,
      identity.linkedinUrl ? 'LinkedIn: ' + identity.linkedinUrl : '',
      identity.postalAddress
    ].filter(Boolean);
    const textBody = appendSection(bodyText, signatureLines.join('\n'));
    const finalTextBody = appendSection(textBody, identity.legalFooter);

    return {
      subject,
      textBody: finalTextBody,
      htmlBody: renderHtml(bodyText, identity)
    };
  }

  function renderHtml(bodyText, identity) {
    const logo = identity.options.includeLogo ? identity.assets.logo : null;
    const headshot = identity.options.includeHeadshot ? identity.assets.headshot : null;
    const banner = identity.options.includeBanner ? identity.assets.banner : null;
    const website = safeHttpsUrl(identity.website);
    const linkedin = safeLinkedInUrl(identity.linkedinUrl);
    const phoneHref = identity.phone && validPhone(identity.phone)
      ? 'tel:' + identity.phone.replace(/[^+\d]/g, '')
      : '';
    const parts = [];

    parts.push('<!doctype html>');
    parts.push('<html><body style="margin:0;padding:0;background:#ffffff;color:#1f2933;font-family:Arial,Helvetica,sans-serif;">');
    parts.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#ffffff;"><tr><td align="center">');
    parts.push('<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td style="padding:24px;">');

    if (logo) {
      parts.push(imageHtml(logo, identity.companyDisplayName + ' logo', 'display:block;max-width:140px;max-height:48px;width:auto;height:auto;border:0;margin:0 0 20px 0;'));
    }

    parts.push('<div style="font-size:16px;line-height:1.55;color:#1f2933;">' + multilineHtml(bodyText) + '</div>');

    if (banner) {
      parts.push(imageHtml(banner, identity.companyDisplayName + ' promotional banner', 'display:block;max-width:100%;height:auto;border:0;margin:20px 0 0 0;'));
    }

    parts.push('<div style="margin-top:24px;padding-top:16px;border-top:2px solid ' + escapeHtml(identity.primaryColor) + ';font-size:14px;line-height:1.45;color:#364152;">');
    if (identity.signatureText) {
      parts.push('<div style="margin-bottom:10px;">' + multilineHtml(identity.signatureText) + '</div>');
    }
    if (headshot) {
      parts.push(imageHtml(headshot, identity.senderName + ' headshot', 'display:block;max-width:64px;max-height:64px;width:auto;height:auto;border:0;border-radius:32px;margin:0 0 10px 0;'));
    }
    parts.push('<div><strong style="color:#1f2933;">' + escapeHtml(identity.senderName) + '</strong></div>');
    if (identity.senderTitle) parts.push('<div>' + escapeHtml(identity.senderTitle) + '</div>');
    parts.push('<div>' + escapeHtml(identity.companyDisplayName) + '</div>');
    if (identity.phone) {
      parts.push('<div><a href="' + escapeHtml(phoneHref) + '" style="color:' + escapeHtml(identity.primaryColor) + ';text-decoration:underline;">' + escapeHtml(identity.phone) + '</a></div>');
    }
    if (website) {
      parts.push('<div><a href="' + escapeHtml(website) + '" style="color:' + escapeHtml(identity.primaryColor) + ';text-decoration:underline;">' + escapeHtml(identity.website) + '</a></div>');
    }
    if (linkedin) {
      parts.push('<div><a href="' + escapeHtml(linkedin) + '" style="color:' + escapeHtml(identity.primaryColor) + ';text-decoration:underline;">LinkedIn: ' + escapeHtml(identity.linkedinUrl) + '</a></div>');
    }
    if (identity.postalAddress) parts.push('<div>' + multilineHtml(identity.postalAddress) + '</div>');
    parts.push('</div>');

    if (identity.legalFooter) {
      parts.push('<div style="margin-top:20px;font-size:11px;line-height:1.4;color:#667085;">' + multilineHtml(identity.legalFooter) + '</div>');
    }

    parts.push('</td></tr></table>');
    parts.push('</td></tr></table>');
    parts.push('</body></html>');
    return parts.join('');
  }

  function appendSection(base, section) {
    if (!section) return base;
    if (!base) return section;
    return base + '\n\n' + section;
  }

  function imageHtml(asset, fallbackAlt, style) {
    const alt = asset.altText || fallbackAlt;
    return '<img src="' + escapeHtml(asset.url) + '" alt="' + escapeHtml(alt) + '" style="' + style + '">';
  }

  function multilineHtml(value) {
    return escapeHtml(value).replace(/\r\n?|\n/g, '<br>');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function(character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function safeHttpsUrl(value) {
    if (!value) return '';
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
      return value;
    } catch (_error) {
      return '';
    }
  }

  function safeLinkedInUrl(value) {
    const safe = safeHttpsUrl(value);
    if (!safe) return '';
    const hostname = new URL(safe).hostname.toLowerCase();
    return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com') ? safe : '';
  }

  function validPhone(value) {
    if (!/^[+\d][\d\s().-]{5,28}\d$/.test(value)) return false;
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 20;
  }

  function isIsoTimestamp(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
    return parsed.toISOString() === canonical;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  return {normalize, validate, snapshot, renderEmail, safeAssetReference};
});
