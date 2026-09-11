import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FILE_LIMITS,
  SUPPORTED_FILE_FORMATS,
  validateCopilotFile,
  normalizeExtraction,
  normalizeAnalysisResult
} from '../copilot-file-contract.js';

test('accepts one safe supported file up to 15 MB', () => {
  const result = validateCopilotFile({
    name: 'pipeline.xlsx',
    size: 15 * 1024 * 1024,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signature: '504b0304'
  });

  assert.equal(result.ok, true);
  assert.equal(result.format, 'xlsx');
  assert.equal(FILE_LIMITS.maxFiles, 1);
});

test('accepts every supported format only with its matching MIME type and signature', () => {
  const cases = [
    ['report.pdf', 'application/pdf', '25504446', 'pdf'],
    ['brief.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '504b0304', 'docx'],
    ['pipeline.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '504b0304', 'xlsx'],
    ['legacy.xls', 'application/vnd.ms-excel', 'd0cf11e0', 'xls'],
    ['leads.csv', 'text/csv', '6c6561642c636f6d70616e790d0a', 'csv'],
    ['review.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '504b0304', 'pptx']
  ];

  for (const [name, type, signature, format] of cases) {
    const result = validateCopilotFile({ name, size: 10, type, signature });
    assert.equal(result.ok, true, name);
    assert.equal(result.format, format, name);
  }

  assert.deepEqual(
    Object.keys(SUPPORTED_FILE_FORMATS).sort(),
    ['csv', 'docx', 'pdf', 'pptx', 'xls', 'xlsx']
  );
});

test('rejects legacy, oversized and macro-enabled files', () => {
  for (const file of [
    { name: 'old.doc', size: 10, type: 'application/msword', signature: 'd0cf11e0' },
    { name: 'deck.pptm', size: 10, type: 'application/vnd.ms-powerpoint', signature: '504b0304' },
    { name: 'large.pdf', size: 15 * 1024 * 1024 + 1, type: 'application/pdf', signature: '25504446' }
  ]) {
    assert.equal(validateCopilotFile(file).ok, false);
  }
});

test('returns all validation failures and rejects unsafe file names', () => {
  const result = validateCopilotFile({
    name: '../unsafe.pdf',
    size: -1,
    type: 'text/plain',
    signature: '00000000'
  });

  assert.equal(result.ok, false);
  assert.equal(result.format, null);
  assert.ok(result.errors.length >= 4);
});

test('normalizes extraction to bounded locator-aware blocks', () => {
  const value = normalizeExtraction({
    format: 'pdf',
    title: 'Quarterly review',
    blocks: [
      { locator: 'page:1', text: 'Revenue increased', ignored: true },
      { locator: 'page:2', table: [['Region', 'Revenue'], ['North', '12']], extra: 'drop me' }
    ],
    evidenceIndex: { 'page:1': 'Revenue overview', ignored: 'drop me' },
    warnings: ['Partial table extraction'],
    coverage: { complete: false, omitted: ['page:3'] },
    counts: { characters: 16, nonEmptyCells: 2, csvRows: 0 },
    unexpected: '<script>alert(1)</script>'
  });

  assert.deepEqual(value, {
    format: 'pdf',
    title: 'Quarterly review',
    blocks: [
      { locator: 'page:1', text: 'Revenue increased' },
      { locator: 'page:2', table: [['Region', 'Revenue'], ['North', '12']] }
    ],
    evidenceIndex: { 'page:1': 'Revenue overview' },
    warnings: ['Partial table extraction'],
    coverage: { complete: false, omitted: ['page:3'] },
    counts: { characters: 16, nonEmptyCells: 2, csvRows: 0 }
  });
});

test('normalizes canonical result and removes unknown keys', () => {
  const value = normalizeAnalysisResult({
    title: 'Review',
    executive_summary: 'Summary',
    sections: [],
    findings: [],
    recommendations: [],
    risks: [],
    assumptions: [],
    data_gaps: [],
    warnings: [],
    html: '<script>alert(1)</script>'
  });

  assert.equal(value.title, 'Review');
  assert.equal('html' in value, false);
  assert.deepEqual(Object.keys(value).sort(), [
    'assumptions',
    'data_gaps',
    'executive_summary',
    'findings',
    'recommendations',
    'risks',
    'sections',
    'title',
    'warnings'
  ]);
});

test('bounds normalized extraction and result strings at contract limits', () => {
  const extraction = normalizeExtraction({
    format: 'csv',
    title: 'x'.repeat(FILE_LIMITS.maxExtractionChars + 1),
    blocks: [],
    evidenceIndex: {},
    warnings: [],
    coverage: {}
  });
  const result = normalizeAnalysisResult({
    title: 'x'.repeat(FILE_LIMITS.maxResultChars + 1),
    executive_summary: 'Summary',
    sections: [],
    findings: [],
    recommendations: [],
    risks: [],
    assumptions: [],
    data_gaps: [],
    warnings: []
  });

  assert.equal(extraction.title.length, FILE_LIMITS.maxExtractionChars);
  assert.equal(result.title.length, FILE_LIMITS.maxResultChars);
});


test('accepts CSV byte prefixes that contain text, an optional UTF-8 BOM and no NUL bytes', () => {
  for (const signature of [
    '6c6561642c636f6d70616e790d0a',
    'efbbbf6c6561642c636f6d70616e790a',
    '4e616d652c436974790d0a416e6472e92c4d6f6e7472e9616c0d0a'
  ]) {
    assert.equal(validateCopilotFile({
      name: 'leads.csv',
      size: 20,
      type: 'text/csv',
      signature
    }).ok, true, signature);
  }

  assert.equal(validateCopilotFile({
    name: 'unsafe.csv',
    size: 20,
    type: 'text/csv',
    signature: '6c656164002c636f6d70616e79'
  }).ok, false);
});
test('accepts textual UTF-16LE and UTF-16BE CSV prefixes only with an explicit BOM', () => {
  for (const signature of ['fffe4e0061006d0065000a00', 'feff004e0061006d0065000a']) {
    assert.equal(validateCopilotFile({ name: 'text.csv', type: 'text/csv', size: 32, signature }).ok, true, signature);
  }
  for (const signature of ['4e0061006d006500', '004e0061006d0065', 'fffe0000', 'feff0000', 'fffe', 'feff', 'fffe4e']) {
    assert.equal(validateCopilotFile({ name: 'binary.csv', type: 'text/csv', size: 32, signature }).ok, false, signature);
  }
});

function extractionCharacterCount(value) {
  let total = value.title.length;
  for (const block of value.blocks) {
    total += block.text?.length ?? 0;
    for (const row of block.table ?? []) {
      for (const cell of row) total += cell.length;
    }
  }
  for (const label of Object.values(value.evidenceIndex)) total += label.length;
  for (const warning of value.warnings) total += warning.length;
  for (const omission of value.coverage.omitted) total += omission.length;
  return total;
}

function resultCharacterCount(value) {
  if (typeof value === 'string') return value.length;
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value).reduce((total, item) => total + resultCharacterCount(item), 0);
}

test('enforces aggregate extraction character and spreadsheet cell limits', () => {
  const value = normalizeExtraction({
    format: 'xlsx',
    title: 't'.repeat(20_000),
    blocks: [
      { locator: 'sheet:One!A1', text: 'a'.repeat(150_000) },
      {
        locator: 'sheet:Two!A1:A50001',
        table: Array.from({ length: 50_001 }, () => ['x'])
      },
      { locator: 'sheet:Three!A1', text: 'b'.repeat(150_000) }
    ],
    evidenceIndex: {},
    warnings: [],
    coverage: {},
    counts: { characters: 320_001, nonEmptyCells: 50_001, csvRows: 0 }
  });

  assert.ok(extractionCharacterCount(value) <= FILE_LIMITS.maxExtractionChars);
  assert.ok(value.counts.characters <= FILE_LIMITS.maxExtractionChars);
  assert.ok(value.counts.nonEmptyCells <= FILE_LIMITS.maxSpreadsheetCells);
  assert.equal(value.coverage.complete, false);
  assert.ok(value.warnings.length > 0);
});

test('enforces aggregate CSV row limit', () => {
  const value = normalizeExtraction({
    format: 'csv',
    title: 'CSV',
    blocks: [{
      locator: 'row:1-20001',
      table: Array.from({ length: 20_001 }, () => ['lead'])
    }],
    evidenceIndex: {},
    warnings: [],
    coverage: {},
    counts: { characters: 80_004, nonEmptyCells: 20_001, csvRows: 20_001 }
  });

  const rows = value.blocks.reduce((total, block) => total + (block.table?.length ?? 0), 0);
  assert.ok(rows <= FILE_LIMITS.maxCsvRows);
  assert.ok(value.counts.csvRows <= FILE_LIMITS.maxCsvRows);
  assert.equal(value.coverage.complete, false);
});

test('enforces the aggregate canonical result character limit', () => {
  const value = normalizeAnalysisResult({
    title: 't'.repeat(20_000),
    executive_summary: 's'.repeat(20_000),
    sections: [],
    findings: ['f'.repeat(10_000)],
    recommendations: [],
    risks: [],
    assumptions: [],
    data_gaps: [],
    warnings: []
  });

  assert.ok(resultCharacterCount(value) <= FILE_LIMITS.maxResultChars);
});
