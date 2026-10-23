import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {handleScriptLibraryRoute} from '../src/script-library-routes.js';
import {sha256} from '../src/security.js';
async function fixture(){
 const DB=storageDb(),env={DB};DB.raw.exec("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('TOKEN','storage-owner','2099-01-01');INSERT INTO crm_companies(id,workspace_id,company_name,first_seen_at,last_seen_at,created_at,updated_at) VALUES('company','storage-w1','Company',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);INSERT INTO crm_contacts(id,workspace_id,company_id,name,created_at,updated_at) VALUES('contact','storage-w1','company','Alice',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);");DB.raw.prepare('UPDATE sessions SET token_hash=?').run(await sha256('session'));
 return async(path,method='GET',body)=>{const response=await handleScriptLibraryRoute(new Request('https://app.test/api/script-library'+path+(path.includes('?')?'&':'?')+'workspace_id=storage-w1',{method,headers:{Cookie:'leadintel_session=session','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:response.status,data:await response.json()};};
}
const attribution=()=>({workspaceId:'storage-w1',writingContext:'customer',sourceSelection:'active',referenceRevision:3,sourceRefs:[{id:'book',revision:2}],citations:[{passageId:'book:2:0:0',sourceId:'book',revision:2,filename:'guide.pdf',location:'page:7',role:'guidance'}],appliedAt:'2026-10-21T10:00:00.000Z'});
test('phone saves and reopens bounded applied-source attribution without retaining it on a later manual copy',async()=>{
 const call=await fixture(),body={companyId:'company',contactId:'contact',message:'Hi Alice, Bob here.',style:'original',expectedRevision:0,writingAssistant:{...attribution(),writingContext:'general',sourceSelection:'session'}};assert.equal((await call('/draft','PUT',body)).status,200);const saved=await call('/draft?companyId=company&contactId=contact');assert.deepEqual(saved.data.draft.writingAssistant,body.writingAssistant);
 assert.equal((await call('/draft','PUT',{...body,expectedRevision:1,writingAssistant:null,message:'Hi Alice, a manual copy from Bob.'})).status,200);assert.equal((await call('/draft?companyId=company&contactId=contact')).data.draft.writingAssistant,undefined);
});
test('legacy attribution without context enums still saves and reopens',async()=>{
 const call=await fixture(),historical=attribution();delete historical.writingContext;delete historical.sourceSelection;
 assert.equal((await call('/draft','PUT',{companyId:'company',contactId:'contact',message:'An existing saved call.',style:'original',expectedRevision:0,writingAssistant:historical})).status,200);
 assert.deepEqual((await call('/draft?companyId=company&contactId=contact')).data.draft.writingAssistant,historical);
});
test('InMail source attribution stays attached to its own saved stage',async()=>{
 const call=await fixture(),record={style:'original',stage:'followup',values:{},checks:{},stages:{initial:{subject:'Hello',message:'Hi Alice, Bob here.',writingAssistant:attribution()},followup:{subject:'',message:'Alice, Bob following up.',writingAssistant:{...attribution(),citations:[{...attribution().citations[0],location:'page:8'}]}}}};
 assert.equal((await call('/inmail-draft','PUT',{companyId:'company',contactId:'contact',record,expectedRevision:0})).status,200);const saved=(await call('/inmail-draft?companyId=company&contactId=contact')).data.draft.record;assert.deepEqual(saved.stages.initial.writingAssistant,record.stages.initial.writingAssistant);assert.equal(saved.stages.followup.writingAssistant.citations[0].location,'page:8');
});
test('phone and InMail reject foreign, oversized and mismatched citation metadata before changing saved text',async()=>{
 for(const kind of ['phone','inmail']){const call=await fixture();for(const invalid of [{...attribution(),workspaceId:'storage-w2'},{...attribution(),writingContext:'campaign'},{...attribution(),sourceSelection:'all'},{...attribution(),secret:'unexpected'},{...attribution(),citations:[{...attribution().citations[0],revision:99}]},{...attribution(),citations:[{...attribution().citations[0],filename:'x'.repeat(9000)}]}]){
  const body=kind==='phone'?{companyId:'company',contactId:'contact',message:'Hi Alice, Bob here.',style:'original',expectedRevision:0,writingAssistant:invalid}:{companyId:'company',contactId:'contact',expectedRevision:0,record:{style:'original',stage:'initial',values:{},checks:{},stages:{initial:{subject:'Hello',message:'Hi Alice, Bob here.',writingAssistant:invalid}}}};
  assert.equal((await call(kind==='phone'?'/draft':'/inmail-draft','PUT',body)).status,400,kind+' must reject invalid attribution');
 }assert.equal((await call((kind==='phone'?'/draft':'/inmail-draft')+'?companyId=company&contactId=contact')).data.draft,null);}
});
