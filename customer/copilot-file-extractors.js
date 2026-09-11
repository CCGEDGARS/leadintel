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
const RESOURCE_LIMITS = Object.freeze({ maxPages: 120, maxXmlChars: 4_000_000, maxXmlNodes: 250_000, maxXmlDepth: 64, maxCsvRecords: 300_000, maxSheetCells: 200_000, maxCandidates: 3_000, workerMs: 15_000 });
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

function representativeIndexes(total, limit) {
  if (total <= limit) return Array.from({ length: total }, (_, index) => index);
  const early = Math.ceil(limit / 3), middle = Math.ceil((limit - early) / 2), late = limit - early - middle;
  const result = new Set();
  for (const [start, count] of [[0, early], [Math.floor((total - middle) / 2), middle], [total - late, late]]) {
    for (let index = start; index < start + count; index++) result.add(index);
  }
  return [...result].sort((a, b) => a - b);
}
function omitUnselected(total, selected, locator, output, reason) {
  let start = null;
  for (let index = 0; index <= total; index++) {
    if (index < total && !selected.has(index)) { if (start === null) start = index; }
    else if (start !== null) { output.omit(reason, locator(start, index - 1), index - start); start = null; }
  }
}

function collector(format, title) {
  let blocks = [];
  const warnings = new Set(), omissions = new Map();
  function omit(reason, locator, count = 1) {
    if (!count) return;
    const item = omissions.get(reason) || { count: 0, spans: [], locations: new Set() };
    item.count += count;
    const previous = item.spans.at(-1);
    const before = previous?.last.match(/^(.*?)(\d+)$/), after = locator.match(/^(.*?)(\d+)$/);
    if (item.locations.has(locator)) { /* Aggregate repeated trimming at the same source exactly once. */ }
    else if (before && after && before[1] === after[1] && Number(after[2]) === Number(before[2]) + 1) previous.last = locator;
    else item.spans.push({ first: locator, last: locator });
    item.locations.add(locator);
    omissions.set(reason, item);
  }
  function add(block) {
    if (blocks.length >= RESOURCE_LIMITS.maxCandidates) {
      omit('source blocks (candidate resource limit)', block.locator);
      warnings.add('Extraction exceeds the bounded candidate resource limit.');
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
    if (blocks.length > MAX_BLOCKS) {
      const selected = new Set();
      const priorities = [...new Set(blocks.map(block => block.priority || 0))].sort((a, b) => b - a);
      for (const priority of priorities) {
        const group = blocks.map((block, index) => ({ block, index })).filter(item => (item.block.priority || 0) === priority);
        for (const index of representativeIndexes(group.length, MAX_BLOCKS - selected.size)) selected.add(group[index].index);
        if (selected.size === MAX_BLOCKS) break;
      }
      blocks.forEach((block, index) => { if (!selected.has(index)) omit('source blocks (1,000-block limit)', block.locator); });
      blocks = blocks.filter((_, index) => selected.has(index));
      warnings.add('Extraction exceeds the 1,000-block limit; headings, summaries, tables and representative ranges were prioritized.');
    }
    const evidenceIndex = Object.fromEntries(blocks.map(block => [block.locator, '']));
    const sourceChars = () => blocks.reduce((n, b) => n + (b.text?.length || 0) + (b.table || []).flat().reduce((m, cell) => m + cell.length, 0), 0);
    const omissionText = () => [...omissions].map(([reason, item]) => `${item.count} ${reason} omitted at ${item.spans.map(span => span.first === span.last ? span.first : `${span.first} through ${span.last}`).join('; ')}.`);
    let omitted = omissionText();
    // Budget metadata together with source text, so the contract cannot silently erase coverage.
    for (;;) {
      let excess = clean(title).length + sourceChars() + [...warnings].join('').length + omitted.join('').length - FILE_LIMITS.maxExtractionChars;
      if (excess <= 0) break;
      warnings.add('Extraction exceeds the 250,000-character limit.');
      // Trim the largest low-priority blocks first; retain all short summaries/table evidence.
      const ranked = blocks.map((block, index) => ({ index, priority: block.priority || 0,
        size: (block.text?.length || 0) + (block.table || []).flat().reduce((n, cell) => n + cell.length, 0) }))
        .sort((a, b) => a.priority - b.priority || b.size - a.size);
      for (const { index: i } of ranked) {
        if (excess <= 0) break;
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
  if (text.length > RESOURCE_LIMITS.maxXmlChars) throw new Error('XML resource character limit exceeded.');
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Unsafe XML entities are not supported.');
  // Scan tags before constructing a recursive object tree; bound work for both parser and traversal.
  let depth = 0, nodes = 0;
  for (const match of text.matchAll(/<\/?[A-Za-z_][^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith('</')) depth--;
    else { if (++nodes > RESOURCE_LIMITS.maxXmlNodes) throw new Error('XML node resource limit exceeded.'); if (!tag.endsWith('/>')) depth++; }
    if (depth > RESOURCE_LIMITS.maxXmlDepth) throw new Error('XML nesting resource limit exceeded.');
  }
  try {
    const document = xml.xml2js(text, { compact: false, trim: false });
    if (children(document).length !== 1) throw new Error();
    return document;
  } catch { throw new Error('Malformed OOXML document.'); }
}

function preflightZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0 || end + 22 > bytes.length || view.getUint32(end, true) !== 0x06054b50) throw new Error('Malformed archive directory.');
  if (view.getUint16(end + 10, true) === 0xffff || view.getUint32(end + 12, true) === 0xffffffff || view.getUint32(end + 16, true) === 0xffffffff || end >= 20 && view.getUint32(end - 20, true) === 0x07064b50) throw new Error('ZIP64 archives are not supported within safe resource limits.');
  const expected = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true), directoryStart = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || directoryStart + directorySize !== end || end + 22 + view.getUint16(end + 20, true) !== bytes.length) throw new Error('Malformed or multi-volume archive.');
  let entries = 0, expanded = 0;
  // Central-directory sizes are checked before any decompression (including ZIP-bomb inputs).
  for (let offset = directoryStart; offset < end;) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Malformed archive entry.');
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
    if (++entries > 4096 || size > 20 * 1024 * 1024 || expanded > 60 * 1024 * 1024) throw new Error('Archive exceeds safe expanded resource limits.');
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!entries || entries !== expected) throw new Error('Malformed archive.');
}

async function openArchive(bytes, dependencies) {
  preflightZip(bytes);
  const [JSZip, xml] = await Promise.all([dependency('JSZip', dependencies), dependency('xml', dependencies)]);
  let zip;
  try { zip = await JSZip.loadAsync(bytes); } catch { throw new Error('Malformed or encrypted archive.'); }
  const cache = new Map();
  let parsedXmlChars = 0;
  async function read(path) {
    if (!zip.file(path)) throw new Error('Malformed OOXML: a required document part is missing.');
    if (zip.file(path)._data?.uncompressedSize > RESOURCE_LIMITS.maxXmlChars) throw new Error('XML resource character limit exceeded.');
    if (!cache.has(path)) {
      const text = await new Promise((resolve, reject) => {
        const chunks = [];
        let length = 0;
        const stream = zip.file(path).internalStream('string');
        stream.on('data', chunk => {
          length += chunk.length;
          if (length > RESOURCE_LIMITS.maxXmlChars || parsedXmlChars + length > 8_000_000) {
            stream.pause(); chunks.length = 0; reject(new Error('Expanded XML resource character limit exceeded.'));
          } else chunks.push(chunk);
        }).on('error', () => reject(new Error('Malformed archive content.')))
          .on('end', () => resolve(chunks.join(''))).resume();
      });
      parsedXmlChars += text.length;
      cache.set(path, parseXml(text, xml));
    }
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
    const outlinePages = new Set();
    const queue = [...(await document.getOutline?.() || [])];
    let inspected = 0;
    const outlineEntries = [];
    while (queue.length && inspected++ < 512) {
      const item = queue.shift(); outlineEntries.push(item);
      if (item.items) queue.push(...item.items.slice(0, 512 - inspected));
    }
    outlineEntries.sort((a, b) => Number(/summary|conclusion|recommendation|overview/i.test(b.title || '')) - Number(/summary|conclusion|recommendation|overview/i.test(a.title || '')));
    for (const item of outlineEntries.slice(0, 24)) {
      const dest = typeof item.dest === 'string' ? await document.getDestination?.(item.dest) : item.dest;
      if (!Array.isArray(dest)) continue;
      const index = Number.isInteger(dest[0]) ? dest[0] : await document.getPageIndex?.(dest[0]);
      if (Number.isInteger(index) && index >= 0 && index < document.numPages) outlinePages.add(index);
    }
    const remaining = Array.from({ length: document.numPages }, (_, index) => index).filter(index => !outlinePages.has(index));
    const selected = new Set([...outlinePages, ...representativeIndexes(remaining.length, RESOURCE_LIMITS.maxPages - outlinePages.size).map(index => remaining[index])].sort((a, b) => a - b));
    if (selected.size < document.numPages) {
      omitUnselected(document.numPages, selected, (start, end) => `page:${start + 1}${start === end ? '' : `-${end + 1}`}`, output, 'unparsed pages (representative parser limit)');
      output.warnings.add('PDF parsing is limited to 120 representative early, middle and late pages.');
    }
    for (const index of selected) {
      const number = index + 1;
      const page = await document.getPage(number);
      try {
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        if (text) output.add({ locator: `page:${number}`, text, priority: outlinePages.has(index) ? 10 : 0 });
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
  const used = new Map();
  let section = 'section:Document', priority = 0, tableNumber = 0, paragraphGroup = 1;
  // A bounded metadata pass records original section/table identity before selecting content.
  const descriptors = children(body).map((node, index) => {
    const style = attribute(descendants(node, 'pStyle')[0], 'val') || '';
    const heading = localName(node) === 'p' && (/^Heading\s*\d+$/i.test(style) || descendants(node, 'outlineLvl').length);
    if (heading) {
      const title = clean(runText(node)).trim().slice(0, 440) || 'Untitled';
      const count = (used.get(title) || 0) + 1;
      used.set(title, count);
      section = `section:${title}${count > 1 ? ` (${count})` : ''}`;
      priority = /summary|conclusion|recommendation|overview/i.test(title) ? 10 : 3;
      tableNumber = 0; paragraphGroup = 1;
    }
    const table = localName(node) === 'tbl';
    const locator = table ? `${section}/table:${++tableNumber}` : paragraphGroup === 1 ? section : `${section}/paragraphs:${paragraphGroup}`;
    if (table) paragraphGroup++;
    return { node, index, locator, priority: table ? 5 : heading || priority === 10 ? priority : 0 };
  });
  const selected = new Set();
  const priorityBudget = Math.floor(RESOURCE_LIMITS.maxCandidates * 2 / 3);
  if (descriptors.length > RESOURCE_LIMITS.maxCandidates) {
    for (const level of [10, 5, 3]) {
      const group = descriptors.filter(item => item.priority === level);
      for (const index of representativeIndexes(group.length, Math.max(0, priorityBudget - selected.size))) selected.add(group[index].index);
    }
  }
  const remaining = descriptors.filter(item => !selected.has(item.index));
  for (const index of representativeIndexes(remaining.length, RESOURCE_LIMITS.maxCandidates - selected.size)) selected.add(remaining[index].index);
  if (selected.size < descriptors.length) {
    omitUnselected(descriptors.length, selected, (start, end) => `document-node:${start + 1}-${end + 1}`, output, 'unparsed document nodes');
    output.warnings.add('Word extraction prioritizes headings, summaries and populated tables plus representative early, middle and late document nodes.');
  }
  let pending = null;
  const usedLocators = new Set();
  const flush = () => {
    if (!pending) return;
    let locator = pending.locator;
    if (usedLocators.has(locator)) locator += `/nodes:${pending.first + 1}-${pending.last + 1}`;
    usedLocators.add(locator);
    output.add({ locator, text: pending.parts.join('\n'), priority: pending.priority });
    pending = null;
  };
  const safeParagraphs = node => children(node).flatMap(child =>
    ['object', 'oleObject', 'OLEObject'].includes(localName(child)) ? []
      : [...(localName(child) === 'p' ? [child] : []), ...safeParagraphs(child)]);
  for (const index of [...selected].sort((a, b) => a - b)) {
    const item = descriptors[index], { node, locator } = item;
    const objects = descendants(node, 'object').length + (localName(node) === 'object' ? 1 : 0);
    if (objects) { output.omit('embedded objects', locator, objects); output.warnings.add('Embedded Word objects were omitted from text extraction.'); }
    if (localName(node) === 'p') {
      const text = runText(node);
      if (!text.trim()) continue;
      if (pending && (pending.locator !== locator || pending.last + 1 !== index)) flush();
      if (!pending) pending = { locator, first: index, last: index, parts: [], priority: item.priority };
      pending.parts.push(text); pending.last = index; pending.priority = Math.max(pending.priority, item.priority);
    } else if (localName(node) === 'tbl') {
      flush();
      const table = children(node, 'tr').map(row => children(row, 'tc').map(cell => safeParagraphs(cell).map(runText).join('\n')));
      output.add({ locator, table, priority: 5 });
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
  const selected = new Set(representativeIndexes(slides.length, RESOURCE_LIMITS.maxPages));
  if (selected.size < slides.length) {
    omitUnselected(slides.length, selected, (start, end) => `slide:${start + 1}-${end + 1}`, output, 'unparsed slides (representative parser limit)');
    output.warnings.add('PowerPoint parsing is limited to 120 representative early, middle and late slides.');
  }
  for (const i of selected) {
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
  const allCells = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (sheet['!type'] === 'macro') throw new Error('Unsafe macro sheet.');
    const addresses = Object.keys(sheet).filter(address => /^[A-Z]+[1-9]\d*$/.test(address));
    if (allCells.length + addresses.length > RESOURCE_LIMITS.maxSheetCells) throw new Error('Spreadsheet parser cell resource limit exceeded.');
    const sorted = addresses.map(address => ({ address, ...XLSX.utils.decode_cell(address) })).sort((a, b) => a.r - b.r || a.c - b.c);
    for (const item of sorted) {
      const cell = sheet[item.address];
      if (cell.v != null && cell.v !== '' || cell.w) allCells.push({ ...item, name, index: allCells.length });
      else if (cell.f) { output.omit('formula cells without cached values', `sheet:${name}!${item.address}`); output.warnings.add('Formula cells without cached values were omitted; formulas are never evaluated.'); }
    }
  }
  const selected = new Set(representativeIndexes(allCells.length, FILE_LIMITS.maxSpreadsheetCells));
  const anchors = new Set([0, Math.floor((allCells.length - 1) / 2), allCells.length - 1]);
  if (selected.size < allCells.length) output.warnings.add('Spreadsheet exceeds the 50,000 non-empty cell limit; representative early, middle and late ranges were selected.');
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const addresses = allCells.filter(item => item.name === name);
    let pending = null, rowsSeen = 0;
    const flush = () => {
      if (!pending) return;
      const start = XLSX.utils.encode_cell({ r: pending.first, c: pending.start });
      const end = XLSX.utils.encode_cell({ r: pending.last, c: pending.end });
      output.add({ locator: `sheet:${name}!${start}${start === end ? '' : `:${end}`}`, table: pending.table, priority: pending.priority });
      pending = null;
    };
    let currentRow = null, values = [], columns = [], rowPriority = 0;
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
          pending.table.push(row); pending.last = currentRow; pending.priority = Math.max(pending.priority, rowPriority);
        } else { flush(); pending = { first: currentRow, last: currentRow, start: first, end: last, table: [row], priority: rowPriority }; }
        if (rowsSeen <= 100) flush();
      }
      values = []; columns = []; rowPriority = 0;
    }
    for (const item of addresses) {
      if (!selected.has(item.index)) { output.omit('non-empty cells', `sheet:${name}!${item.address}`); continue; }
      const cell = sheet[item.address];
      // SheetJS reads cached/displayed values; no formula evaluator is invoked.
      const value = clean(cell.w ?? (cell.v == null ? '' : XLSX.utils.format_cell(cell)));
      if (!value) {
        if (cell.f) { output.omit('formula cells without cached values', `sheet:${name}!${item.address}`); output.warnings.add('Formula cells without cached values were omitted; formulas are never evaluated.'); }
        continue;
      }
      if (currentRow !== item.r) { emitRow(); currentRow = item.r; }
      columns.push(item.c); values.push(value); if (anchors.has(item.index)) rowPriority = 3;
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
function parseCsv(text, delimiter, { maxRows = RESOURCE_LIMITS.maxCsvRecords, metadataOnly = false } = {}) {
  const rows = [];
  let cells = [], value = '', quoted = false, closed = false, line = 1, start = 1, recordStart = 0;
  function row(endOffset) {
    cells.push(value);
    if (cells.some(cell => cell.trim())) rows.push(metadataOnly
      ? { start, end: line, width: cells.length, offset: recordStart, length: endOffset - recordStart }
      : { cells, start, end: line });
    cells = []; value = ''; closed = false;
  }
  for (let i = 0; i < text.length; i++) {
    if (value.length > 1_000_000 || cells.length > 10_000) throw new Error('CSV field or column parser resource limit exceeded.');
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else { value += char; if (char === '\n' || char === '\r' && text[i + 1] !== '\n') line++; }
    } else if (char === '"' && !value && !closed) quoted = true;
    else if (char === delimiter) { cells.push(value); value = ''; closed = false; }
    else if (char === '\n' || char === '\r') {
      row(i);
      if (rows.length >= maxRows) {
        if (maxRows === RESOURCE_LIMITS.maxCsvRecords && i < text.length - 1) throw new Error('CSV record parser resource limit exceeded.');
        return rows;
      }
      if (char === '\r' && text[i + 1] === '\n') i++; line++; start = line; recordStart = i + 1;
    }
    else { if (closed || char === '"') throw new Error('Malformed CSV quoting.'); value += char; }
  }
  if (quoted) throw new Error('Malformed CSV: an enclosed field is not closed.');
  if (value || cells.length) row(text.length);
  return rows;
}
function csvLocator(row) { return `row:${row.start}${row.start === row.end ? '' : `-${row.end}`}`; }
async function extractCsv(bytes, dependencies, output) {
  const text = decodeCsv(bytes, output).replace(/^\uFEFF/, '');
  // Delimiter candidates must parse correctly and have consistent widths across representative records.
  const candidates = [];
  for (const delimiter of [',', ';', '\t', '|']) {
    try {
      const rows = parseCsv(text, delimiter, { maxRows: 20 });
      const sample = rows.slice(0, 20);
      const width = sample[0]?.cells.length || 0;
      candidates.push({ delimiter, score: width > 1 ? sample.filter(row => row.cells.length === width).length * 100 + width : 0 });
    } catch { /* Another delimiter may legitimately appear inside the quoted field. */ }
  }
  if (!candidates.length) throw new Error('Malformed CSV quoting.');
  const delimiter = candidates.sort((a, b) => b.score - a.score)[0].delimiter;
  // One bounded metadata scan locates records. Decode only selected representative data records.
  const rows = parseCsv(text, delimiter, { metadataOnly: true });
  const selected = new Set([0, ...representativeIndexes(Math.max(0, rows.length - 1), FILE_LIMITS.maxCsvRows).map(index => index + 1)]);
  if (selected.size < rows.length) {
    omitUnselected(rows.length, selected, (start, end) => `row:${rows[start].start}${rows[start].start === rows[end].end ? '' : `-${rows[end].end}`}`, output, 'data rows');
    output.warnings.add('CSV exceeds the 20,000 data row limit; representative early, middle and late ranges were selected.');
  }
  let pending = null;
  const flush = () => { if (pending) output.add({ locator: csvLocator(pending), table: pending.table }); pending = null; };
  for (const i of selected) {
    if (!rows[i]) continue;
    const row = rows[i], locator = csvLocator(row);
    const sourceCells = parseCsv(text.slice(row.offset, row.offset + row.length), delimiter)[0]?.cells || [];
    const cells = sourceCells.slice(0, MAX_COLUMNS).map(value => {
      if (/^\s*[=+@]/.test(value) || /^\s*-(?!\d+(?:\.\d+)?\s*$)/.test(value)) {
        output.omit('formula-like CSV fields', locator); output.warnings.add('Formula-like CSV fields were removed.'); return '[formula omitted]';
      }
      return clean(value);
    });
    if (sourceCells.length > MAX_COLUMNS) { output.omit('CSV columns beyond 1,000', locator, sourceCells.length - MAX_COLUMNS); output.warnings.add('CSV columns exceed the safe table width.'); }
    if (i === 0) { output.add({ locator, text: cells.join('\t') }); continue; }
    if (i <= 100) output.add({ locator, table: [cells] });
    else if (pending && pending.table.length < 100 && pending.end + 1 === row.start) { pending.end = row.end; pending.table.push(cells); }
    else { flush(); pending = { start: row.start, end: row.end, table: [cells] }; }
  }
  flush();
}

const ADAPTERS = Object.freeze({ pdf: extractPdf, docx: extractDocx, xlsx: extractWorkbook, xls: extractWorkbook, csv: extractCsv, pptx: extractPptx });

function runParserWorker(file, bytes, dependencies) {
  const worker = dependencies.workerFactory ? dependencies.workerFactory() : new Worker(new URL('./copilot-file-extraction-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const timeout = Math.max(1, Math.min(RESOURCE_LIMITS.workerMs, Number(dependencies.workerTimeoutMs) || RESOURCE_LIMITS.workerMs));
    const finish = (error, result) => { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => finish(new Error('File extraction exceeded the 15-second parser deadline.')), timeout);
    worker.onmessage = event => event.data?.ok ? finish(null, event.data.result) : finish(new Error(event.data?.error || 'File parser failed.'));
    worker.onerror = () => finish(new Error('File parser worker failed.'));
    try { worker.postMessage({ name: file.name, type: file.type, bytes: bytes.buffer }, [bytes.buffer]); }
    catch { finish(new Error('Unable to start the file parser worker.')); }
  });
}

export async function extractCopilotFile(file, dependencies = {}) {
  if (!file || Array.isArray(file) || typeof file.arrayBuffer !== 'function') throw new Error('Select one supported file.');
  if (file.size > FILE_LIMITS.maxFileBytes) throw new Error('The file exceeds the 15 MB limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const prefix = bytes.subarray(0, 32);
  const signature = Array.from(prefix, value => value.toString(16).padStart(2, '0')).join('');
  const validation = validateCopilotFile({ name: file.name, size: bytes.length, type: file.type, signature });
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  // Production browser parsing runs off the UI thread with a hard termination deadline.
  // Injected library tests execute inline; the worker itself has no document and cannot recurse.
  if (typeof document !== 'undefined' && !Object.keys(dependencies).length && typeof Worker === 'undefined') {
    throw new Error('Browser module worker support is required for safe file parsing.');
  }
  if (dependencies.workerFactory || typeof document !== 'undefined' && !Object.keys(dependencies).length) {
    return runParserWorker(file, bytes, dependencies);
  }
  const output = collector(validation.format, file.name);
  await ADAPTERS[validation.format](bytes, dependencies, output, validation.format);
  return output.finish();
}
