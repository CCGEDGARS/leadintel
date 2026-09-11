import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateUploadedFile} from '../src/copilot-file-security.js';

const MB=1024*1024;
const bytes=value=>new TextEncoder().encode(value);
const digest=value=>createHash('sha256').update(value).digest('hex');
function zipEntry(name,content=''){
  const filename=bytes(name),body=bytes(content),out=new Uint8Array(30+filename.length+body.length);
  out.set([0x50,0x4b,0x03,0x04],0);out[26]=filename.length;out[28]=body.length;out.set(filename,30);out.set(body,30+filename.length);
  return out;
}
function upload({name='report.pdf',type='application/pdf',body=bytes('%PDF-1.7\nreport') }={}){
  return validateUploadedFile({headers:new Headers({'content-type':type}),bytes:body,name});
}

test('accepts a supported file only when extension, MIME and signature agree',async()=>{
  const body=bytes('%PDF-1.7\nreport');const value=await upload({body});
  assert.equal(value.ok,true);assert.equal(value.format,'pdf');assert.equal(value.sha256,digest(body));
  const mismatch=await upload({name:'report.pdf',type:'text/csv',body});
  assert.equal(mismatch.ok,false);assert.equal(mismatch.status,422);
});

test('accepts UTF-16 CSV bytes with the same CSV policy as UTF-8',async()=>{
  const body=new Uint8Array([0xff,0xfe,0x6e,0x00,0x61,0x00,0x6d,0x00,0x65,0x00]);
  const value=await upload({name:'accounts.csv',type:'text/csv',body});
  assert.equal(value.ok,true);assert.equal(value.format,'csv');assert.equal(value.encoding,'utf-16le');
});

test('rejects unsupported, oversized and malformed uploads without reflecting file data',async()=>{
  const unsupported=await upload({name:'macro.xlsm',type:'application/vnd.ms-excel.sheet.macroEnabled.12',body:zipEntry('[Content_Types].xml')});
  assert.deepEqual({ok:unsupported.ok,status:unsupported.status},{ok:false,status:415});
  const oversized=await upload({body:new Uint8Array(15*MB+1)});
  assert.deepEqual({ok:oversized.ok,status:oversized.status},{ok:false,status:413});
  const malformed=await upload({name:'not-a-pdf.pdf',body:bytes('not a pdf')});
  assert.deepEqual({ok:malformed.ok,status:malformed.status},{ok:false,status:422});
  assert.doesNotMatch(JSON.stringify(malformed),/not a pdf/);
});

test('rejects ZIP archive traversal and embedded executable content before persistence',async()=>{
  const traversal=await upload({name:'deck.pptx',type:'application/vnd.openxmlformats-officedocument.presentationml.presentation',body:zipEntry('../evil.txt')});
  assert.deepEqual({ok:traversal.ok,status:traversal.status},{ok:false,status:422});
  const executable=await upload({name:'sheet.xlsx',type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:zipEntry('xl/embeddings/payload.exe','MZ')});
  assert.deepEqual({ok:executable.ok,status:executable.status},{ok:false,status:422});
  const macro=await upload({name:'report.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',body:zipEntry('word/vbaProject.bin')});
  assert.deepEqual({ok:macro.ok,status:macro.status},{ok:false,status:422});
});
