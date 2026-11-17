import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {journeyFixture,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
const require=createRequire(import.meta.url),Crm=require('../../customer/crm-engine.js');

async function fixture(t){
 const f=await journeyFixture();t.after(()=>f.close());
 const send=async(path,body)=>{if(path==='/companies'&&body?.intelligence_scope==='company')path='/companies/company-research';const response=await fetch(f.origin+'/api/crm'+path+'?workspace_id='+workspaceId,{method:body?'POST':'GET',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};};
 const old={...f.candidate,buyerRoles:'Manual procurement committee',buyerRolesSource:'manual',buyerRolesChanged:true,buyerDiscovery:{checkedAt:'2026-11-14T10:00:00Z',researchIncomplete:true,providerStatus:{firecrawl:{status:'complete'}}},publicResearch:{sources:['https://forge.example/team'],issues:['Retained buyer research note']}};
 old.people[0].notes='Retained manual work';await send('/companies',Crm.mapDiscoveryCandidateToCrm(old));
 const fresh={company:old.company,domain:old.domain,crmId:old.crmId,website:old.website,people:[],buyerRoles:'Generated committee',buyerRolesSource:'profile',buyerRolesChanged:false,evidence:[{url:'https://forge.example/operations',text:'New operating evidence',sourceRead:true}]};
 return {...f,send,old,fresh};
}
test('company-only HTTP save preserves current CRM-only buyer research, manual committee and contacts',async t=>{
 const f=await fixture(t),before=await f.send('/companies/'+f.old.crmId),payload=Crm.mapDiscoveryCandidateToCrm(f.fresh,{companyOnly:true});
 assert.equal((await f.send('/companies',payload)).status,200);const after=await f.send('/companies/'+f.old.crmId),a=after.intelligence.research_snapshot,b=before.intelligence.research_snapshot;
 assert.deepEqual(a.buyerResearch,b.buyerResearch);assert.equal(a.buyerRoles,b.buyerRoles);assert.equal(a.buyerRolesChanged,true);assert.equal(a.companyResearch.buyerRolesSource,'manual');assert.equal(a.companyResearch.buyerRoles,b.companyResearch.buyerRoles);assert.deepEqual(after.contacts,before.contacts);
 assert.equal(a.companyResearch.company,f.fresh.company);assert.equal(after.intelligence.evidence[0].url,'https://forge.example/operations');assert.equal(f.providerCalls.length,0);
});
test('a delayed Companies write preserves Buyer research committed immediately before its SQL upsert',async t=>{
 const f=await fixture(t),payload=Crm.mapDiscoveryCandidateToCrm(f.fresh,{companyOnly:true}),prepare=f.DB.prepare.bind(f.DB),batch=f.DB.batch.bind(f.DB);let changed=false;
 f.DB.prepare=sql=>{const statement=prepare(sql);statement.companyTestSql=sql;return statement;};
 f.DB.batch=statements=>{if(!changed&&statements.some(s=>s.companyTestSql?.includes('INSERT INTO crm_intelligence'))){changed=true;f.DB.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=json_set(research_snapshot_json,'$.buyerResearch.publicResearch.latestNote','Newer Buyer receipt') WHERE company_id=?").run(f.old.crmId);}return batch(statements);};
 assert.equal((await f.send('/companies',payload)).status,200);assert.equal(changed,true);const snapshot=(await f.send('/companies/'+f.old.crmId)).intelligence.research_snapshot;
 assert.equal(snapshot.buyerResearch.publicResearch.latestNote,'Newer Buyer receipt');assert.equal(snapshot.buyerResearch.buyers.length,2);
});
test('company-only mode omits unstarted buyer reports and ignores stale contact input for new companies',async t=>{
 const f=await fixture(t),payload=Crm.mapDiscoveryCandidateToCrm({...f.fresh,crmId:undefined,company:'Newco',domain:'newco.example',website:'https://newco.example/',people:[{id:'stale',name:'Stale Person',email:'stale@newco.example'}]},{companyOnly:true});
 const saved=await f.send('/companies',payload);assert.equal(saved.status,201);const after=await f.send('/companies/'+saved.company.id);assert.equal(after.intelligence.research_snapshot.buyerResearch,undefined);assert.equal(after.contacts.length,0);
});
test('deliberate Buyer-owner saves retain normal snapshot replacement semantics',async t=>{
 const f=await fixture(t),updated={...f.old,people:f.old.people.slice(0,1),buyerRoles:'Reviewed new committee',buyerRolesChanged:false};
 assert.equal((await f.send('/companies',Crm.mapDiscoveryCandidateToCrm(updated))).status,200);const after=await f.send('/companies/'+f.old.crmId);assert.equal(after.intelligence.research_snapshot.buyerResearch.buyers.length,1);assert.equal(after.intelligence.research_snapshot.buyerRoles,'Reviewed new committee');
});
test('company scope is enforced by the API even when a client includes stale Buyer fields and contacts',async t=>{
 const f=await fixture(t),before=await f.send('/companies/'+f.old.crmId),payload=Crm.mapDiscoveryCandidateToCrm({...f.fresh,people:[{id:f.old.people[0].id,name:'Wrong stale identity',title:'Wrong role',email:'wrong@forge.example'}]});payload.intelligence_scope='company';
 assert.equal((await f.send('/companies',payload)).status,200);const after=await f.send('/companies/'+f.old.crmId);assert.deepEqual(after.intelligence.research_snapshot.buyerResearch,before.intelligence.research_snapshot.buyerResearch);assert.deepEqual(after.contacts,before.contacts);assert.equal(after.intelligence.research_snapshot.companyResearch.buyerRolesSource,'manual');
});
test('unknown save scopes fail before changing a company or its research',async t=>{
 const f=await fixture(t),before=await f.send('/companies/'+f.old.crmId),payload=Crm.mapDiscoveryCandidateToCrm({...f.fresh,company:'Invalid change'});payload.intelligence_scope='unknown';
 assert.equal((await f.send('/companies',payload)).status,400);const after=await f.send('/companies/'+f.old.crmId);assert.deepEqual(after.company,before.company);assert.deepEqual(after.intelligence,before.intelligence);
});
test('the dedicated Company endpoint enforces limited writes without trusting a client scope flag',async t=>{
 const f=await fixture(t),before=await f.send('/companies/'+f.old.crmId);assert.equal((await f.send('/companies/company-research',Crm.mapDiscoveryCandidateToCrm(f.fresh))).status,200);const after=await f.send('/companies/'+f.old.crmId);assert.deepEqual(after.intelligence.research_snapshot.buyerResearch,before.intelligence.research_snapshot.buyerResearch);assert.deepEqual(after.contacts,before.contacts);
});
