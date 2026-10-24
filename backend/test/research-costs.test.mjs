import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {getResearchCosts,handleResearchCostsRoute,researchCostPeriod} from '../src/research-costs.js';

const now=new Date('2026-10-24T12:00:00Z');
const period=researchCostPeriod(new URL('https://app.invalid/?start=2026-10-01&end=2026-11-01'),now);
function fixture(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE users(id TEXT);CREATE TABLE sessions(user_id TEXT,token_hash TEXT,expires_at TEXT);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);
    CREATE TABLE treg_contact_calls(workspace_id TEXT,request_key TEXT,phase TEXT,call_id TEXT,cost_micro INTEGER,result_json TEXT,created_at TEXT);
    CREATE TABLE additional_contact_policies(workspace_id TEXT,enabled INTEGER,phone_enabled INTEGER,daily_limit INTEGER,monthly_limit INTEGER,max_per_company INTEGER,provider TEXT,updated_at TEXT);
    CREATE TABLE additional_contact_attempts(workspace_id TEXT,company_id TEXT,person_id TEXT,month TEXT,provider TEXT,status TEXT,result_json TEXT,created_at TEXT);
    CREATE TABLE audit_events(id TEXT,workspace_id TEXT,entity_id TEXT,event_type TEXT,metadata_json TEXT,created_at TEXT);
    CREATE TABLE crm_companies(id TEXT,workspace_id TEXT,normalized_domain TEXT,deleted_at TEXT,lifecycle_status TEXT);
    CREATE TABLE crm_contacts(workspace_id TEXT,company_id TEXT,name TEXT,normalized_email TEXT,work_email TEXT,email_status TEXT,verification_provider TEXT,source TEXT,verified_at TEXT,public_email_url TEXT,archived_at TEXT);`);
  const writes=[];
  const db={prepare(query){let args=[];return {bind(...values){args=values;return this;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){writes.push(query);throw Error('Read-only endpoint attempted a write');}};}};
  sql.prepare('INSERT INTO users VALUES(?)').run('user-a');
  sql.prepare('INSERT INTO sessions VALUES(?,?,?)').run('user-a',createHash('sha256').update('session-a').digest('hex'),'2099-01-01');
  sql.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('a','user-a','researcher');
  const receipt=(id,cost,{workspace='a',key=id||'missing',phase='find',date='2026-10-12 01:02:03'}={})=>sql.prepare('INSERT INTO treg_contact_calls VALUES(?,?,?,?,?,?,?)').run(workspace,key,phase,id,cost,JSON.stringify({secret:'not-for-response',output:{email:'private@example.com'}}),date);
  const contact=(email,{workspace='a',status='verified',source='treg',provider='Treg',date='2026-10-12',name='Anna Buyer',archived=null}={})=>{sql.prepare('INSERT INTO crm_companies VALUES(?,?,?,?,?)').run('co-'+email,workspace,'example.com',null,'active');sql.prepare('INSERT INTO crm_contacts VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(workspace,'co-'+email,name,email,email,status,provider,source,date,null,archived);};
  return {sql,db,writes,receipt,contact,close:()=>sql.close()};
}

test('only authoritative settled receipts contribute; replays and copied invoices/attempt snapshots never double-count',async()=>{
  const f=fixture();try{
    f.receipt('call-find',4000);f.receipt('call-find',4000,{key:'replay',phase:'verify'});f.receipt('call-verify',2000);
    f.receipt('other',999000,{workspace:'b'});
    f.sql.prepare('INSERT INTO additional_contact_attempts VALUES(?,?,?,?,?,?,?,?)').run('a','c','p','2026-10','treg','verified',JSON.stringify({research:{costMicro:6000},invoice:{currency:'EUR',amount:300}}),'2026-10-12');
    f.contact('anna@example.com');f.contact('private@other.com');f.contact('info@example.com');f.contact('unconfirmed@example.com',{status:'public_unverified'});f.contact('old@example.com',{date:'2026-09-30'});f.contact('archived@example.com',{archived:'2026-10-20'});f.contact('otherworkspace@example.com',{workspace:'b'});
    const output=await getResearchCosts(f.db,'a',period,{now});
    assert.deepEqual(output.confirmedSpend,[{currency:'USD',amountMicro:6000,scope:'Recorded Treg receipts only'}]);
    assert.equal(output.providers[0].confirmedReceipts,2);assert.equal(output.providers[0].duplicateRowsIgnored,1);
    assert.equal(output.contacts.newlyVerifiedTregUsable,1);assert.equal(output.costPerUsableContact.amountMicro,6000);
    assert.equal(output.totalResearchCost,null);assert.equal(output.coverage,'incomplete');assert.equal(output.monetaryBudget.amount,null);
    assert.equal(f.writes.length,0);assert.doesNotMatch(JSON.stringify(output),/private@example|not-for-response|EUR|anna@example/i);
  }finally{f.close();}
});

test('missing call IDs, zero/default amounts, malformed amounts and conflicting duplicate receipts remain unknown',async()=>{
  const f=fixture();try{
    f.receipt('good',10000);f.receipt(null,50000);f.receipt('missing-header',0);f.receipt('fraction',1.25);f.receipt('negative',-3);f.receipt('bad','not-a-cost');f.receipt('conflict',500);f.receipt('conflict',600,{key:'copy'});
    const out=await getResearchCosts(f.db,'a',period,{now});
    assert.equal(out.providers[0].confirmedAmountMicro,10000);assert.equal(out.providers[0].unknownReceipts,6);assert.equal(out.providers[0].status,'partial');assert.equal(out.costPerUsableContact.amountMicro,null);
    f.sql.exec('DELETE FROM treg_contact_calls');f.receipt('missing',0);
    const unknown=await getResearchCosts(f.db,'a',period,{now});assert.deepEqual(unknown.confirmedSpend,[]);assert.equal(unknown.providers[0].confirmedAmountMicro,null);assert.equal(unknown.costPerUsableContact.amountMicro,null);
  }finally{f.close();}
});

test('currency remains source-specific; AI tokens/Firecrawl events and lookup caps never become dollar costs',async()=>{
  const f=fixture();try{
    f.receipt('call',7000);f.sql.exec("INSERT INTO additional_contact_policies VALUES('a',1,0,3,30,1,'treg','2026-10-21')");
    for(const [status,date,month] of [['processing','2026-10-24','2026-10'],['not_found','2026-10-24','2026-10'],['retryable','2026-10-24','2026-10'],['verified','2026-10-01','2026-10'],['verified','2026-09-10','2026-09']])f.sql.prepare('INSERT INTO additional_contact_attempts VALUES(?,?,?,?,?,?,?,?)').run('a','c','p',month,'treg',status,'{}',date);
    for(const [id,workspace,provider,type,metadata] of [['1','a','openai','ai.generation_completed',{input_tokens:100,output_tokens:20,cost_usd:999,api_key:'private-key'}],['2','b','openai','ai.generation_completed',{input_tokens:9999,output_tokens:9999}],['3','a','gemini','ai.contact_evidence_reviewed',{}],['4','a','firecrawl','service.firecrawl_search',{source:'customer'}],['5','a','openai','ai.provider_saved',{input_tokens:999,output_tokens:999}]])f.sql.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)').run(id,workspace,provider,type,JSON.stringify(metadata),'2026-10-10');
    const out=await getResearchCosts(f.db,'a',period,{now});const ai=out.providers.find(p=>p.provider==='openai');assert.equal(ai.inputTokens,100);assert.equal(ai.outputTokens,20);assert.equal(ai.recordedEvents,1);assert.equal(ai.cost,null);assert.equal(ai.currency,null);
    assert.equal(out.providers.find(p=>p.provider==='gemini').inputTokens,null);assert.equal(out.providers.find(p=>p.provider==='firecrawl').recordedEvents,1);
    assert.equal(out.limits.dailyUsed,2);assert.equal(out.limits.monthlyUsed,3);assert.equal(out.limits.dailyLimit,3);assert.equal(out.limits.monetaryBudget,null);
    assert.deepEqual(out.confirmedSpend.map(p=>p.currency),['USD']);assert.doesNotMatch(JSON.stringify(out),/999|private-key/);
  }finally{f.close();}
});

test('period bounds use first recording and exclude the end; a replay in a later period is not new spend',async()=>{
  const f=fixture();try{
    f.receipt('old',100,{date:'2026-09-30 23:59:59'});f.receipt('old',100,{date:'2026-10-01 00:00:00',key:'replayed'});
    f.receipt('inside',200,{date:'2026-10-01T00:00:00Z'});f.receipt('end',400,{date:'2026-11-01 00:00:00'});
    const out=await getResearchCosts(f.db,'a',period,{now});assert.equal(out.providers[0].confirmedAmountMicro,200);assert.equal(out.providers[0].confirmedReceipts,1);
    assert.equal(researchCostPeriod(new URL('https://app.invalid'),now).start,'2026-10-01T00:00:00.000Z');
    for(const query of ['start=2026-02-30&end=2026-03-02','start=bad','start=2024-01-01&end=2026-11-01','start=2026-11-01&end=2026-10-01'])assert.throws(()=>researchCostPeriod(new URL('https://app.invalid/?'+query),now),/valid UTC/);
  }finally{f.close();}
});

test('workspace membership is checked before costs; no credentials or personal provider output are projected',async()=>{
  const f=fixture();try{
    f.receipt('secret-receipt',2000,{workspace:'b'});
    const request=(query='',cookie='leadintel_session=session-a',method='GET')=>new Request('https://app.invalid/api/research/costs?workspace_id=a&start=2026-10-01&end=2026-11-01'+query,{method,headers:{cookie}});
    assert.equal((await handleResearchCostsRoute(request('','','GET'),{DB:f.db})).status,401);
    assert.equal((await handleResearchCostsRoute(request('&workspace_id=b'),{DB:f.db})).status,200); // URLSearchParams uses first occurrence.
    assert.equal((await handleResearchCostsRoute(new Request('https://app.invalid/api/research/costs?workspace_id=b',{headers:{cookie:'leadintel_session=session-a'}}),{DB:f.db})).status,403);
    assert.equal((await handleResearchCostsRoute(request('','leadintel_session=expired'),{DB:f.db})).status,401);
    assert.equal((await handleResearchCostsRoute(request('','leadintel_session=session-a','POST'),{DB:f.db})).status,405);
    assert.equal((await handleResearchCostsRoute(new Request('https://app.invalid/api/research/costs'),{DB:f.db})).status,400);
    const response=await handleResearchCostsRoute(request(),{DB:f.db});assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).workspaceId,'a');
    assert.equal(await handleResearchCostsRoute(new Request('https://app.invalid/api/other'),{DB:f.db}),null);assert.equal(f.writes.length,0);
  }finally{f.close();}
});

test('missing receipt/usage schema yields explicit unavailable values; database failures never claim zero spend',async()=>{
  const f=fixture();try{
    f.sql.exec('DROP TABLE treg_contact_calls;DROP TABLE audit_events;DROP TABLE additional_contact_policies;DROP TABLE crm_contacts');
    const out=await getResearchCosts(f.db,'a',period,{now});assert.deepEqual(out.confirmedSpend,[]);assert.equal(out.providers[0].status,'unavailable');assert.equal(out.contacts.newlyVerifiedUsable,null);assert.equal(out.limits.status,'unavailable');assert.equal(out.totalResearchCost,null);
    const broken={prepare(){throw Error('private upstream auth secret');}};const response=await handleResearchCostsRoute(new Request('https://app.invalid/api/research/costs?workspace_id=a',{headers:{cookie:'leadintel_session=session-a'}}),{DB:broken});assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private|secret/);
  }finally{f.close();}
});
