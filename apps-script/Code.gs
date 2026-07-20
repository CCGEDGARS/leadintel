const LEADINTEL_CONFIG = Object.freeze({
  spreadsheetId: '1RYi-46vnOd1absDdM1bOrlHbwV9iV7DH7DN9JmB7JkA',
  findingsSheet: 'Make Raw Findings',
  maxRows: 100,
  minimumScore: 7,
});

function doGet(event) {
  try {
    const payload = buildSnapshot_();
    const callback = String((event && event.parameter && event.parameter.callback) || '');
    if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
      return ContentService.createTextOutput(`${callback}(${JSON.stringify(payload)});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error && error.message ? error.message : 'Snapshot failed',
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function buildSnapshot_() {
  const sheet = SpreadsheetApp.openById(LEADINTEL_CONFIG.spreadsheetId)
    .getSheetByName(LEADINTEL_CONFIG.findingsSheet);
  if (!sheet) throw new Error(`Missing sheet: ${LEADINTEL_CONFIG.findingsSheet}`);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return snapshotEnvelope_([]);
  const headers = values[0].map(value => String(value).trim());
  const rows = values.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
  const opportunities = rows
    .filter(row => parseBoolean_(row.Keep) && parseNumber_(row['Score 10']) >= LEADINTEL_CONFIG.minimumScore)
    .sort((a, b) => parseDate_(b['Captured At']) - parseDate_(a['Captured At']))
    .slice(0, LEADINTEL_CONFIG.maxRows)
    .map((row, index) => ({
      id: String(row['Run ID'] || `${row['Query ID'] || 'lead'}-${index + 1}`),
      query_id: row['Query ID'] || '',
      company_name: row['Company Name'] || '',
      score_100: parseNumber_(row['Score 100']),
      score_10: parseNumber_(row['Score 10']),
      keep: true,
      confidence: normalizeConfidence_(row.Confidence),
      signal_type: row['Signal Type'] || '',
      signal_summary: row['Signal Summary'] || '',
      factual_evidence: row['Factual Evidence'] || '',
      pain_points: splitList_(row['Pain Points']),
      recommended_offer: row['Recommended Offer'] || row['Lead Solution'] || '',
      commercial_reason: row['Commercial Reason'] || '',
      decision_maker_role: row['Decision Maker Role'] || '',
      urgency: row.Urgency || '',
      source_title: row['Source Title'] || '',
      source_url: safePublicUrl_(row['Source URL']),
      captured_at: row['Captured At'] || '',
      status: 'New',
    }));
  return snapshotEnvelope_(opportunities);
}

function snapshotEnvelope_(opportunities) {
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    workspace: { id: 'edgars-latvia', name: 'Edgars · Latvia', market: 'Latvia' },
    opportunities,
    signals: opportunities.map(item => ({
      company: item.company_name,
      text: item.signal_summary,
      type: item.signal_type,
      date: item.captured_at,
      confidence: item.confidence,
      status: 'Qualified',
    })),
    sources: [],
    runs: [],
  };
}

function parseBoolean_(value) {
  return /^(true|yes|1)$/i.test(String(value || '').trim());
}

function parseNumber_(value) {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate_(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeConfidence_(value) {
  const raw = String(value || '').trim();
  if (/^high$/i.test(raw)) return 'High';
  if (/^medium$/i.test(raw)) return 'Medium';
  if (/^low$/i.test(raw)) return 'Low';
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric >= .8 ? 'High' : numeric >= .55 ? 'Medium' : 'Low';
  return 'Medium';
}

function splitList_(value) {
  return String(value || '').split(/\n|\s*;\s*/).map(item => item.trim()).filter(Boolean);
}

function safePublicUrl_(value) {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url : '';
}
