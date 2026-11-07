const test=require('node:test'),assert=require('node:assert/strict');
const V=require('../message-evidence.js'),C=require('../channel-scripts.js'),E=require('../message-editor.js'),S=require('../message-studio.js');
const now=Date.parse('2026-11-07T12:00:00Z'),studio={...S.seed(),essentials:{sender:'Robin Lane',company:'Seller Works',offer:'steel structures'}};
const context={essentials:studio.essentials,sellerWebsite:'https://seller.example/',firstName:'Alex',buyerCompany:'Buyer Mining',buyerDomain:'buyer.example',trigger:{url:'https://buyer.example/news/contract',title:'Building contract',verification:'source_verified',excerpt:'The agreement takes us from planning to construction.'}};
const article='Buyer Mining signed an agreement with BuildCo for its processing plant in Northport. Construction is planned for spring 2026, with building completion expected at the end of 2027. BuildCo is responsible for groundworks and the structural steel frame.';
const script={id:'email:curiosity',channel:'email',body:'Hi [First name]. [project location]. [verified completion year]. [verified years of experience]. [result]'};
const resolve=ctx=>C.fillScript(script,C.readableValues(studio,E.prepareFactContext(studio,ctx)));
test('full selected article and seller evidence fill slots while building completion never becomes operational year',async()=>{
 const calls=[],progress=[];
 const result=await V.researchTemplate({script,context,resolve,now,onProgress:value=>progress.push(value),read:async url=>{calls.push(url);return {markdown:url.includes('buyer.')?article:'Our team has more than thirty years of experience in the metalworking industry.\n_ga | google.com | 2 years'};},search:async()=>[]});
 assert.equal(calls[0],context.trigger.url);assert.equal(result.reads,2);assert.ok(result.searches<=2);
 const values=C.readableValues(studio,E.prepareFactContext(studio,{...context,buyerFactEvidence:result.sources.filter(r=>r.owner==='buyer'),sellerEvidence:result.sources.filter(r=>r.owner==='seller')}));
 assert.equal(values.projectLocation,'Northport');assert.equal(values.openingYear,'');assert.match(values.experienceDuration,/thirty years/);
 assert.ok(result.missing.includes('verified completion year'));assert.ok(result.missing.includes('result'));assert.ok(!result.missing.includes('project location'));assert.ok(progress.some(p=>p.includes('selected trigger')));
});
test('bounded followups read search candidates rather than accepting snippets or unrelated hosts',async()=>{
 const calls=[];const result=await V.researchTemplate({script,context,resolve:()=>({missing:['project location','certifications']}),now,read:async url=>{calls.push(url);return {markdown:'Verified company article with enough content for extraction. '+Array.from({length:10},(_,i)=>`[Project](${new URL('/projects/'+i,url)})`).join('\n')};},search:async query=>Array.from({length:10},(_,i)=>({url:'https://'+(query.includes('buyer.example')?'buyer.example':'seller.example')+'/search/'+i,description:'Never accept 99 years from a snippet'})).concat({url:'https://foreign.example',markdown:'Invented claim'})});
 assert.equal(result.reads,8);assert.ok(result.searches<=2);assert.equal(calls.length,8);assert.ok(result.sources.every(r=>!r.text.includes('99 years')));assert.ok(calls.every(url=>!url.includes('foreign')));
});
test('cache is scoped to template and context, expires, and does not replay completed research',async()=>{
 const options={script,context,resolve:()=>({missing:[]}),now,read:async()=>({markdown:article}),search:async()=>[]};
 const result=await V.researchTemplate(options);let reads=0;
 assert.equal((await V.researchTemplate({...options,cached:result,read:async()=>{reads++;return {markdown:article};}})).reused,true);assert.equal(reads,0);
 assert.equal((await V.researchTemplate({...options,now:now+25*3600000,cached:result})).reused,undefined);
 assert.equal((await V.researchTemplate({...options,context:{...context,buyerName:'Different buyer'},cached:result})).reused,undefined);
});
test('failed reads retain honest receipts and known facts, never certify a snippet',async()=>{
 const result=await V.researchTemplate({script,context,resolve:()=>({missing:['project location']}),now,read:async()=>{throw Error('Source unavailable');},search:async()=>[{url:context.trigger.url,description:article}]});
 assert.equal(result.status,'incomplete');assert.equal(result.sources.length,0);assert.ok(result.receipts.some(r=>r.kind==='read'&&!r.ok));assert.deepEqual(result.missing,['project location']);
});
test('cancelled research never applies late source content',async()=>{
 const controller=new AbortController();await assert.rejects(V.researchTemplate({script,context,resolve,now,signal:controller.signal,read:async()=>{controller.abort();return {markdown:article};},search:async()=>[]}),{name:'AbortError'});
});
test('saved full page read is reused, extracted short quotes are read in full',async()=>{
 let reads=0;const source={url:context.trigger.url,text:article,sourceRead:true,fullSourceRead:true,extractedAt:new Date(now-1000).toISOString()};
 const options={script,context:{...context,buyerFactEvidence:[source]},resolve:()=>({missing:[]}),now,read:async()=>{reads++;return {markdown:article};},search:async()=>[]};
 assert.equal((await V.researchTemplate(options)).reads,0);assert.equal(reads,0);
 await V.researchTemplate({...options,context:{...options.context,buyerFactEvidence:[{...source,fullSourceRead:false}]}});assert.equal(reads,1);
});
test('an official article may supply its linked PDF, while unrelated external pages remain excluded',async()=>{
 const calls=[];const result=await V.researchTemplate({script,context,resolve:()=>({missing:['project location']}),now,read:async url=>{calls.push(url);return {markdown:url===context.trigger.url?'Official project announcement. [Full release](https://documents.example/release.pdf) [Unrelated project](https://other.example/project)':article};},search:async()=>[]});
 assert.ok(calls.includes('https://documents.example/release.pdf'));assert.ok(!calls.includes('https://other.example/project'));
 const pdf=result.sources.find(r=>r.url.endsWith('.pdf'));assert.equal(pdf.linkedFrom,context.trigger.url);assert.match(E.buyerFactText({...context,buyerFactEvidence:[pdf]}),/Northport/);
});
test('a deadline preserves completed evidence receipts without applying late content',async()=>{
 const controller=new AbortController();let calls=0;try{await V.researchTemplate({script,context,resolve,now,signal:controller.signal,read:async()=>{if(++calls===2)controller.abort();return {markdown:article};},search:async()=>[]});assert.fail('Expected cancellation');}catch(error){assert.equal(error.name,'AbortError');assert.equal(error.partialResearch.sources.length,1);assert.equal(error.partialResearch.sources[0].url,context.trigger.url);assert.equal(error.partialResearch.status,'incomplete');}
});
