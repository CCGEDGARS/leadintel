import {chunkWritingReference,aggregateWritingReference} from './writing-reference-analysis.js';
import {BOOK_METHODS_VERSION,skillWorkItems,skillModuleId} from './workspace-skill-plan.js';
import {validateSkillModule} from './workspace-skill-generation.js';
export function bookAnalysisWork(extracted){return extracted.coverage?.methodPlan===BOOK_METHODS_VERSION
 ?skillWorkItems(extracted).map(w=>({...w,id:skillModuleId(w.index,w.part)}))
 :chunkWritingReference(extracted).map(chunk=>({id:chunk.id,chunk}));}
export function methodCatalogue(extracted,work,rows){
 if(extracted.coverage?.methodPlan!==BOOK_METHODS_VERSION)return aggregateWritingReference(rows.map(row=>JSON.parse(row.techniques_json)));
 const byId=new Map(rows.map(row=>[row.chunk_id,JSON.parse(row.techniques_json)]));
 const modules=work.map(w=>({...validateSkillModule(byId.get(w.id)?.module,{chunk:w.chunk,index:w.index}),id:w.id}));
 const techniques=modules.flatMap(m=>m.principles.map((principle,n)=>({id:m.id+':'+n,name:m.title,principle:principle.slice(0,1000),uses:m.triggers.slice(0,10),cautions:m.cautions.slice(0,10).map(s=>s.slice(0,500)),pattern:m.steps.join(' ').slice(0,1000),locations:m.locations})));
 return {...aggregateWritingReference([techniques]),preparedSkill:{version:BOOK_METHODS_VERSION,modules}};
}
