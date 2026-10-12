import {selectWritingGuidance} from './writing-reference-analysis.js';
import {getWritingReference,writingReferenceRevision} from './writing-reference-store.js';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const words=text=>new Set(String(text||'').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);
export function chunkSections(source,sections){
 const passages=[];
 for(const [sectionIndex,section] of sections.entries()){
  if(typeof section.text!=='string'||!/^(page|line):\d+$/.test(section.location))continue;
  for(let offset=0;offset<section.text.length;offset+=1050){const text=section.text.slice(offset,offset+1200);if(text.trim())passages.push({id:`${source.id}:${source.revision}:${sectionIndex}:${offset}`,sourceId:source.id,revision:source.revision,filename:source.filename,role:source.role||'guidance',location:section.location,text});if(offset+1200>=section.text.length)break;}
 }
 return passages;
}
export async function retrieveAssistantSources(env,scope,{sourceRefs=[],query=''}){
 if(!scope?.workspaceId)fail('Authenticated workspace required',401);
 if(!Array.isArray(sourceRefs)||sourceRefs.length>3||new Set(sourceRefs.map(r=>r.id)).size!==sourceRefs.length)fail('Invalid source selection',400);
 const before=await writingReferenceRevision(env,scope),warnings=[],all=[],catalogues=[],instructions=[];
 for(const ref of sourceRefs){
  if(!ref||typeof ref.id!=='string'||!Number.isInteger(ref.revision))fail('Invalid source selection',400);
  const row=await getWritingReference(env,scope,ref.id);
  if(row.revision!==ref.revision)fail('Writing source changed. Refresh and ask again.');
  if(!row.active||row.status!=='Ready')fail('Selected source is not active and Ready');
  if(row.instruction)instructions.push({sourceId:row.id,instruction:row.instruction});
  if(row.catalogue_key){const catalogue=await env.WRITING_REFERENCES_BUCKET?.get(row.catalogue_key);if(catalogue){try{const data=JSON.parse(await catalogue.text());if(Array.isArray(data.techniques))row.techniques=data.techniques;}catch{warnings.push(`${row.filename}: learned techniques unavailable.`);}}else warnings.push(`${row.filename}: learned techniques unavailable.`);}
  catalogues.push(row);
  if(row.coverage?.unreadable)warnings.push(`${row.filename}: ${row.coverage.unreadable} unreadable pages/sections; only readable content is available.`);
  const object=await env.WRITING_REFERENCES_BUCKET?.get(row.text_key);
  if(!object){warnings.push(`${row.filename}: extracted text unavailable; no page passages from this source were used.`);continue;}
  let sections;try{sections=JSON.parse(await object.text()).sections;}catch{sections=null;}
  if(!Array.isArray(sections)){warnings.push(`${row.filename}: extracted text unavailable; no page passages from this source were used.`);continue;}
  all.push(...chunkSections(row,sections));
 }
 const queryWords=words(query),frequency=new Map();
 const indexed=all.map(p=>({p,tokens:words(p.text)}));for(const {tokens} of indexed)for(const token of tokens)frequency.set(token,(frequency.get(token)||0)+1);
 const ranked=indexed.map(({p,tokens})=>({p,score:[...queryWords].reduce((n,w)=>n+(tokens.has(w)?Math.log(1+indexed.length/(frequency.get(w)||1)):0),0)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
 const techniques=selectWritingGuidance({catalogues,query,maxCharacters:2200}).techniques;
 const passages=[];for(const {p} of ranked){if(passages.length===8)break;if(JSON.stringify({instructions,techniques,passages:[...passages,p]}).length>12000)continue;passages.push(p);}
 for(const ref of sourceRefs)if(!passages.some(p=>p.sourceId===ref.id)&&!warnings.some(w=>w.includes('unavailable')))warnings.push('No relevant passages found in a selected source. Try a more specific question.');
 if(await writingReferenceRevision(env,scope)!==before)fail('Writing references changed. Ask again.');
 return {referenceRevision:before,sourceRefs:sourceRefs.map(r=>({id:r.id,revision:r.revision})),instructions,techniques,passages,warnings};
}
