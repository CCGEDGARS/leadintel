import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {handleBuyerResearchRoute} from '../src/buyer-research-routes.js';
const require=createRequire(import.meta.url),D=require('../../customer/discovery-engine.js'),{createClient}=require('../../customer/buyer-research-jobs.js'),receipts=require('../../customer/test/helpers/buyer-research-receipts.cjs'),Budget=require('../../customer/state-budget.js');

test('reopening restores all four saved receipts across aliases and many selected jobs; recheck stays isolated',async t=>{
 const f=await buyerJobsFixture(t),stamp=new Date(Date.now()-60000).toISOString();
 const owner={...f.candidate,people:['Anna Buyer','Bob Buyer','Cara Buyer','Dana Buyer'].map((name,i)=>({...f.candidate.people[0],id:'local-'+i,name,publicName:name,publicEmail:i===1?'bob@forge.example':'',emailResearch:{status:'not_searched'}}))};
 const cookie='leadintel_session='+f.users.owner.token;
 const start=await handleBuyerResearchRoute(new Request(`https://app.fixture.test/api/buyers/research?workspace_id=${workspaceId}`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({action:'start',candidate:owner})}),f.env);
 assert.equal(start.status,200);const initial=(await start.json()).job,base=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(initial.id);
 const full=receipts(structuredClone(owner),stamp);for(const p of full.people){p.id=p.id.replace('local','dossier');p.emailResearch={status:'complete',checkedAt:stamp,searches:3,failed:0};}
 function insert(id,candidate,personIds,context){
  const input=JSON.parse(base.input_json);input.scope='selected_buyers';input.personIds=personIds;if(context)input.workspaceContext=context;
  const row={...base,id,status:'complete',phase:'done',result_json:JSON.stringify(candidate),input_json:JSON.stringify(input)};
  const keys=Object.keys(row);f.DB.raw.prepare(`INSERT INTO buyer_research_jobs(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));
 }
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='complete',phase='done',result_json=? WHERE id=?").run(JSON.stringify(full),initial.id);
 for(let i=0;i<9;i++)insert('repeat-'+i,{...full,people:[full.people[0]]},[full.people[0].id]);
 insert('wrong-seller',{...full,people:[{...full.people[1],emailResearch:{status:'unavailable',checkedAt:new Date().toISOString()}}]},[full.people[1].id],'different-seller-context');
 insert('latest',{...full,people:[full.people[3]]},[full.people[3].id]);
 const before=f.DB.raw.prepare('SELECT total_changes() n').get().n,calls=[];
 const bridge={workspace:{id:workspaceId},session:{authenticated:true,user:{id:f.users.owner.id}}};
 const client=createClient({getBridge:()=>bridge,fetchImpl:async(url,init)=>{
  calls.push([init.method,url]);assert.equal(init.method,'GET');
  return handleBuyerResearchRoute(new Request(url,{...init,headers:{...init.headers,Cookie:cookie}}),f.env,{}, {waitUntil(){assert.fail('restore must not wake providers');}});
 }});
 let saved;await client.restore(owner,{profile:initial.input.profile,persist:c=>saved=structuredClone(c)});
 assert.match(calls[0][1],/restore=1/);assert.equal(calls.length,1);
 for(const p of owner.people){assert.equal(p.emailResearch.status,'complete',p.name);for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.equal(D.buyerResearchCheckPassed(owner,p,key),true,p.name+': '+key);}
 assert.deepEqual(owner.people.map(p=>p.id),['local-0','local-1','local-2','local-3']);assert.equal(owner.people[1].publicEmail,'bob@forge.example');
 const packed=Budget.prepareForSync({discovery:{selectedProspects:[saved]}}),reopened=Budget.restoreFromSync(packed.payload||packed).discovery.selectedProspects[0];
 assert.deepEqual(reopened.people.map(p=>p.contactResearch),owner.people.map(p=>p.contactResearch));
 await client.restore(reopened,{profile:initial.input.profile});
 assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,before);
 // A locally empty company must recover its full roster even after many
 // single-person rechecks. No paid/provider work or database write is needed.
 const empty={...structuredClone(owner),people:[],peopleStatus:'error'};
 await client.restore(empty,{profile:initial.input.profile});
 assert.deepEqual(empty.people.map(p=>p.name).sort(),full.people.map(p=>p.name).sort());
 for(const p of empty.people)for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.equal(D.buyerResearchCheckPassed(empty,p,key),true,p.name+': '+key);
 const emptyPacked=Budget.prepareForSync({discovery:{selectedProspects:[empty]}});
 assert.equal(Budget.restoreFromSync(emptyPacked.payload||emptyPacked).discovery.selectedProspects[0].people.length,4);
 assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,before);
 const scopedEmpty={...structuredClone(empty),people:[]};await client.restore(scopedEmpty,{profile:initial.input.profile,personIds:['dossier-3']});assert.equal(scopedEmpty.people.length,0);
 // A contact-scoped read cannot import another buyer's saved receipts.
 const targeted=structuredClone(owner);delete targeted.people[1].contactResearch;targeted.people[1].emailResearch={status:'not_searched'};
 const untouched=JSON.stringify(targeted.people[1]);await client.restore(targeted,{profile:initial.input.profile,personIds:['local-3']});assert.equal(JSON.stringify(targeted.people[1]),untouched);assert.doesNotMatch(calls.at(-1)[1],/restore=1/);
});

test('receipt recovery refuses identity collisions, stale receipts and newer local attempts',()=>{
 const candidate={domain:'forge.example',company:'Forge',people:[{id:'local',name:'Anna Buyer',title:'COO',organization:'Forge'}]},old=receipts(structuredClone(candidate),new Date(Date.now()-60000).toISOString()).people[0];old.id='dossier';
 for(const field of ['name','title','organization','publicLinkedinUrl']){
  const c=structuredClone(candidate);c.people[0][field]=field==='publicLinkedinUrl'?'https://linkedin.com/in/another':'Different';assert.equal(D.restoreBuyerResearchReceipts(c,[old]),false,field);
 }
 const duplicate=structuredClone(candidate);duplicate.people.push({...duplicate.people[0],id:'second'});assert.equal(D.restoreBuyerResearchReceipts(duplicate,[old]),false);
 const stale=receipts(structuredClone(candidate),new Date(Date.now()-31*86400000).toISOString()).people;assert.equal(D.restoreBuyerResearchReceipts(candidate,stale),false);
 const newer=receipts(structuredClone(candidate));newer.people[0].contactResearch.checks.phone.status='partial';const before=JSON.stringify(newer);assert.equal(D.restoreBuyerResearchReceipts(newer,[old]),false);assert.equal(JSON.stringify(newer),before);
});
