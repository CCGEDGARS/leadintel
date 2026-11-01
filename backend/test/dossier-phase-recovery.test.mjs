import {test} from 'node:test';import assert from 'node:assert/strict';import {runDossierResearch} from '../src/company-dossier.js';
test('read evidence is extracted and saved before a later source batch stalls',async()=>{
 const company={company:'Example',domain:'example.com'},text='Alex Smith is Procurement Director at Example.';let saved;
 const result=await runDossierResearch({company,connections:[{provider:'openai'},{provider:'gemini'}],timeoutMs:80,pageTimeoutMs:1000,search:async(c,q)=>({web_search:true,results:Array.from({length:8},(_,i)=>({url:'https://example.com/page'+(i+(q.startsWith('CONTACT ROUTES')?8:0))}))}),read:async url=>Number(url.match(/page(\d+)/)[1])%8>=4?new Promise(()=>{}):{text},extract:async(c,prompt)=>({people:[{name:'Alex Smith',title:'Procurement Director',sourceUrl:'https://example.com/page0',quote:text}],facts:[],channels:[]}),onCheckpoint:async p=>{saved=p;}});
 assert.equal(result.status,'partial');assert.ok(saved.passes.every(p=>p.people.length===1&&p.extractedSources.length===8));
});
test('the client request budget covers two full provider passes',async()=>{
 const fs=await import('node:fs'),backend=fs.readFileSync(new URL('../src/company-dossier.js',import.meta.url),'utf8'),client=fs.readFileSync(new URL('../../customer/company-dossier-ui.js',import.meta.url),'utf8'),ui=fs.readFileSync(new URL('../../customer/discovery-ui.js',import.meta.url),'utf8');
 const pass=Number(backend.match(/timeoutMs=(\d+),pageTimeoutMs/)[1]),total=Number(client.match(/timeoutMs=(\d+),pollMs/)[1]);assert.ok(total>pass*2);assert.ok(ui.includes('timeoutMs:420000'));assert.ok(total<420000);
});
