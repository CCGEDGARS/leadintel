import {test} from 'node:test';import assert from 'node:assert/strict';import {runDossierResearch} from '../src/company-dossier.js';
const company={company:'Example Industrial',domain:'example.com'},connections=[{provider:'openai'},{provider:'gemini'}];
const callbacks={search:async()=>({web_search:true,results:[{url:'https://example.com/team'}]}),read:async()=>({text:'Alex Smith is Procurement Director at Example Industrial.'}),extract:async()=>({facts:[],channels:[],people:[{name:'Alex Smith',title:'Procurement Director',sourceUrl:'https://example.com/team',quote:'Alex Smith is Procurement Director at Example Industrial.',status:'current'}]})};
test('incremental dossier returns a checkpoint after one provider and resumes the second without repeating completed searches',async()=>{
 const searched=[];const options={company,connections,...callbacks,maxProvidersPerRequest:1,search:async(c,...args)=>{searched.push(c.provider);return callbacks.search(c,...args);}};
 const first=await runDossierResearch(options);assert.equal(first.passes.length,1);assert.equal(first.continuation,true);assert.equal(first.status,'partial');const firstCount=searched.filter(p=>p==='openai').length;
 const second=await runDossierResearch({...options,prior:first});assert.equal(second.status,'complete');assert.equal(Boolean(second.continuation),false);assert.equal(second.passes.length,2);assert.equal(searched.filter(p=>p==='openai').length,firstCount);assert.ok(searched.includes('gemini'));
});
test('a failed first provider yields the next request to an untried independent provider',async()=>{
 const first=await runDossierResearch({company,connections,...callbacks,maxProvidersPerRequest:1,search:async()=>{throw Error('provider unavailable');}});let used;
 await runDossierResearch({company,connections,...callbacks,prior:first,maxProvidersPerRequest:1,search:async(c,...args)=>{used=c.provider;return callbacks.search(c,...args);}});assert.equal(used,'gemini');
});
