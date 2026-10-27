import {validateSkillModule} from './workspace-skill-generation.js';
export const BOOK_METHODS_VERSION='20261027-single-pass-v1';
export const skillModuleId=(index,part)=>part===0?`method-${index+1}`:`method-${index+1}-part-${part+1}`;
import {chunkWritingReference} from './writing-reference-analysis.js';

// Keep the original section indices for already completed legacy modules.
// Child boundaries are versioned by this persisted table's contract: 4k / 200.
export function skillWorkItems(extracted,completedLegacy=[]){
 const complete=new Set(completedLegacy.map(row=>Number(row.chunk_index)));
 return chunkWritingReference(extracted).flatMap((chunk,index)=>complete.has(index)
  ?[{index,part:-1,legacy:true}]
  :chunkWritingReference({sections:chunk.sections},{maxCharacters:4000,overlap:200})
    .map((small,part)=>({index,part,chunk:small,legacy:false})));
}

export const SKILL_SAVED_SECTIONS_SQL=`COALESCE(s.prepared_count,0)+(SELECT count(*) FROM workspace_skill_chunks c WHERE c.skill_id=s.id)+(SELECT count(*) FROM workspace_skill_parts p WHERE p.skill_id=s.id)`;
export const SKILL_OUTPUTS_SQL=`SELECT chunk_index,-1 AS part_index,object_key FROM workspace_skill_chunks WHERE skill_id=? UNION ALL SELECT chunk_index,part_index,object_key FROM workspace_skill_parts WHERE skill_id=? ORDER BY chunk_index,part_index`;

export function preparedSkillModules(input){
 const cache=input.catalogue?.preparedSkill;if(!cache)return null;
 const plan=skillWorkItems(input.extracted);
 if(cache.version!==BOOK_METHODS_VERSION||!Array.isArray(cache.modules)||cache.modules.length!==plan.length)throw Error('Invalid prepared skill catalogue');
 return plan.map((work,n)=>{const raw=cache.modules[n],id=skillModuleId(work.index,work.part);if(raw?.id!==id)throw Error('Invalid prepared skill catalogue');return {...validateSkillModule(raw,{chunk:work.chunk,index:work.index}),id};});
}

// Keep routing rows below D1's 2 MB row limit even for a maximum-size book.
// Full methods and retrieval terms remain intact in the portable package.
export function skillRouting(modules){return modules.map(m=>({id:m.id,title:m.title.slice(0,100),purpose:m.purpose.slice(0,160),triggers:m.triggers.slice(0,4).map(t=>t.slice(0,50))}));}
