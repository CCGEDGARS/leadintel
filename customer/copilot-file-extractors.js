import { FILE_LIMITS, normalizeExtraction, validateCopilotFile } from './copilot-file-contract.js';

// Dependencies are loaded only for the selected format, and are replaceable without network access.
const LIBRARIES = Object.freeze({
  JSZip: './vendor/file-analysis/jszip-3.10.1.mjs',
  XLSX: './vendor/file-analysis/xlsx-0.20.3.mjs',
  xml: './vendor/file-analysis/xml-js-1.6.11.mjs',
  pdfjs: './vendor/file-analysis/pdf-4.8.69.mjs'
});
const MAX_BLOCKS = 1_000;
const MAX_COLUMNS = 1_000;
const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
const localName = node => node?.name?.split(':').pop();
const children = (node, name) => (node?.elements || []).filter(item => item.type === 'element' && (!name || localName(item) === name));
const descendants = (node, name) => children(node).flatMap(item => [...(localName(item) === name ? [item] : []), ...descendants(item, name)]);
const attribute = (node, name) => Object.entries(node?.attributes || {}).find(([key]) => key.split(':').pop() === name)?.[1];
const nodeText = node => (node?.elements || []).map(item => item.type === 'text' ? item.text : nodeText(item)).join('');
const runText = node => {
  if (['object', 'oleObject', 'OLEObject', 'instrText'].includes(localName(node))) return '';
  if (localName(node) === 't') return nodeText(node);
  return children(node).map(runText).join('');
};

async function dependency(name, dependencies) {
  if (dependencies[name]) return dependencies[name];
  const module = await import(LIBRARIES[name]);
  const value = module.default || module;
  if (name === 'XLSX') value.set_cptable(await import('./vendor/file-analysis/cpexcel-0.20.3.mjs'));
  if (name === 'pdfjs') value.GlobalWorkerOptions.workerSrc = new URL('./vendor/file-analysis/pdf.worker-4.8.69.mjs', import.meta.url).href;
  return value;
}

function collector(format, title) {
  const blocks = [], warnings = new Set(), omissions = new Map();
  function omit(reason, locator, count = 1) {
    const item = omissions.get(reason) || { count: 0, first: locator, last: locator };
    item.count += count;
    item.last = locator;
    omissions.set(reason, item);
  }
  function add(block) {
    if (blocks.length >= MAX_BLOCKS) {
      omit('source blocks (1,000-block limit)', block.locator);
      warnings.add('Extraction exceeds the 1,000-block limit.');
      return;
    }
    if (typeof block.text === 'string') block.text = clean(block.text);
    if (block.table) block.table = block.table.map(row => {
      if (row.length > MAX_COLUMNS) { omit('table cells beyond 1,000 columns', block.locator, row.length - MAX_COLUMNS); warnings.add('Table columns exceed the safe table width.'); }
      return row.slice(0, MAX_COLUMNS).map(clean);
    });
    blocks.push(block);
  }
  function finish() {
    const evidenceIndex = Object.fromEntries(blocks.map(block => [block.locator, '']));
    const sourceChars = () => blocks.reduce((n, b) => n + (b.text?.length || 0) + (b.table || []).flat().reduce((m, cell) => m + cell.length, 0), 0);
    const omissionText = () => [...omissions].map(([reason, item]) => `${item.count} ${reason} omitted at ${item.first}${item.last !== item.first ? ` through ${item.last}` : ''}.`);
    let omitted = omissionText();
    // Budget metadata together with source text, so the contract cannot silently erase coverage.
    for (;;) {
      let excess = clean(title).length + sourceChars() + [...warnings].join('').length + omitted.join('').length - FILE_LIMITS.maxExtractionChars;
      if (excess <= 0) break;
      warnings.add('Extraction exceeds the 250,000-character limit.');
      for (let i = blocks.length - 1; i >= 0 && excess > 0; i--) {
        const block = blocks[i];
        for (let row = (block.table?.length || 0) - 1; row >= 0 && excess > 0; row--) {
          for (let cell = block.table[row].length - 1; cell >= 0 && excess > 0; cell--) {
            const removed = Math.min(block.table[row][cell].length, excess);
            if (removed) { block.table[row][cell] = block.table[row][cell].slice(0, -removed); omit('characters', block.locator, removed); excess -= removed; }
          }
        }
        if (block.text && excess > 0) {
          const removed = Math.min(block.text.length, excess);
          block.text = block.text.slice(0, -removed);
          omit('characters', block.locator, removed);
          excess -= removed;
        }
      }
      if (excess > 0) throw new Error('Extraction metadata exceeds the safe limit.');
      omitted = omissionText();
    }
    if (!blocks.some(block => block.text?.trim() || block.table?.some(row => row.some(cell => cell.trim())))) {
      throw new Error('No usable content was found in this file.');
    }
    return normalizeExtraction({
      format, title: clean(title), blocks, evidenceIndex, warnings: [...warnings],
      coverage: { complete: omissions.size === 0, omitted },
      counts: {
        characters: sourceChars(),
        nonEmptyCells: /^(xlsx|xls)$/.test(format) ? blocks.reduce((n, block) => n + (block.table || []).flat().filter(Boolean).length, 0) : 0,
        csvRows: format === 'csv' ? blocks.reduce((n, block) => n + (block.table?.length || 0), 0) : 0
      }
    });
  }
  return { add, omit, warnings, finish };
}

function parseXml(text, xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Unsafe XML entities are not supported.');
  try {
    const document = xml.xml2js(text, { compact: false, trim: false });
    if (children(document).length !== 1) throw new Error();
    return document;
  } catch { throw new Error('Malformed OOXML document.'); }
}

function preflightZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let entries = 0, expanded = 0;
  // Central-directory sizes are checked before any decompression (including ZIP-bomb inputs).
  for (let offset = 0; offset + 46 <= bytes.length; offset++) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    const flags = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (offset + 46 + nameLength + extraLength + commentLength > bytes.length) throw new Error('Malformed archive.');
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (flags & 1) throw new Error('Encrypted or password-protected archives are not supported.');
    if (/\\|^\/|^[A-Za-z]:|(^|\/)\.\.(\/|$)|\u0000/.test(name)) throw new Error('Unsafe archive traversal path.');
    if (/vbaProject|macrosheets|activeX|embeddings\/|\.(exe|dll|com|bat|cmd|ps1|vbs|js|scr|hta)$/i.test(name)) throw new Error('Unsafe active content or embedded executable.');
    expanded += size;
    if (++entries > 10_000 || size > 20 * 1024 * 1024 || expanded > 60 * 1024 * 1024) throw new Error('Archive exceeds safe expanded limits.');
    offset += 45 + nameLength + extraLength + commentLength;
  }
  if (!entries) throw new Error('Malformed archive.');
}

async function openArchive(bytes, dependencies) {
  preflightZip(bytes);
  const [JSZip, xml] = await Promise.all([dependency('JSZip', dependencies), dependency('xml', dependencies)]);
  let zip;
  try { zip = await JSZip.loadAsync(bytes); } catch { throw new Error('Malformed or encrypted archive.'); }
  const cache = new Map();
  async function read(path) {
    if (!zip.file(path)) throw new Error('Malformed OOXML: a required document part is missing.');
    if (!cache.has(path)) cache.set(path, parseXml(await zip.file(path).async('string'), xml));
    return cache.get(path);
  }
  // Relationships are data only. Reject executable links; never resolve network relationships.
  for (const name of Object.keys(zip.files).filter(name => /\.rels$|\[Content_Types\]\.xml$/.test(name))) {
    const document = await read(name);
    for (const relationship of descendants(document, 'Relationship')) {
      const target = attribute(relationship, 'Target') || '';
      const type = attribute(relationship, 'Type') || '';
      if (/oleObject|vbaProject|activeX|attachedTemplate/i.test(type) || /\.(exe|dll|com|bat|cmd|ps1|vbs|js|scr|hta)(?:[?#]|$)/i.test(target)) throw new Error('Unsafe executable relationship.');
    }
    for (const type of descendants(document, 'Override')) {
      if (/macroEnabled|vbaProject|activeX/i.test(attribute(type, 'ContentType') || '')) throw new Error('Unsafe macro-enabled document.');
    }
  }
  return { read, has: path => Boolean(zip.file(path)) };
}

async function extractPdf(bytes, dependencies, output) {
  const pdfjs = await dependency('pdfjs', dependencies);
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, enableXfa: false, stopAtErrors: true, useSystemFonts: true, verbosity: 0 });
  let document;
  try {
    document = await task.promise;
    if (await document.getJSActions?.() || await document.getAttachments?.()) throw new Error('Unsafe active content or embedded PDF object.');
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      try {
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        if (text) output.add({ locator: `page:${number}`, text });
        else { output.omit('pages without extractable text (OCR unavailable)', `page:${number}`); output.warnings.add('Some PDF pages have no extractable text; OCR is not available.'); }
      } finally { page.cleanup?.(); }
    }
  } catch (error) {
    if (/Unsafe/.test(error.message)) throw error;
    throw new Error('Unable to read PDF: malformed, encrypted or password-protected file.');
  } finally { await task.destroy?.(); }
}

async function extractDocx(bytes, dependencies, output) {
  const archive = await openArchive(bytes, dependencies);
  const document = await archive.read('word/document.xml');
  const body = descendants(document, 'body')[0];
  if (!body) throw new Error('Malformed Word document.');
  let section = 'section:Document', parts = [], tableNumber = 0, paragraphGroup = 1;
  const used = new Map();
  const flush = () => {
    if (parts.length) output.add({ locator: paragraphGroup === 1 ? section : `${section}/paragraphs:${paragraphGroup}`, text: parts.join('\n') });
    parts = [];
  };
  for (const node of children(body)) {
    const objects = descendants(node, 'object').length;
    if (objects) { output.omit('embedded objects', section, objects); output.warnings.add('Embedded Word objects were omitted from text extraction.'); }
    if (localName(node) === 'p') {
      const style = attribute(descendants(node, 'pStyle')[0], 'val') || '';
      const text = runText(node);
      if (/^Heading\s*\d+$/i.test(style) || descendants(node, 'outlineLvl').length) {
        flush();
        const heading = clean(text).trim().slice(0, 440) || 'Untitled';
        const count = (used.get(heading) || 0) + 1;
        used.set(heading, count);
        section = `section:${heading}${count > 1 ? ` (${count})` : ''}`;
        paragraphGroup = 1; tableNumber = 0;
      }
      if (text.trim()) parts.push(text);
    } else if (localName(node) === 'tbl') {
      flush();
      const table = children(node, 'tr').map(row => children(row, 'tc').map(cell => descendants(cell, 'p').map(runText).join('\n')));
      output.add({ locator: `${section}/table:${++tableNumber}`, table });
      paragraphGroup++;
    }
  }
  flush();
}

function resolvePart(base, target) {
  if (!target || /^(?:[a-z]+:|\/|\\)/i.test(target)) throw new Error('Unsafe OOXML relationship target.');
  const segments = base.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (part === '..') { if (!segments.length) throw new Error('Unsafe archive traversal.'); segments.pop(); }
    else if (part !== '.') segments.push(part);
  }
  return segments.join('/');
}
function relationFile(part) {
  const index = part.lastIndexOf('/');
  return `${part.slice(0, index)}/_rels/${part.slice(index + 1)}.rels`;
}
async function extractPptx(bytes, dependencies, output) {
  const archive = await openArchive(bytes, dependencies);
  const part = 'ppt/presentation.xml';
  const document = await archive.read(part);
  const relationships = descendants(await archive.read(relationFile(part)), 'Relationship');
  const slides = descendants(document, 'sldId');
  for (let i = 0; i < slides.length; i++) {
    const id = slides[i].attributes?.['r:id'];
    const relationship = relationships.find(item => attribute(item, 'Id') === id && /\/slide$/.test(attribute(item, 'Type')));
    const slidePath = resolvePart(part, attribute(relationship, 'Target'));
    const slide = await archive.read(slidePath);
    const text = descendants(slide, 'sp').flatMap(shape => descendants(shape, 'p').map(runText)).filter(Boolean);
    const table = descendants(slide, 'tbl').flatMap(value => children(value, 'tr').map(row => children(row, 'tc').map(runText)));
    if (archive.has(relationFile(slidePath))) {
      for (const notes of descendants(await archive.read(relationFile(slidePath)), 'Relationship').filter(item => /\/notesSlide$/.test(attribute(item, 'Type')))) {
        const notesDocument = await archive.read(resolvePart(slidePath, attribute(notes, 'Target')));
        const notesText = descendants(notesDocument, 'p').map(runText).filter(Boolean).join('\n');
        if (notesText) text.push(`Speaker notes:\n${notesText}`);
      }
    }
    if (text.length || table.length) output.add({ locator: `slide:${i + 1}`, text: text.join('\n'), ...(table.length ? { table } : {}) });
    else { output.omit('slides without extractable text', `slide:${i + 1}`); output.warnings.add('Some slides contain no extractable text.'); }
  }
}

async function extractWorkbook(bytes, dependencies, output, format) {
  if (format === 'xlsx') await openArchive(bytes, dependencies);
  const XLSX = await dependency('XLSX', dependencies);
  let workbook;
  try { workbook = XLSX.read(bytes, { type: 'array', cellFormula: true, cellHTML: false, cellText: true, bookVBA: true, bookFiles: true, WTF: true }); }
  catch { throw new Error('Unable to read spreadsheet: malformed, encrypted or password-protected file.'); }
  if (workbook.vbaraw || workbook.Workbook?.Sheets?.some(sheet => sheet.Type === 'macro')) throw new Error('Unsafe macros are not supported.');
  if (workbook.cfb?.FullPaths?.some(path => /ObjectPool|Ole10Native|VBA|_VBA_PROJECT/i.test(path))) throw new Error('Unsafe embedded OLE objects or macros are not supported.');
  let cells = 0;
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const addresses = Object.keys(sheet).filter(address => /^[A-Z]+[1-9]\d*$/.test(address)).map(address => ({ address, ...XLSX.utils.decode_cell(address) })).sort((a, b) => a.r - b.r || a.c - b.c);
    let pending = null, rowsSeen = 0;
    const flush = () => {
      if (!pending) return;
      const start = XLSX.utils.encode_cell({ r: pending.first, c: pending.start });
      const end = XLSX.utils.encode_cell({ r: pending.last, c: pending.end });
      output.add({ locator: `sheet:${name}!${start}${start === end ? '' : `:${end}`}`, table: pending.table });
      pending = null;
    };
    let currentRow = null, values = [], columns = [];
    function emitRow() {
      if (!values.length) return;
      rowsSeen++;
      const start = columns[0], end = columns.at(-1);
      // Large contiguous rows are split, never silently clipped by the contract's column bound.
      for (let first = start; first <= end; first += MAX_COLUMNS) {
        const last = Math.min(end, first + MAX_COLUMNS - 1);
        const row = Array(last - first + 1).fill('');
        columns.forEach((column, index) => { if (column >= first && column <= last) row[column - first] = values[index]; });
        if (!row.some(Boolean)) continue;
        if (rowsSeen > 100 && pending && pending.start === first && pending.end === last && pending.last + 1 === currentRow && pending.table.length < 100) {
          pending.table.push(row); pending.last = currentRow;
        } else { flush(); pending = { first: currentRow, last: currentRow, start: first, end: last, table: [row] }; }
        if (rowsSeen <= 100) flush();
      }
      values = []; columns = [];
    }
    for (const item of addresses) {
      const cell = sheet[item.address];
      // SheetJS reads cached/displayed values; no formula evaluator is invoked.
      const value = clean(cell.w ?? (cell.v == null ? '' : XLSX.utils.format_cell(cell)));
      if (!value) {
        if (cell.f) { output.omit('formula cells without cached values', `sheet:${name}!${item.address}`); output.warnings.add('Formula cells without cached values were omitted; formulas are never evaluated.'); }
        continue;
      }
      if (cells >= FILE_LIMITS.maxSpreadsheetCells) { output.omit('non-empty cells', `sheet:${name}!${item.address}`); output.warnings.add('Spreadsheet exceeds the 50,000 non-empty cell limit.'); continue; }
      if (currentRow !== item.r) { emitRow(); currentRow = item.r; }
      columns.push(item.c); values.push(value); cells++;
    }
    emitRow(); flush();
  }
}

function decodeCsv(bytes, output) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { output.warnings.add('CSV encoding was detected as Windows-1252 (UTF-8 decoding failed).'); return new TextDecoder('windows-1252').decode(bytes); }
}
function parseCsv(text, delimiter) {
  const rows = [];
  let cells = [], value = '', quoted = false, closed = false, line = 1, start = 1;
  function row() {
    cells.push(value);
    if (cells.some(cell => cell.trim())) rows.push({ cells, start, end: line });
    cells = []; value = ''; closed = false;
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else { value += char; if (char === '\n' || char === '\r' && text[i + 1] !== '\n') line++; }
    } else if (char === '"' && !value && !closed) quoted = true;
    else if (char === delimiter) { cells.push(value); value = ''; closed = false; }
    else if (char === '\n' || char === '\r') { row(); if (char === '\r' && text[i + 1] === '\n') i++; line++; start = line; }
    else { if (closed || char === '"') throw new Error('Malformed CSV quoting.'); value += char; }
  }
  if (quoted) throw new Error('Malformed CSV: an enclosed field is not closed.');
  if (value || cells.length) row();
  return rows;
}
function csvLocator(row) { return `row:${row.start}${row.start === row.end ? '' : `-${row.end}`}`; }
async function extractCsv(bytes, dependencies, output) {
  const text = decodeCsv(bytes, output).replace(/^\uFEFF/, '');
  // Delimiter candidates must parse correctly and have consistent widths across representative records.
  const candidates = [];
  for (const delimiter of [',', ';', '\t', '|']) {
    try {
      const rows = parseCsv(text, delimiter);
      const sample = rows.slice(0, 20);
      const width = sample[0]?.cells.length || 0;
      candidates.push({ rows, score: width > 1 ? sample.filter(row => row.cells.length === width).length * 100 + width : 0 });
    } catch { /* Another delimiter may legitimately appear inside the quoted field. */ }
  }
  if (!candidates.length) throw new Error('Malformed CSV quoting.');
  const rows = candidates.sort((a, b) => b.score - a.score)[0].rows;
  let pending = null;
  const flush = () => { if (pending) output.add({ locator: csvLocator(pending), table: pending.table }); pending = null; };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], locator = csvLocator(row);
    if (i > FILE_LIMITS.maxCsvRows) { output.omit('data rows', locator); output.warnings.add('CSV exceeds the 20,000 data row limit.'); continue; }
    const cells = row.cells.slice(0, MAX_COLUMNS).map(value => {
      if (/^\s*[=+@]/.test(value) || /^\s*-(?!\d+(?:\.\d+)?\s*$)/.test(value)) {
        output.omit('formula-like CSV fields', locator); output.warnings.add('Formula-like CSV fields were removed.'); return '[formula omitted]';
      }
      return clean(value);
    });
    if (row.cells.length > MAX_COLUMNS) { output.omit('CSV columns beyond 1,000', locator, row.cells.length - MAX_COLUMNS); output.warnings.add('CSV columns exceed the safe table width.'); }
    if (i === 0) { output.add({ locator, text: cells.join('\t') }); continue; }
    if (i <= 100) output.add({ locator, table: [cells] });
    else if (pending && pending.table.length < 100 && pending.end + 1 === row.start) { pending.end = row.end; pending.table.push(cells); }
    else { flush(); pending = { start: row.start, end: row.end, table: [cells] }; }
  }
  flush();
}

const ADAPTERS = Object.freeze({ pdf: extractPdf, docx: extractDocx, xlsx: extractWorkbook, xls: extractWorkbook, csv: extractCsv, pptx: extractPptx });

export async function extractCopilotFile(file, dependencies = {}) {
  if (!file || Array.isArray(file) || typeof file.arrayBuffer !== 'function') throw new Error('Select one supported file.');
  if (file.size > FILE_LIMITS.maxFileBytes) throw new Error('The file exceeds the 15 MB limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const prefix = bytes.subarray(0, 32);
  const signature = Array.from(prefix, value => value.toString(16).padStart(2, '0')).join('');
  const validation = validateCopilotFile({ name: file.name, size: bytes.length, type: file.type, signature });
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const output = collector(validation.format, file.name);
  await ADAPTERS[validation.format](bytes, dependencies, output, validation.format);
  return output.finish();
}
