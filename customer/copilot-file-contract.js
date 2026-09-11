const ZIP_SIGNATURE = '504b0304';
const OLE_SIGNATURE = 'd0cf11e0';
const PDF_SIGNATURE = '25504446';
const TEXT_SIGNATURE = 'text';
const MAX_ARRAY_ITEMS = 1000;
const MAX_LOCATOR_CHARS = 500;

export const FILE_LIMITS = Object.freeze({
  maxFiles: 1,
  maxFileBytes: 15 * 1024 * 1024,
  maxRequestChars: 8_000,
  maxExtractionChars: 250_000,
  maxSpreadsheetCells: 50_000,
  maxCsvRows: 20_000,
  maxResultChars: 30_000
});

export const SUPPORTED_FILE_FORMATS = Object.freeze({
  pdf: Object.freeze({
    extensions: Object.freeze(['pdf']),
    mimeTypes: Object.freeze(['application/pdf']),
    signatures: Object.freeze([PDF_SIGNATURE])
  }),
  docx: Object.freeze({
    extensions: Object.freeze(['docx']),
    mimeTypes: Object.freeze(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    signatures: Object.freeze([ZIP_SIGNATURE])
  }),
  xlsx: Object.freeze({
    extensions: Object.freeze(['xlsx']),
    mimeTypes: Object.freeze(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
    signatures: Object.freeze([ZIP_SIGNATURE])
  }),
  xls: Object.freeze({
    extensions: Object.freeze(['xls']),
    mimeTypes: Object.freeze(['application/vnd.ms-excel']),
    signatures: Object.freeze([OLE_SIGNATURE])
  }),
  csv: Object.freeze({
    extensions: Object.freeze(['csv']),
    mimeTypes: Object.freeze(['text/csv']),
    signatures: Object.freeze([TEXT_SIGNATURE])
  }),
  pptx: Object.freeze({
    extensions: Object.freeze(['pptx']),
    mimeTypes: Object.freeze(['application/vnd.openxmlformats-officedocument.presentationml.presentation']),
    signatures: Object.freeze([ZIP_SIGNATURE])
  })
});

function cleanString(value, limit) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, limit);
}

function normalizeSignature(value) {
  return cleanString(value, 64).replace(/\s/g, '').toLowerCase();
}

function extensionFromName(name) {
  const safeName = cleanString(name, 1024).trim();
  const lastDot = safeName.lastIndexOf('.');
  return lastDot > 0 ? safeName.slice(lastDot + 1).toLowerCase() : '';
}

function formatFromExtension(extension) {
  return Object.entries(SUPPORTED_FILE_FORMATS)
    .find(([, format]) => format.extensions.includes(extension))?.[0] ?? null;
}

function boundedStringArray(value, itemLimit) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_ARRAY_ITEMS)
    .filter((item) => typeof item === 'string')
    .map((item) => cleanString(item, itemLimit));
}

function normalizeTable(value) {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, MAX_ARRAY_ITEMS).map((row) => (
    Array.isArray(row)
      ? row.slice(0, MAX_ARRAY_ITEMS).map((cell) => cleanString(String(cell ?? ''), FILE_LIMITS.maxExtractionChars))
      : []
  ));
}

function normalizeBlock(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const locator = cleanString(value.locator, MAX_LOCATOR_CHARS);
  if (!locator) return null;

  const block = { locator };
  if (typeof value.text === 'string') block.text = cleanString(value.text, FILE_LIMITS.maxExtractionChars);

  const table = normalizeTable(value.table);
  if (table !== undefined) block.table = table;

  return Object.keys(block).length > 1 ? block : null;
}

export function validateCopilotFile(fileMeta = {}) {
  const errors = [];
  const name = cleanString(fileMeta.name, 1024).trim();
  const extension = extensionFromName(name);
  const format = formatFromExtension(extension);
  const type = cleanString(fileMeta.type, 512).trim().toLowerCase().split(';', 1)[0];
  const signature = normalizeSignature(fileMeta.signature);
  const size = fileMeta.size;

  if (!name) errors.push('A file name is required.');
  if (/[\\/]/.test(name) || /(^|\.)\.($|\.)/.test(name)) {
    errors.push('The file name contains an unsafe path.');
  }
  if (!format) errors.push('This file type is not supported.');
  if (!Number.isFinite(size) || size < 0) errors.push('The file size is invalid.');
  if (Number.isFinite(size) && size > FILE_LIMITS.maxFileBytes) {
    errors.push('The file exceeds the 15 MB limit.');
  }

  if (format) {
    const definition = SUPPORTED_FILE_FORMATS[format];
    if (!definition.mimeTypes.includes(type)) {
      errors.push('The declared MIME type does not match the file extension.');
    }
    if (!definition.signatures.some((expected) => signature.startsWith(expected))) {
      errors.push('The file signature does not match the file type.');
    }
  }

  return {
    ok: errors.length === 0,
    format: errors.length === 0 ? format : null,
    errors
  };
}

export function normalizeExtraction(input = {}) {
  const format = typeof input.format === 'string' && SUPPORTED_FILE_FORMATS[input.format]
    ? input.format
    : '';
  const blocks = Array.isArray(input.blocks)
    ? input.blocks.slice(0, MAX_ARRAY_ITEMS).map(normalizeBlock).filter(Boolean)
    : [];
  const validLocators = new Set(blocks.map((block) => block.locator));
  const evidenceIndex = {};

  if (input.evidenceIndex && typeof input.evidenceIndex === 'object' && !Array.isArray(input.evidenceIndex)) {
    for (const [locator, label] of Object.entries(input.evidenceIndex)) {
      if (validLocators.has(locator) && typeof label === 'string') {
        evidenceIndex[locator] = cleanString(label, FILE_LIMITS.maxExtractionChars);
      }
    }
  }

  const coverageInput = input.coverage && typeof input.coverage === 'object' && !Array.isArray(input.coverage)
    ? input.coverage
    : {};
  return {
    format,
    title: cleanString(input.title, FILE_LIMITS.maxExtractionChars),
    blocks,
    evidenceIndex,
    warnings: boundedStringArray(input.warnings, FILE_LIMITS.maxExtractionChars),
    coverage: {
      complete: coverageInput.complete === true,
      omitted: boundedStringArray(coverageInput.omitted, FILE_LIMITS.maxExtractionChars)
    }
  };
}

function normalizeEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const locator = cleanString(value.locator, MAX_LOCATOR_CHARS);
  if (!locator) return null;
  return {
    locator,
    label: cleanString(value.label, FILE_LIMITS.maxResultChars)
  };
}

function normalizeSection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    heading: cleanString(value.heading, FILE_LIMITS.maxResultChars),
    content: cleanString(value.content, FILE_LIMITS.maxResultChars),
    tables: Array.isArray(value.tables)
      ? value.tables.slice(0, MAX_ARRAY_ITEMS).map(normalizeTable).filter((table) => table !== undefined)
      : [],
    evidence: Array.isArray(value.evidence)
      ? value.evidence.slice(0, MAX_ARRAY_ITEMS).map(normalizeEvidence).filter(Boolean)
      : []
  };
}

function normalizeResultItems(value) {
  return boundedStringArray(value, FILE_LIMITS.maxResultChars);
}

export function normalizeAnalysisResult(input = {}) {
  return {
    title: cleanString(input.title, FILE_LIMITS.maxResultChars),
    executive_summary: cleanString(input.executive_summary, FILE_LIMITS.maxResultChars),
    sections: Array.isArray(input.sections)
      ? input.sections.slice(0, MAX_ARRAY_ITEMS).map(normalizeSection).filter(Boolean)
      : [],
    findings: normalizeResultItems(input.findings),
    recommendations: normalizeResultItems(input.recommendations),
    risks: normalizeResultItems(input.risks),
    assumptions: normalizeResultItems(input.assumptions),
    data_gaps: normalizeResultItems(input.data_gaps),
    warnings: normalizeResultItems(input.warnings)
  };
}
