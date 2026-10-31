import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';

async function fixture(){
 const DB=storageDb(),env={DB,APP_ORIGIN:'https://app.test'};
 DB.raw.exec("INSERT INTO users(id,email,display_name,role) VALUES('writer','writer@example.test','Writer','sales'),('reader','reader@example.test','Reader','sales'); INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('storage-w1','writer','sales'),('storage-w1','reader','viewer');");
 for(const [id,token] of [['storage-owner','owner'],['writer','writer'],['reader','reader']])await DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,'2099-01-01')").bind(await sha256(token),id).run();
 return {DB,env,async call(id='',{method='GET',workspace='storage-w1',token='owner',body,raw,headers={}}={}){
  const response=await app.fetch(new Request('https://app.test/api/writing-workspace'+(id?'/'+id:'')+'?workspace_id='+workspace,{method,headers:{...(token?{Cookie:'leadintel_session='+token}:{}),'Content-Type':'application/json',...headers},...(body!==undefined||raw!==undefined?{body:raw??JSON.stringify(body)}:{})}),env,{});
  return {status:response.status,data:await response.json()};
 }};
}
const draft={kind:'draft',title:'Board update',subject:'',message:'  Progress this week.\n\nNext steps.  ',expectedRevision:0};

test('independent drafts and templates save and reopen without CRM or workflow mutations',async()=>{
 const f=await fixture(),id=crypto.randomUUID(),templateId=crypto.randomUUID();
 const tables=['crm_companies','crm_contacts','crm_activities','saved_flows','email_campaigns','outreach_automation_policies','outreach_automation_sequences','outreach_automation_queue'];
 const snapshot=()=>tables.map(table=>f.DB.raw.prepare('SELECT * FROM '+table).all());
 const before=snapshot();
 assert.deepEqual(await f.call(),{status:200,data:{records:[]}});
 const saved=await f.call(id,{method:'PUT',body:draft});assert.equal(saved.status,200);
 assert.equal(saved.data.record.id,id);assert.equal(saved.data.record.revision,1);assert.equal(saved.data.record.message,draft.message);assert.ok(Number.isFinite(Date.parse(saved.data.record.updatedAt)));
 assert.equal((await f.call(templateId,{method:'PUT',body:{...draft,kind:'template',title:'Weekly update',subject:undefined}})).status,200);
 const reloaded=await f.call();assert.equal(reloaded.data.records.length,2);assert.equal(reloaded.data.records.find(r=>r.id===id).message,draft.message);assert.equal(reloaded.data.records.find(r=>r.id===templateId).subject,'');
 assert.deepEqual(snapshot(),before);
});

test('authenticated membership and writer roles protect user and workspace isolation',async()=>{
 const f=await fixture(),id=crypto.randomUUID();
 assert.equal((await f.call('',{token:''})).status,401);assert.equal((await f.call('',{token:'invalid'})).status,401);
 assert.equal((await f.call('',{workspace:'missing'})).status,403);
 assert.equal((await f.call(id,{token:'reader',method:'PUT',body:draft})).status,403);
 assert.equal((await f.call(id,{method:'PUT',body:draft})).status,200);
 assert.deepEqual((await f.call('',{token:'writer'})).data.records,[]);
 assert.deepEqual((await f.call('',{workspace:'storage-w2'})).data.records,[]);
 assert.equal((await f.call(id,{token:'writer',method:'PUT',body:{...draft,expectedRevision:1}})).status,409);
 assert.equal((await f.call(id,{workspace:'storage-w2',method:'PUT',body:{...draft,expectedRevision:1}})).status,409);
 assert.equal((await f.call(id,{token:'writer',method:'PUT',body:draft})).status,200);
 assert.equal((await f.call(id,{workspace:'storage-w2',method:'PUT',body:draft})).status,200);
 assert.equal((await f.call('',{token:'reader'})).status,200);
 f.DB.raw.exec("UPDATE workspace_members SET role='researcher' WHERE workspace_id='storage-w1' AND user_id='reader'");
 assert.equal((await f.call(crypto.randomUUID(),{token:'reader',method:'PUT',body:draft})).status,200);
 f.DB.raw.exec("UPDATE sessions SET expires_at='2000-01-01' WHERE user_id='reader'");
 assert.equal((await f.call('',{token:'reader'})).status,401);
});

test('revision compare and swap permits one racing save and preserves winning text after reopen',async()=>{
 const f=await fixture(),id=crypto.randomUUID();
 await f.call(id,{method:'PUT',body:draft});
 assert.equal((await f.call(id,{method:'PUT',body:draft})).status,409);
 const results=await Promise.all(['First edit','Second edit'].map(message=>f.call(id,{method:'PUT',body:{...draft,message,expectedRevision:1}})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const saved=(await f.call()).data.records[0];assert.equal(saved.revision,2);assert.equal(saved.message,results.find(r=>r.status===200).data.record.message);
});

test('draft validation bounds content, identifiers, and actual request bytes',async()=>{
 const f=await fixture();
 for(const overrides of [{kind:'campaign'},{title:''},{title:'x'.repeat(81)},{message:'  '},{message:'x'.repeat(12001)},{subject:'x'.repeat(501)},{expectedRevision:-1},{expectedRevision:1.5},{companyId:'arbitrary'}])assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:{...draft,...overrides}})).status,400,JSON.stringify(overrides).slice(0,90));
 assert.equal((await f.call('unsafe-id',{method:'PUT',body:draft})).status,400);
 assert.equal((await f.call(crypto.randomUUID(),{method:'POST',body:draft})).status,405);
 assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',raw:'{'})).status,400);
 assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',raw:' '.repeat(100001)})).status,413);
 assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:draft,headers:{'Content-Length':'100001'}})).status,413);
 assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:{...draft,title:'x'.repeat(80),subject:'x'.repeat(500),message:'x'.repeat(12000)}})).status,200);
});

test('historical source attribution stays bounded to this workspace and never accepts arbitrary provenance',async()=>{
 const f=await fixture(),id=crypto.randomUUID(),writingAssistant={workspaceId:'storage-w1',writingContext:'general',sourceSelection:'session',referenceRevision:2,sourceRefs:[{id:'ref-one',revision:1}],citations:[{sourceId:'ref-one',revision:1,filename:'Notes.pdf',location:'page:2',role:'guidance'}],appliedAt:'2026-10-23T12:00:00.000Z'};
 assert.equal((await f.call(id,{method:'PUT',body:{...draft,writingAssistant}})).status,200);
 assert.deepEqual((await f.call()).data.records[0].writingAssistant,writingAssistant);
 for(const bad of [{...writingAssistant,workspaceId:'storage-w2'},{...writingAssistant,writingContext:'campaign'},{...writingAssistant,sourceSelection:'all'},{...writingAssistant,active:true},{...writingAssistant,sourceRefs:[]},{...writingAssistant,appliedAt:'invalid'},'x'.repeat(8001)])assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:{...draft,writingAssistant:bad}})).status,400);
 assert.equal((await f.call(id,{method:'PUT',body:{...draft,message:'Manual edit',expectedRevision:1}})).status,200);
 assert.equal((await f.call()).data.records[0].writingAssistant,undefined);
});

test('sixty-record cap is atomic across concurrent creates and archived records do not return',async()=>{
 const f=await fixture();
 for(let i=0;i<59;i++)assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:draft})).status,200);
 const ids=[crypto.randomUUID(),crypto.randomUUID()],results=await Promise.all(ids.map(id=>f.call(id,{method:'PUT',body:draft})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await f.call()).data.records.length,60);
 const id=results.find(r=>r.status===200).data.record.id;
 assert.equal((await f.call(id,{method:'DELETE',body:{expectedRevision:0}})).status,409);
 assert.equal((await f.call(id,{method:'DELETE',body:{expectedRevision:1}})).status,200);
 assert.equal((await f.call()).data.records.length,59);
 assert.equal((await f.call(id,{method:'PUT',body:draft})).status,409);
 assert.equal((await f.call(id,{method:'PUT',body:{...draft,expectedRevision:2}})).status,409);
 assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:draft})).status,200);
});

test('storage quota failures preserve draft text and revision atomically',async()=>{
 const f=await fixture(),id=crypto.randomUUID();await f.call(id,{method:'PUT',body:draft});
 const account=f.DB.raw.prepare("SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get();assert.ok(account.records_bytes>0);
 f.DB.raw.exec("UPDATE workspace_storage_accounts SET included_records_limit=records_bytes WHERE workspace_id='storage-w1'");
 assert.equal((await f.call(id,{method:'PUT',body:{...draft,message:'Longer '.repeat(1000),expectedRevision:1}})).status,507);
 const saved=(await f.call()).data.records[0];assert.equal(saved.message,draft.message);assert.equal(saved.revision,1);
 assert.equal(f.DB.raw.prepare("SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().records_bytes,account.records_bytes);
});

test('formatted writing drafts save, reload and reject mismatched or oversized HTML',async()=>{
 const f=await fixture(),id=crypto.randomUUID(),body={...draft,message:'Hello Alex',messageHtml:'Hello <strong>Alex</strong>'};
 const saved=await f.call(id,{method:'PUT',body});assert.equal(saved.status,200);assert.equal(saved.data.record.messageHtml,body.messageHtml);assert.equal((await f.call()).data.records[0].messageHtml,body.messageHtml);
 assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:{...body,messageHtml:'<b>Another recipient</b>'}})).status,400);
 assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:{...body,messageHtml:'x'.repeat(80001)}})).status,400);
});
test('skill attribution survives save and reopen, while malformed or excessive skill refs are rejected',async()=>{const f=await fixture(),id=crypto.randomUUID(),writingAssistant={workspaceId:'storage-w1',writingContext:'general',sourceSelection:'session',referenceRevision:0,sourceRefs:[],skillRefs:[{id:'saved-skill',revision:2}],citations:[],appliedAt:'2026-10-27T12:00:00.000Z'};const saved=await f.call(id,{method:'PUT',body:{...draft,writingAssistant}});assert.equal(saved.status,200);assert.deepEqual((await f.call()).data.records[0].writingAssistant.skillRefs,writingAssistant.skillRefs);for(const skillRefs of [[{id:'s',revision:0}],Array.from({length:4},(_,n)=>({id:'s'+n,revision:1})),[{id:'same',revision:1},{id:'same',revision:1}],'invalid'])assert.equal((await f.call(crypto.randomUUID(),{method:'PUT',body:{...draft,writingAssistant:{...writingAssistant,skillRefs}}})).status,400);});
test('writing library rejects session revocation at commit and after private read',async()=>{for(const mode of ['write','read']){const f=await fixture(),id=crypto.randomUUID();try{if(mode==='read')assert.equal((await f.call(id,{method:'PUT',body:draft})).status,200);if(mode==='write'){const batch=f.DB.batch.bind(f.DB);f.DB.batch=async writes=>{f.DB.raw.exec('DELETE FROM sessions');return batch(writes);};}else{const prepare=f.DB.prepare.bind(f.DB);f.DB.prepare=sql=>{const st=prepare(sql);if(sql.startsWith('SELECT id,payload_json,revision,updated_at FROM writing_workspace_records')){const all=st.all;st.all=async()=>{const rows=await all();f.DB.raw.exec('DELETE FROM sessions');return rows;};}return st;};}const r=await f.call(mode==='write'?id:'',mode==='write'?{method:'PUT',body:draft}:{});assert.equal(r.status,401);if(mode==='write')assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM writing_workspace_records').get().n,0);assert.ok(!JSON.stringify(r.data).includes('Progress this week'));}finally{f.DB.raw.close();}}});
