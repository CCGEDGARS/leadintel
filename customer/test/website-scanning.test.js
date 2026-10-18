const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../website-scanning.js');
const page={url:'https://ranking.example/top50',text:'Top exporters. Alpha Tools makes tools. Jane Smith leads Beta Foods. Gamma imports consumer products.',links:['https://alpha.example']};
test('extracts grounded companies, deduplicates and rejects invented names and list-host websites',()=>{
 const rows=S.parseExtraction({companies:[{name:'Alpha Tools',website:'https://alpha.example',quote:'Alpha Tools makes tools.',fit:'match'},{name:'Alpha Tools',quote:'Alpha Tools makes tools.'},{name:'Imaginary',quote:'Alpha Tools makes tools.'},{name:'Beta Foods',website:page.url,quote:'Jane Smith leads Beta Foods.',person:'Jane Smith'}]},page);
 assert.equal(rows.length,2);assert.equal(rows[0].identityStatus,'unchecked');assert.equal(rows[1].website,'');assert.equal(rows[1].person,'Jane Smith');assert.equal(rows[0].sourceUrl,page.url);
});
test('unsafe URLs, credentials, IPs and social/directory destinations cannot become official identities',()=>{
 for(const url of ['javascript:alert(1)','http://localhost/x','https://127.0.0.1','http://10.0.0.2','https://user:secret@example.com','file:///tmp/a'])assert.equal(S.safeUrl(url),'');
 assert.equal(S.companyWebsite('https://linkedin.com/company/a',page.url),'');
});
test('identity verification requires company evidence and excludes unrelated search results',()=>{
 assert.equal(S.assessIdentity({name:'Alpha Tools'}, {url:'https://alpha.example',title:'Alpha Tools | Home',text:'Alpha Tools manufactures equipment.'}).verified,true);
 assert.equal(S.assessIdentity({name:'Beta Foods'}, {url:'https://alpha.example',title:'Alpha Tools | Home',text:'Tools and machinery'}).verified,false);
});
test('fit remains an assessment; unknown rows are not silently included in matching-only selection',()=>{
 const rows=S.parseExtraction({companies:[{name:'Alpha Tools',quote:'Alpha Tools makes tools.',fit:'unknown'},{name:'Gamma',quote:'Gamma imports consumer products.',fit:'exclude'}]},page);
 assert.equal(S.selectedRows(rows,{fitOnly:true}).length,0);assert.equal(S.selectedRows(rows).length,2);
});
test('snapshot limits source text and rows and never restores an unfinished scan as running',()=>{
 const snapshot=S.normalizeSnapshot({status:'running',rows:Array.from({length:70},(_,i)=>({id:String(i),name:'Company '+i,sourceUrl:page.url,quote:'evidence',selected:true})),text:'x'.repeat(500000)});
 assert.equal(snapshot.rows.length,50);assert.equal(snapshot.status,'interrupted');assert.equal(snapshot.text,undefined);
});
test('runner returns extracted rows, checks identities with search and preserves unresolved rows',async()=>{
 const calls=[];const r=S.createRunner({scrape:async url=>url===page.url?page:{url,title:'Alpha Tools',text:'Alpha Tools manufactures equipment'},generate:async()=>({companies:[{name:'Alpha Tools',quote:'Alpha Tools makes tools.'},{name:'Beta Foods',quote:'Jane Smith leads Beta Foods.'}]}),search:async name=>{calls.push(name);return name.includes('Alpha')?[{url:'https://alpha.example',title:'Alpha Tools'}]:[];}});
 const result=await r.scan(page.url,{seller:{},limit:50});assert.equal(result.rows.length,2);assert.equal(calls.length,0);
 const checked=await r.verify(result.rows);assert.equal(checked[0].identityStatus,'verified');assert.equal(checked[1].identityStatus,'unresolved');
});
test('runner cancels providers that ignore abort and never accepts late workspace results',async()=>{
 const controller=new AbortController();const r=S.createRunner({scrape:()=>new Promise(()=>{}),generate:async()=>({companies:[]})});const pending=r.scan(page.url,{signal:controller.signal});controller.abort();await assert.rejects(pending,/cancel|abort/i);
 const other=S.createRunner({scrape:async()=>page,generate:async()=>({companies:[]})});await assert.rejects(other.scan(page.url,{isCurrent:()=>false}),/changed/i);
});
test('a single company homepage can retain its own website, but a list publisher cannot',()=>{
 const page={url:'https://alpha.example',title:'Alpha Tools | Home',text:'Alpha Tools manufactures tools for industrial customers.'};
 const rows=S.parseExtraction({pageType:'company',companies:[{name:'Alpha Tools',website:page.url,quote:page.text,person:'Invented CEO'}]},page);assert.equal(rows[0].website,page.url+'/');assert.equal(rows[0].person,'');
});
test('AI-suggested domains absent from source evidence are discarded and directory profiles do not verify',()=>{
 const rows=S.parseExtraction({companies:[{name:'Alpha Tools',website:'https://invented.example',quote:'Alpha Tools makes tools.'}]},page);assert.equal(rows[0].website,'');
 assert.equal(S.assessIdentity({name:'Alpha Tools'},{url:'https://directory.example/companies/alpha',title:'Alpha Tools',text:'Alpha Tools makes tools'}).verified,false);
});
test('large sources and seller context stay inside the actual AI endpoint prompt limit',()=>{const prompt=S.buildPrompt({...page,text:'evidence '.repeat(20000),links:Array.from({length:300},(_,i)=>'https://example.com/'+i+'x'.repeat(100))},{notes:'x'.repeat(20000)},50);assert.ok(prompt.prompt.length<=80000);});
test('rankings above the scan ceiling explicitly report that additional companies may remain',async()=>{const companies=Array.from({length:60},(_,i)=>({name:'Exporter '+i,quote:'Exporter '+i+' manufactures tools.'})),text=companies.map(c=>c.quote).join(' ');const runner=S.createRunner({scrape:async()=>({url:page.url,text}),generate:async()=>({companies})});const result=await runner.scan(page.url);assert.equal(result.rows.length,50);assert.match(result.notice,/Maximum 50.*additional companies/);});
