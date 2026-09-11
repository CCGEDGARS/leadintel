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
    ['leads.csv', 'text/csv', 'text', 'csv'],
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
    coverage: { complete: false, omitted: ['page:3'] }
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
