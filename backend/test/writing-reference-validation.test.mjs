import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateWritingReference,mergeNativeExtraction} from '../src/writing-reference-validation.js';
import fs from 'node:fs';
test('unreadable PDF invokes native specialist and preserves original bytes and review provenance',async()=>{
 const bytes=new Uint8Array(fs.readFileSync(new URL('./fixtures/blank-native.pdf',import.meta.url)));let calls=0;
 const r=await validateWritingReference({bytes,mime:'application/pdf',filename:'scan.pdf',nativeExtractor:async input=>{calls++;assert.equal(input.bytes,bytes);return {sections:[{location:'page:1',text:'Visible technical table',extractionProvider:'gemini'}],characters:23,coverage:{total:1,readable:1,unreadable:0,extractionProvider:'gemini',requiresReview:true}};}});
 assert.equal(calls,1);assert.equal(r.bytes,bytes);assert.equal(r.extracted.coverage.requiresReview,true);
});
test('TXT never calls native PDF specialist',async()=>{let calls=0;await validateWritingReference({bytes:new TextEncoder().encode('Instructions'),mime:'text/plain',filename:'source.txt',nativeExtractor:()=>{calls++;}});assert.equal(calls,0);});
test('mixed PDF retains sufficient deterministic text even if Gemini offers a longer replacement',async()=>{const bytes=new Uint8Array(fs.readFileSync(new URL('./fixtures/mixed-native.pdf',import.meta.url)));const r=await validateWritingReference({bytes,mime:'application/pdf',filename:'mixed.pdf',nativeExtractor:async()=>({sections:[{location:'page:1',text:'invented '.repeat(300)},{location:'page:2',text:'Recovered scan',extractionProvider:'gemini'}]})});assert.match(r.extracted.sections[0].text,/KNOWN EXACT SOURCE/);assert.doesNotMatch(r.extracted.sections[0].text,/invented/);assert.equal(r.extracted.sections[1].extractionProvider,'gemini');});
test('cancelled native extraction cannot return partially accepted source',async()=>{const c=new AbortController(),bytes=new Uint8Array(fs.readFileSync(new URL('./fixtures/mixed-native.pdf',import.meta.url)));await assert.rejects(validateWritingReference({bytes,mime:'application/pdf',filename:'mixed.pdf',signal:c.signal,nativeExtractor:async()=>{c.abort();throw new DOMException('cancelled','AbortError');}}),{name:'AbortError'});});
test('recomputes text instead of trusting browser-supplied claims',async()=>{const bytes=new TextEncoder().encode('Ask one useful question.');const r=await validateWritingReference({bytes,mime:'text/plain',filename:'guide.txt',extracted:{sections:[{text:'invented results'}]}});assert.equal(r.extracted.sections[0].text,'Ask one useful question.');assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.equal(r.bytes,bytes);});
test('rejects executable filenames, MIME mismatches and empty guidance',async()=>{await assert.rejects(validateWritingReference({bytes:new TextEncoder().encode('x'),mime:'text/plain',filename:'guide.exe'}),/filename/i);await assert.rejects(validateWritingReference({bytes:new TextEncoder().encode(''),mime:'text/plain',filename:'guide.txt'}),/empty/i);});

test('merged native extraction cannot exceed the combined text limit',()=>{const extracted={sections:[{location:'page:1',text:'x'.repeat(1999900)}],coverage:{total:2,readable:1,unreadable:1},characters:1999900};assert.throws(()=>mergeNativeExtraction(extracted,{sections:[{location:'page:2',text:'y'.repeat(200)}]}),/2 million/);assert.equal(extracted.characters,1999900);assert.equal(extracted.coverage.unreadable,1);});

test('80% readable PDF skips native recovery of missing pages and needs no extraction review',async()=>{
 // Four readable pages and one blank page; enough deterministic text avoids the independent sparse-text check.
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R 10 0 R 12 0 R] /Count 5 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 for(let page=0;page<5;page++){
  const stream=page<4?'BT /F1 12 Tf 20 700 Td '+'(Readable writing advice.) Tj 0 -14 Td '.repeat(20)+'ET':'';
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+page*2} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
 }
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,object] of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const start=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 const bytes=new TextEncoder().encode(pdf);let calls=0;
 const result=await validateWritingReference({bytes,mime:'application/pdf',filename:'eighty-percent.pdf',nativeExtractor:async()=>{calls++;throw Error('Missing pages need no recovery at 80%');}});
 assert.equal(result.extracted.coverage.readable,4);assert.equal(result.extracted.coverage.unreadable,1);
 assert.equal(calls,0);assert.equal(result.extracted.coverage.requiresReview,undefined);assert.equal(result.bytes,bytes);
});
