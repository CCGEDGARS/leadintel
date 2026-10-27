import {generateText} from './ai-provider.js';
import {generateSkillModule} from './workspace-skill-generation.js';
import {boundedBookWork} from './book-processing.js';
import {skillFailure} from './workspace-skill-errors.js';
export async function compareBookProviders({workItems,credentials,fetchImpl=fetch,clock=()=>performance.now()}){
 const providers=['openai','anthropic','gemini'];
 if(!Array.isArray(credentials)||credentials.length!==3||providers.some(p=>credentials.filter(c=>c.provider===p&&c.apiKey&&c.model).length!==1))throw Error('Configure all three provider credentials and models before comparing.');
 if(!Array.isArray(workItems)||!workItems.length)throw Error('Readable book sections are required.');
 const indices=[...new Set([0,Math.floor(workItems.length/2),workItems.length-1])];
 const samples=indices.map(i=>workItems[i]),jobs=credentials.flatMap(c=>samples.map(w=>({credential:c,work:w}))),results=Array(jobs.length);
 await boundedBookWork(jobs.map((job,index)=>({...job,index})),async({credential,work,index})=>{
  const started=clock(),receipt={provider:credential.provider,model:credential.model,locations:work.chunk.locations,elapsedMs:0,usage:null};
  try{
   const module=await generateSkillModule({chunk:work.chunk,index:work.index,generate:async input=>{const value=await generateText({...input,provider:credential.provider,apiKey:credential.apiKey,model:credential.model,reasoningEffort:'low',responseFormat:'json',signal:AbortSignal.timeout(120000),fetchImpl});receipt.usage=value.usage||null;return value;}});
   results[index]={...receipt,status:'valid',module};
  }catch(error){results[index]={...receipt,status:'failed',errorCode:skillFailure(error,'generate_section').code};}
  results[index].elapsedMs=Math.max(0,Math.round(clock()-started));
 });
 return {version:1,sampleSections:samples.length,concurrency:3,semanticReview:'required',notes:'Valid means structural validation passed. Compare the saved methods against the source for omissions, unsupported claims and practical depth. Elapsed times are individual requests, not a full-book completion estimate. Failed requests may still be billed; missing usage is unknown, never zero.',results};
}
