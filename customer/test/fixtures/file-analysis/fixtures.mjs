import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import xml from 'xml-js';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';

export const dependencies = { JSZip, XLSX, xml, pdfjs };
const mime = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
  csv: 'text/csv', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
export function file(name, bytes) {
  return new File([bytes], name, { type: mime[name.split('.').pop()] });
}
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export async function archive(entries) {
  const zip = new JSZip();
  for (const [path, text] of Object.entries(entries)) zip.file(path, text, { date: new Date('2020-01-01T00:00:00Z') });
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
}
export function pdf(pages = ['Overview', 'PDF_MARKER']) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  for (let i = 0; i < pages.length; i++) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    const stream = `BT /F1 12 Tf 72 720 Td (${pages[i].replace(/[\\()]/g, '\\$&')}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  let result = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(result.length); result += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = result.length;
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  result += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(result);
}
export function workbook(format = 'xlsx', rows = null, options = {}) {
  const wb = XLSX.utils.book_new();
  const name = format === 'xls' ? 'Legacy' : 'Pipeline';
  const ws = XLSX.utils.aoa_to_sheet(rows || (format === 'xls' ? [['Name'], ['XLS_MARKER']] : [['Name', 'Value'], [], ['', 'XLSX_MARKER']]));
  if (options.formula) ws.C3 = { t: 'n', v: 42, f: 'SUM(40,2)', z: '0.00' };
  if (options.formula) ws['!ref'] = 'A1:C3';
  XLSX.utils.book_append_sheet(wb, ws, name);
  return XLSX.write(wb, { bookType: format === 'xls' ? 'biff8' : format, type: 'array' });
}
const rel = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const types = main => `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${main}</Types>`;
export async function docx(body = null, extras = {}) {
  const p = text => `<w:p><w:r><w:t>${esc(text)}</w:t></w:r></w:p>`;
  return archive({
    '[Content_Types].xml': types('<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'),
    '_rels/.rels': `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${officeRel}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body ?? `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Commercial priorities</w:t></w:r></w:p>${p('DOCX_MARKER')}`}<w:sectPr/></w:body></w:document>`,
    ...extras
  });
}
export async function pptx() {
  const slide = text => `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  return archive({
    '[Content_Types].xml': types('<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'),
    '_rels/.rels': `<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${officeRel}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    'ppt/presentation.xml': `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="${officeRel}"><p:sldIdLst><p:sldId id="256" r:id="rIdA"/><p:sldId id="257" r:id="rIdB"/></p:sldIdLst></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<Relationships xmlns="${rel}"><Relationship Id="rIdA" Type="${officeRel}/slide" Target="slides/slide9.xml"/><Relationship Id="rIdB" Type="${officeRel}/slide" Target="slides/slide1.xml"/></Relationships>`,
    'ppt/slides/slide9.xml': slide('Overview'),
    'ppt/slides/slide1.xml': slide('PPTX_MARKER'),
    'ppt/slides/_rels/slide1.xml.rels': `<Relationships xmlns="${rel}"><Relationship Id="rIdN" Type="${officeRel}/notesSlide" Target="../notesSlides/notesSlide7.xml"/></Relationships>`,
    'ppt/notesSlides/notesSlide7.xml': slide('NOTES_MARKER')
  });
}
export async function fixtureFile(name) {
  const format = name.split('.').pop();
  const bytes = format === 'pdf' ? pdf() : format === 'docx' ? await docx() : format === 'pptx' ? await pptx()
    : format === 'csv' ? 'Name,Value\r\nA,1\r\nB,CSV_MARKER\r\n' : workbook(format);
  return file(name, bytes);
}
