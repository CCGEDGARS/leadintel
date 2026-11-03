import test from 'node:test';
import assert from 'node:assert/strict';
import {runDossierResearch} from '../src/company-dossier.js';

function delay(ms,signal){
 return new Promise((resolve,reject)=>{
  let timer;
  const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(signal?.reason||new DOMException('Canceled','AbortError'));};
  if(signal?.aborted)return stop();
  timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms);
  signal?.addEventListener('abort',stop,{once:true});
 });
}

test('incremental dossier batches checkpoint all eight sources despite slow reads and extraction',{timeout:4000},async t=>{
 const company={company:'Acme Labs',domain:'acme.example'},connections=['openai','gemini'].map(provider=>({provider,model:'fixture'}));
 const urls=Array.from({length:8},(_,i)=>`https://acme.example/source-${i}`),searches=new Map(),dispatches=[],trace=[];
 let checkpoint,result,reads=0,extractions=0,canceledExtractions=0;
 for(let pass=0;pass<8;pass++){
  result=await runDossierResearch({
   company,connections,prior:checkpoint,maxProvidersPerRequest:1,timeoutMs:360,pageTimeoutMs:200,
   search:async(connection,query)=>{
    const key=connection.provider+'|'+query;searches.set(key,(searches.get(key)||0)+1);
    return {web_search:true,results:urls.map(url=>({url}))};
   },
   read:async(url,signal)=>{
    reads++;await delay(120,signal);
    return {url,text:`Acme Labs manufactures industrial equipment at production site ${urls.indexOf(url)}.`};
   },
   extract:async(_connection,prompt,signal)=>{
    extractions++;
    try{await delay(170,signal);}catch(error){canceledExtractions++;throw error;}
    const sources=JSON.parse(prompt.slice(prompt.lastIndexOf('Sources: ')+9));
    return {facts:sources.map(source=>({kind:'fit',text:source.passages[0].text,evidenceId:source.passages[0].id})),people:[],channels:[]};
   },
   onCheckpoint:async value=>{checkpoint=structuredClone(value);}
  });
  dispatches.push(result.receipts.at(-1).provider);
  trace.push({pass:pass+1,status:result.status,providers:result.passes.map(p=>({provider:p.provider,extractedSources:p.extractedSources.length,readReceipts:p.sourceReads.filter(r=>r.status==='succeeded').length}))});
  if(result.status==='complete')break;
 }
 t.diagnostic(JSON.stringify({reads,extractions,canceledExtractions,dispatches,trace}));
 assert.deepEqual(dispatches.slice(0,2),['openai','gemini'],'Each incomplete provider receives a slice before either is retried');
 assert.equal(searches.size,4,'Both providers execute the two required search families');
 assert.ok([...searches.values()].every(count=>count===1),'Completed search receipts survive every incremental checkpoint');
 assert.equal(result.status,'complete','Eight selected sources must make extraction progress across at most eight bounded passes');
 assert.equal(result.continuation,false);
 assert.equal(checkpoint.status,'complete','The saved checkpoint must contain the completed result');
 for(const provider of connections.map(c=>c.provider)){
  const saved=checkpoint.passes.find(p=>p.provider===provider);
  assert.equal(saved.status,'complete');
  assert.deepEqual([...new Set(saved.extractedSources)].sort(),urls.slice().sort(),provider+' must extract all eight original sources');
  assert.deepEqual([...new Set(saved.sourceReads.filter(r=>r.status==='succeeded').map(r=>r.url))].sort(),urls.slice().sort(),provider+' retains actual read receipts for every source');
  assert.deepEqual([...new Set(saved.facts.map(f=>f.sourceUrl))].sort(),urls.slice().sort(),provider+' retains validated extraction evidence from every source');
 }
});
