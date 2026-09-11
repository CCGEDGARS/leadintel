const ZIP_SIGNATURE = '504b0304';
const OLE_SIGNATURE = 'd0cf11e0';
const PDF_SIGNATURE = '25504446';
const MAX_COLLECTION_ITEMS = 1_000;
const MAX_TABLE_COLUMNS = 1_000;
const MAX_LOCATOR_CHARS = 500;
const EXTRACTION_TRUNCATION_WARNING = 'Extraction content was truncated to the contract limit.';
const RESULT_TRUNCATION_WARNING = 'Result content was truncated to the contract limit.';

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
    signaturePolicy: 'hex text bytes; optional UTF-8 BOM or explicit UTF-16LE/BE BOM; no NUL code points'
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

function isCsvTextSignature(signature) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(signature)) return false;
  const bytes = [];
  for (let index = 0; index < signature.length; index += 2) {
    bytes.push(Number.parseInt(signature.slice(index, index + 2), 16));
  }

  const littleEndian = bytes[0] === 0xff && bytes[1] === 0xfe;
  const bigEndian = bytes[0] === 0xfe && bytes[1] === 0xff;
  if (littleEndian || bigEndian) {
    if (bytes.length <= 2 || bytes.length % 2 !== 0) return false;
    for (let index = 2; index < bytes.length; index += 2) {
      const code = littleEndian ? bytes[index] | bytes[index + 1] << 8 : bytes[index] << 8 | bytes[index + 1];
      if (code === 9 || code === 10 || code === 13 || code >= 0x20) continue;
      return false;
    }
    return true;
  }

  let index = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  if (index === bytes.length) return false;

  for (; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (byte === 0) return false;
    if (byte === 9 || byte === 10 || byte === 13 || byte >= 0x20) continue;
    return false;
  }
  return true;
}

function hasValidSignature(format, signature) {
  if (format === 'csv') return isCsvTextSignature(signature);
  return SUPPORTED_FILE_FORMATS[format].signatures.some((expected) => signature.startsWith(expected));
}

function createTextBudget(limit) {
  return {
    remaining: limit,
    truncated: false,
    take(value, fieldLimit) {
      const cleaned = cleanString(value, fieldLimit);
      if (cleaned.length <= this.remaining) {
        this.remaining -= cleaned.length;
        return cleaned;
      }
      this.truncated = true;
      const bounded = cleaned.slice(0, this.remaining);
      this.remaining = 0;
      return bounded;
    },
    markTruncated() {
      this.truncated = true;
    }
  };
}

function boundedStringArray(value, itemLimit, budget) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value.slice(0, MAX_COLLECTION_ITEMS)) {
    if (typeof item !== 'string') continue;
    const normalized = budget ? budget.take(item, itemLimit) : cleanString(item, itemLimit);
    result.push(normalized);
    if (budget?.remaining === 0 && cleanString(item, itemLimit).length > normalized.length) break;
  }
  return result;
}

function normalizeTable(value, { format, budget, state }) {
  if (!Array.isArray(value)) return undefined;
  const table = [];
  const maxRows = format === 'csv' ? FILE_LIMITS.maxCsvRows : FILE_LIMITS.maxSpreadsheetCells;

  for (const row of value.slice(0, maxRows + 1)) {
    if (format === 'csv' && state.csvRows >= FILE_LIMITS.maxCsvRows) {
      budget.markTruncated();
      break;
    }
    if (!Array.isArray(row)) {
      table.push([]);
      if (format === 'csv') state.csvRows += 1;
      continue;
    }

    const normalizedRow = [];
    for (const cell of row.slice(0, MAX_TABLE_COLUMNS)) {
      const cleaned = cleanString(String(cell ?? ''), FILE_LIMITS.maxExtractionChars);
      if ((format === 'xlsx' || format === 'xls') && cleaned && state.nonEmptyCells >= FILE_LIMITS.maxSpreadsheetCells) {
        budget.markTruncated();
        break;
      }
      const normalized = budget.take(cleaned, FILE_LIMITS.maxExtractionChars);
      if (cleaned && !normalized) break;
      normalizedRow.push(normalized);
      if ((format === 'xlsx' || format === 'xls') && cleaned) state.nonEmptyCells += 1;
    }

    table.push(normalizedRow);
    if (format === 'csv') state.csvRows += 1;
    if (budget.remaining === 0) break;
  }
  return table;
}

function normalizeBlock(value, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const locator = cleanString(value.locator, MAX_LOCATOR_CHARS);
  if (!locator) return null;

  const block = { locator };
  if (typeof value.text === 'string') {
    block.text = context.budget.take(value.text, FILE_LIMITS.maxExtractionChars);
  }

  const table = normalizeTable(value.table, context);
  if (table !== undefined) block.table = table;

  return Object.keys(block).length > 1 ? block : null;
}

function clampCount(value, limit) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, limit) : 0;
}

function normalizeCounts(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    characters: clampCount(input.characters, FILE_LIMITS.maxExtractionChars),
    nonEmptyCells: clampCount(input.nonEmptyCells, FILE_LIMITS.maxSpreadsheetCells),
    csvRows: clampCount(input.csvRows, FILE_LIMITS.maxCsvRows)
  };
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
    if (!hasValidSignature(format, signature)) {
      errors.push('The file signature does not match the file type.');
    }
  }

  return {
    ok: errors.length === 0,
    format: errors.length === 0 ? format : null,
    errors
  };
}

function trimStringCandidates(candidates, count) {
  let remaining = count;
  for (const candidate of candidates) {
    if (!remaining) break;
    const current = candidate.get();
    const removed = Math.min(current.length, remaining);
    candidate.set(current.slice(0, current.length - removed));
    remaining -= removed;
  }
  return remaining === 0;
}

function freeExtractionWarningSpace(value, count) {
  const candidates = [];
  for (let index = value.coverage.omitted.length - 1; index >= 0; index -= 1) {
    candidates.push({ get: () => value.coverage.omitted[index], set: (next) => { value.coverage.omitted[index] = next; } });
  }
  for (let index = value.warnings.length - 1; index >= 0; index -= 1) {
    candidates.push({ get: () => value.warnings[index], set: (next) => { value.warnings[index] = next; } });
  }
  for (const locator of Object.keys(value.evidenceIndex).reverse()) {
    candidates.push({ get: () => value.evidenceIndex[locator], set: (next) => { value.evidenceIndex[locator] = next; } });
  }
  for (let blockIndex = value.blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
    const block = value.blocks[blockIndex];
    for (let rowIndex = (block.table?.length ?? 0) - 1; rowIndex >= 0; rowIndex -= 1) {
      for (let cellIndex = block.table[rowIndex].length - 1; cellIndex >= 0; cellIndex -= 1) {
        candidates.push({
          get: () => block.table[rowIndex][cellIndex],
          set: (next) => { block.table[rowIndex][cellIndex] = next; }
        });
      }
    }
    if (typeof block.text === 'string') {
      candidates.push({ get: () => block.text, set: (next) => { block.text = next; } });
    }
  }
  return trimStringCandidates(candidates, count);
}

export function normalizeExtraction(input = {}) {
  const format = typeof input.format === 'string' && SUPPORTED_FILE_FORMATS[input.format]
    ? input.format
    : '';
  const budget = createTextBudget(FILE_LIMITS.maxExtractionChars);
  const state = { nonEmptyCells: 0, csvRows: 0 };
  const context = { format, budget, state };
  const title = budget.take(input.title, FILE_LIMITS.maxExtractionChars);
  const blocks = Array.isArray(input.blocks)
    ? input.blocks.slice(0, MAX_COLLECTION_ITEMS).map((block) => normalizeBlock(block, context)).filter(Boolean)
    : [];
  const validLocators = new Set(blocks.map((block) => block.locator));
  const evidenceIndex = {};

  if (input.evidenceIndex && typeof input.evidenceIndex === 'object' && !Array.isArray(input.evidenceIndex)) {
    for (const [locator, label] of Object.entries(input.evidenceIndex)) {
      if (validLocators.has(locator) && typeof label === 'string') {
        evidenceIndex[locator] = budget.take(label, FILE_LIMITS.maxExtractionChars);
      }
    }
  }

  const coverageInput = input.coverage && typeof input.coverage === 'object' && !Array.isArray(input.coverage)
    ? input.coverage
    : {};
  const value = {
    format,
    title,
    blocks,
    evidenceIndex,
    warnings: boundedStringArray(input.warnings, FILE_LIMITS.maxExtractionChars, budget),
    coverage: {
      complete: coverageInput.complete === true,
      omitted: boundedStringArray(coverageInput.omitted, FILE_LIMITS.maxExtractionChars, budget)
    },
    counts: normalizeCounts(input.counts)
  };

  if (budget.truncated) {
    value.coverage.complete = false;
    if (budget.remaining >= EXTRACTION_TRUNCATION_WARNING.length) {
      value.warnings.push(EXTRACTION_TRUNCATION_WARNING);
    } else if (freeExtractionWarningSpace(value, EXTRACTION_TRUNCATION_WARNING.length)) {
      value.warnings.push(EXTRACTION_TRUNCATION_WARNING);
    }
  }
  return value;
}

function normalizeEvidence(value, budget) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const locator = cleanString(value.locator, MAX_LOCATOR_CHARS);
  if (!locator) return null;
  return {
    locator,
    label: budget.take(value.label, FILE_LIMITS.maxResultChars)
  };
}

function normalizeSection(value, budget) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    heading: budget.take(value.heading, FILE_LIMITS.maxResultChars),
    content: budget.take(value.content, FILE_LIMITS.maxResultChars),
    tables: Array.isArray(value.tables)
      ? value.tables.slice(0, MAX_COLLECTION_ITEMS).map((table) => normalizeTable(table, {
        format: '',
        budget,
        state: { nonEmptyCells: 0, csvRows: 0 }
      })).filter((table) => table !== undefined)
      : [],
    evidence: Array.isArray(value.evidence)
      ? value.evidence.slice(0, MAX_COLLECTION_ITEMS).map((evidence) => normalizeEvidence(evidence, budget)).filter(Boolean)
      : []
  };
}

function normalizeResultItems(value, budget) {
  return boundedStringArray(value, FILE_LIMITS.maxResultChars, budget);
}

function freeResultWarningSpace(value, count) {
  const candidates = [];
  for (let index = value.warnings.length - 1; index >= 0; index -= 1) {
    candidates.push({ get: () => value.warnings[index], set: (next) => { value.warnings[index] = next; } });
  }
  for (const field of ['data_gaps', 'assumptions', 'risks', 'recommendations', 'findings']) {
    for (let index = value[field].length - 1; index >= 0; index -= 1) {
      candidates.push({ get: () => value[field][index], set: (next) => { value[field][index] = next; } });
    }
  }
  for (let sectionIndex = value.sections.length - 1; sectionIndex >= 0; sectionIndex -= 1) {
    const section = value.sections[sectionIndex];
    for (let evidenceIndex = section.evidence.length - 1; evidenceIndex >= 0; evidenceIndex -= 1) {
      candidates.push({
        get: () => section.evidence[evidenceIndex].label,
        set: (next) => { section.evidence[evidenceIndex].label = next; }
      });
    }
    for (let tableIndex = section.tables.length - 1; tableIndex >= 0; tableIndex -= 1) {
      for (let rowIndex = section.tables[tableIndex].length - 1; rowIndex >= 0; rowIndex -= 1) {
        for (let cellIndex = section.tables[tableIndex][rowIndex].length - 1; cellIndex >= 0; cellIndex -= 1) {
          candidates.push({
            get: () => section.tables[tableIndex][rowIndex][cellIndex],
            set: (next) => { section.tables[tableIndex][rowIndex][cellIndex] = next; }
          });
        }
      }
    }
    candidates.push({ get: () => section.content, set: (next) => { section.content = next; } });
    candidates.push({ get: () => section.heading, set: (next) => { section.heading = next; } });
  }
  candidates.push({ get: () => value.executive_summary, set: (next) => { value.executive_summary = next; } });
  return trimStringCandidates(candidates, count);
}

export function normalizeAnalysisResult(input = {}) {
  const budget = createTextBudget(FILE_LIMITS.maxResultChars);
  const result = {
    title: budget.take(input.title, FILE_LIMITS.maxResultChars),
    executive_summary: budget.take(input.executive_summary, FILE_LIMITS.maxResultChars),
    sections: Array.isArray(input.sections)
      ? input.sections.slice(0, MAX_COLLECTION_ITEMS).map((section) => normalizeSection(section, budget)).filter(Boolean)
      : [],
    findings: normalizeResultItems(input.findings, budget),
    recommendations: normalizeResultItems(input.recommendations, budget),
    risks: normalizeResultItems(input.risks, budget),
    assumptions: normalizeResultItems(input.assumptions, budget),
    data_gaps: normalizeResultItems(input.data_gaps, budget),
    warnings: normalizeResultItems(input.warnings, budget)
  };
  if (budget.truncated) {
    if (budget.remaining >= RESULT_TRUNCATION_WARNING.length) {
      result.warnings.push(RESULT_TRUNCATION_WARNING);
    } else if (freeResultWarningSpace(result, RESULT_TRUNCATION_WARNING.length)) {
      result.warnings.push(RESULT_TRUNCATION_WARNING);
    }
  }
  return result;
}
