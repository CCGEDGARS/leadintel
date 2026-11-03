import test from 'node:test';import assert from 'node:assert/strict';
import {runDossierResearch} from '../src/company-dossier.js';
test('incremental dossier research resumes partial configured providers after each has started',async()=>{
 const company={company:'Acme Labs',domain:'acme.example'},connections=['openai','gemini'].map(provider=>({provider,model:'fixture'}));let unavailable=true,calls=0;
 const options={company,connections,maxProvidersPerRequest:1,search:async()=>{calls++;if(unavailable)throw Error('Temporary provider failure');return {web_search:true,results:[{url:'https://acme.example/team'}]};},read:async()=>({text:'Anna Berg is Operations Director at Acme Labs.'}),extract:async()=>({people:[{name:'Anna Berg',title:'Operations Director',sourceUrl:'https://acme.example/team',quote:'Anna Berg is Operations Director at Acme Labs.'}],facts:[],channels:[]})};
 const first=await runDossierResearch(options),second=await runDossierResearch({...options,prior:first});assert.equal(second.status,'partial');assert.equal(second.continuation,true,'Started providers are not completed providers');
 unavailable=false;const third=await runDossierResearch({...options,prior:second}),fourth=await runDossierResearch({...options,prior:third});assert.equal(fourth.status,'complete');assert.equal(fourth.continuation,false);assert.ok(calls<=8);
});
test('a failing first provider cannot starve a second provider recovering from a transient extraction error',async()=>{
 const company={company:'Acme Labs',domain:'acme.example'},connections=['openai','gemini'].map(provider=>({provider,model:'fixture'}));let prior,geminiExtractions=0;
 const options={company,connections,maxProvidersPerRequest:1,search:async c=>{if(c.provider==='openai')throw Error('Unavailable');return {web_search:true,results:[{url:'https://acme.example/team'}]};},read:async()=>({text:'Anna Berg is Operations Director at Acme Labs.'}),extract:async()=>{if(++geminiExtractions===1)throw Error('Transient extraction failure');return {people:[{name:'Anna Berg',title:'Operations Director',sourceUrl:'https://acme.example/team',quote:'Anna Berg is Operations Director at Acme Labs.'}]};}};
 for(let i=0;i<4;i++)prior=await runDossierResearch({...options,prior});
 assert.equal(geminiExtractions,2);assert.equal(prior.passes.find(p=>p.provider==='gemini').status,'complete');assert.equal(prior.status,'partial','A genuine primary-provider failure remains visible');
});
