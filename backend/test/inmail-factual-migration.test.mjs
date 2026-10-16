import test from 'node:test';
import assert from 'node:assert/strict';
import {coreScripts} from '../src/script-library-routes.js';
import {inmailScriptSeeds as seeds} from '../src/inmail-script-seeds.js';
const catalogue=async(saved)=>coreScripts({prepare(){return {all:async()=>({results:saved.map((r,i)=>({id:r.id,payload_json:JSON.stringify(r),revision:i+1}))})};}});
test('all exact legacy InMail masters upgrade without losing their full sequence history',async()=>{
 const old=seeds.map(r=>({...r,masterVersion:undefined,previousBuiltinStages:undefined,stages:r.previousBuiltinStages[0],body:r.previousBuiltinStages[0][0].body}));
 const rows=await catalogue(old);
 for(const expected of seeds){const r=rows.find(r=>r.id===expected.id);assert.deepEqual(r.stages,expected.stages);assert.equal(r.masterVersion,expected.masterVersion);assert.deepEqual(r.history.at(-1).stages,expected.previousBuiltinStages[0]);assert.equal(r.original,expected.original);}
});
test('owner edits in any follow-up and deleted InMail masters never get replaced by a migration',async()=>{
 const original=seeds[1],legacy=original.previousBuiltinStages[0];
 const edited={...original,masterVersion:undefined,body:legacy[0].body,stages:structuredClone(legacy)};edited.stages[2].body+=' Owner wording.';
 const deleted={...seeds[2],masterVersion:undefined,deleted:true};
 const rows=await catalogue([edited,deleted]);assert.deepEqual(rows.find(r=>r.id===edited.id).stages,edited.stages);assert.equal(rows.find(r=>r.id===deleted.id).deleted,true);
});
