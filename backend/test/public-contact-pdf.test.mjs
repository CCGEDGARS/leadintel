import test from 'node:test';import assert from 'node:assert/strict';import {fetchDirectPublicPage,readPublicBuyerPage} from '../src/service-integrations.js';
function pdf(text='Published business contact accounting@company.example'){
 const stream=`BT /F1 12 Tf 40 100 Td (${text}) Tj ET`,objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [4 0 R] >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 200] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let s='%PDF-1.4\n';const offsets=[0];for(const [i,obj]of objects.entries()){offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${obj}\nendobj\n`;}const pos=Buffer.byteLength(s);s+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`;return new TextEncoder().encode(s);
}
test('a public supplier PDF is read directly with no provider credential or enrichment call',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(String(url));return new Response(pdf(),{headers:{'Content-Type':'application/pdf'}})};
 try{const result=await readPublicBuyerPage({},'workspace','https://company.example/supplier.pdf');assert.match(result.data.markdown,/accounting@company\.example/);assert.equal(result.data.metadata.source,'direct-pdf');assert.equal(result.data.metadata.totalPages,1);assert.equal(result.data.metadata.sourceURL,'https://company.example/supplier.pdf');assert.deepEqual(calls,['https://company.example/supplier.pdf']);assert.equal(result.researchTrace[0].status,'succeeded');assert.ok(result.researchTrace.filter(x=>x.provider!=='direct').every(x=>x.status==='skipped'));}finally{globalThis.fetch=original;}
});
test('a claimed PDF with an invalid signature cannot become contact evidence',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('Invented address accounting@company.example',{headers:{'Content-Type':'application/pdf'}});
 try{await assert.rejects(fetchDirectPublicPage('https://company.example/supplier.pdf'),/PDF signature/);}finally{globalThis.fetch=original;}
});
