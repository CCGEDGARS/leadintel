import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUploadedFile} from '../src/copilot-file-security.js';
import {zip,docxEntries,centralOffsets} from './helpers/copilot-zip.mjs';
const upload=(bytes,extension='docx')=>validateUploadedFile({bytes,name:`safe.${extension}`,headers:new Headers({'content-type':extension==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})});

for(const [name,body] of [['../evil.txt','x'],['word/vbaProject.bin','macro'],['word/payload.exe','MZ'],['C:/evil.txt','x'],['word/activeX/a.xml','x'],['word/embeddings/a.bin','x']])test(`rejects streamed later ZIP entry ${name}`,async()=>assert.equal((await upload(zip([...docxEntries(),[name,body]],{stream:true,compression:8}))).ok,false));
for(const compression of [0,8])test(`accepts safe MZ Logistics text in ${compression?'compressed':'stored'} OOXML`,async()=>assert.equal((await upload(zip(docxEntries('MZ Logistics'),{compression,stream:true}))).ok,true));
test('rejects executable bytes hidden under a harmless entry extension',async()=>assert.equal((await upload(zip([...docxEntries(),['word/media/logo.png',Buffer.from([0x4d,0x5a,0,1,2])]],{compression:8}))).ok,false));
for(const [name,mutate] of [
  ['central expansion bomb',(b,c)=>b.writeUInt32LE(0x7fffffff,c+24)],
  ['encryption',(b,c)=>{b.writeUInt16LE(1,c+8);b.writeUInt16LE(1,6);}],
  ['central/local method mismatch',(b,c)=>b.writeUInt16LE(8,c+10)],
  ['central/local filename mismatch',(b,c)=>{b[c+46]=0x78;}],
  ['central/local size mismatch',(b,c)=>b.writeUInt32LE(1,c+20)],
  ['CRC mismatch',(b,c)=>{b.writeUInt32LE(123,c+16);b.writeUInt32LE(123,14);}],
  ['truncated end record',(b)=>b.fill(0,b.length-22)],
])test(`rejects ZIP ${name}`,async()=>{const bytes=zip(docxEntries());mutate(bytes,centralOffsets(bytes)[0]);assert.equal((await upload(bytes)).ok,false);});
test('rejects missing OOXML content types',async()=>assert.equal((await upload(zip([['word/document.xml','<document/>']]))).ok,false));
test('rejects wrong OOXML format parts',async()=>assert.equal((await upload(zip([['[Content_Types].xml','<Types/>'],['xl/workbook.xml','<workbook/>']]))).ok,false));
test('rejects a valid high-expansion compressed archive',async()=>assert.equal((await upload(zip(docxEntries('x'.repeat(4_000_000)),{compression:8}))).ok,false));
for(const [name,bytes] of [
  ['MZ executable',Buffer.from([0x4d,0x5a,0,1,2])],['binary controls',Buffer.from([97,44,1,2,3])],
  ['invalid UTF-8',Buffer.from([97,44,0xc0,0xaf])],['odd UTF-16',Buffer.from([255,254,65])],
  ['UTF-16 isolated surrogate',Buffer.from([255,254,0,0xd8])],['UTF-16 NUL',Buffer.from([255,254,0,0])],
  ['malformed quoting',Buffer.from('name,"unclosed\n')]
])test(`rejects CSV ${name}`,async()=>assert.equal((await upload(bytes,'csv')).ok,false));
test('accepts UTF-8 and both UTF-16 byte orders with quoted multiline CSV',async()=>{const text='name,note\r\nMZ Logistics,"one\ntwo"\r\n';const le=Buffer.from(text,'utf16le'),be=Buffer.from(le).swap16();for(const bytes of [Buffer.from(text),Buffer.concat([Buffer.from([255,254]),le]),Buffer.concat([Buffer.from([254,255]),be])])assert.equal((await upload(bytes,'csv')).ok,true);});
test('accepts unused macro-enabled content-type defaults emitted by safe spreadsheet writers',async()=>{
  const entries=docxEntries();entries[0][1]='<Types><Default Extension="bin" ContentType="application/vnd.ms-excel.sheet.binary.macroEnabled.main"/></Types>';
  assert.equal((await upload(zip(entries))).ok,true);
});
test('accepts discussion of macroEnabled as ordinary document text',async()=>assert.equal((await upload(zip(docxEntries('The macroEnabled setting is disabled.')))).ok,true));
test('rejects macro-enabled default when an actual part uses that extension',async()=>{const entries=docxEntries();entries[0][1]='<Types><Default Extension="bin" ContentType="application/vnd.ms-excel.sheet.binary.macroEnabled.main"/></Types>';entries.push(['word/other.bin','payload']);assert.equal((await upload(zip(entries))).ok,false);});
test('rejects missing required package relationships',async()=>assert.equal((await upload(zip(docxEntries().filter(([name])=>name!=='_rels/.rels')))).ok,false));
test('rejects executable external relationships, including character references',async()=>{const entries=docxEntries();entries[1][1]='<Relationships><Relationship Target="https://example.test/a.&#x65;xe" TargetMode="External"/></Relationships>';assert.equal((await upload(zip(entries))).ok,false);});
