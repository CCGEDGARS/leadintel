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

export const SKILL_SAVED_SECTIONS_SQL=`(SELECT count(*) FROM workspace_skill_chunks c WHERE c.skill_id=s.id)+(SELECT count(*) FROM workspace_skill_parts p WHERE p.skill_id=s.id)`;
export const SKILL_OUTPUTS_SQL=`SELECT chunk_index,-1 AS part_index,object_key FROM workspace_skill_chunks WHERE skill_id=? UNION ALL SELECT chunk_index,part_index,object_key FROM workspace_skill_parts WHERE skill_id=? ORDER BY chunk_index,part_index`;
