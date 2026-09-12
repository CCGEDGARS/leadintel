import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '../../customer/vendor/file-analysis/xlsx-0.20.3.mjs';
import JSZip from '../../customer/vendor/file-analysis/jszip-3.10.1.mjs';
import xml from '../../customer/vendor/file-analysis/xml-js-1.6.11.mjs';
import {extractCopilotFile} from '../../customer/copilot-file-extractors.js';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';
import {validateUploadedFile} from '../src/copilot-file-security.js';
import {runtime,uploadRequest} from './helpers/copilot-runtime.mjs';
const dependencies={XLSX,JSZip,xml};
const types={xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel'};
function workbook(rows,format='xlsx'){
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'Data');
  return new File([XLSX.write(book,{type:'array',bookType:format==='xls'?'biff8':format,compression:false})],`safe.${format}`,{type:types[format]});
}
async function upload(file,document,env=runtime()){
  const response=await handleCopilotFileRoute(uploadRequest({name:file.name,type:file.type,bytes:new Uint8Array(await file.arrayBuffer()),document}),env);
  return {response,env};
}
for(const format of ['xlsx','xls'])test(`real ${format} with 20,001 populated rows is not subject to the CSV row cap`,async()=>{
  const file=workbook(Array.from({length:20001},()=>['x']),format),document=await extractCopilotFile(file,dependencies);
  assert.equal(document.counts.nonEmptyCells,20001);assert.equal(document.counts.characters,20001);assert.equal(document.coverage.complete,true);
  const {response,env}=await upload(file,document);assert.equal(response.status,201,await response.text());
  assert.equal(env.DB.sqlite.prepare('SELECT cell_count FROM copilot_file_extractions').get().cell_count,20001);
});
for(const format of ['xlsx','xls'])test(`real ${format} whitespace-only displayed cells use adapter nonempty semantics`,async()=>{
  const file=workbook([[' '],['\t'],['value']],format),document=await extractCopilotFile(file,dependencies);
  assert.equal(document.counts.nonEmptyCells,3);assert.equal(document.counts.characters,7);
  const {response,env}=await upload(file,document);assert.equal(response.status,201,await response.text());
  assert.equal(env.DB.sqlite.prepare('SELECT cell_count FROM copilot_file_extractions').get().cell_count,3);
});
test('real Windows-1252 CSV extraction uploads with accented text and smart punctuation intact',async()=>{
  const bytes=Buffer.from('name,note\r\nCaf\xe9,\x93quoted\x94 \x80\r\n','latin1');
  const file=new File([bytes],'cp1252.csv',{type:'text/csv'}),document=await extractCopilotFile(file);
  assert.match(document.warnings.join(' '),/Windows-1252/);assert.equal(document.blocks[1].table[0][0],'Café');assert.equal(document.blocks[1].table[0][1],'“quoted” €');
  const {response}=await upload(file,document);assert.equal(response.status,201,await response.text());
  const validation=await validateUploadedFile({bytes,name:file.name,headers:new Headers({'content-type':file.type})});assert.equal(validation.encoding,'windows-1252');
});
