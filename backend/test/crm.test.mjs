import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
let DatabaseSync=null;
try{({DatabaseSync}=await import('node:sqlite'));}catch{}
import {
  normalizeDomain, normalizeEmail, normalizePipelineStage, validateLifecycle,
  upsertCrmCompany, getCrmCompany, listCrmCompanies, setCrmPipelineStage,
  removeCrmFromPipeline, archiveCrmCompany, restoreCrmCompany, suppressCrmCompany,
  markCrmCustomer, appendCrmActivity, upsertCrmContacts
} from '../src/crm.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));

class D1Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.prepare(this.sql).get(...this.args)??null;}
  async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
  async run(){const result=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(result.changes||0)}};}
}
class D1Db{
  constructor(){this.raw=new DatabaseSync(':memory:');const migration=fs.readFileSync(path.join(__dirname,'..','migrations','0011_master_crm.sql'),'utf8');this.raw.exec(migration);}
  prepare(sql){return new D1Statement(this.raw,sql);}
  async batch(statements){const out=[];for(const statement of statements)out.push(await statement.run());return out;}
}
const ctx=(workspaceId='w1',role='owner')=>({workspaceId,userId:'u1',role});

const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node 22+ node:sqlite'},fn);
const candidate=(domain='example.com')=>({company:{company_name:'Example Manufacturing',domain,website:`https://${domain}/`,country:'LV',industry:'Manufacturing',opportunity_score:81,confidence:'High',source:'discovery'},intelligence:{matched_signals:[{name:'Expansion'}],evidence:[{url:`https://${domain}/news`,title:'Expansion'}],opportunity_hypothesis:'Expansion creates an opportunity',score_breakdown:{fit:25}},contacts:[{id:'apollo-1',name:'Anna Buyer',title:'Procurement Director',work_email:'ANNA@EXAMPLE.COM',source:'apollo'}]});

test('normalization creates stable CRM identities and maps the legacy pipeline stage',()=>{
  assert.equal(normalizeDomain('https://WWW.Example.com/products?a=1'),'example.com');
  assert.equal(normalizeDomain('not a domain'),'');
  assert.equal(normalizeEmail(' Buyer@Example.COM '),'buyer@example.com');
  assert.equal(normalizeEmail('bad address'),'');
  assert.equal(normalizePipelineStage('Contact Found'),'Qualified');
  assert.equal(normalizePipelineStage('Ready for Outreach'),'Ready for Outreach');
  assert.equal(validateLifecycle('suppressed'),'suppressed');
  assert.throws(()=>validateLifecycle('active'),error=>error.code==='CRM_INVALID_LIFECYCLE');
});

sqliteTest('company upsert deduplicates by workspace and domain while preserving cross-workspace isolation',async()=>{
  const db=new D1Db();
  const first=await upsertCrmCompany(db,ctx('w1'),candidate());
  const second=await upsertCrmCompany(db,ctx('w1'),candidate('https://www.example.com/path'));
  const third=await upsertCrmCompany(db,ctx('w2'),candidate());
  assert.equal(first.created,true);
  assert.equal(second.created,false);
  assert.equal(first.company.id,second.company.id);
  assert.notEqual(first.company.id,third.company.id);
  const w1=await listCrmCompanies(db,ctx('w1'),{});
  const w2=await listCrmCompanies(db,ctx('w2'),{});
  assert.equal(w1.companies.length,1);
  assert.match(w1.companies[0].matched_signals_json,/Expansion/);
  assert.equal(w2.companies.length,1);
});

sqliteTest('company records persist contacts, intelligence and append-only activity',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),candidate());
  const detail=await getCrmCompany(db,ctx(),saved.company.id);
  assert.equal(detail.company.normalized_domain,'example.com');
  assert.equal(detail.contacts.length,1);
  assert.equal(detail.contacts[0].normalized_email,'anna@example.com');
  assert.equal(detail.intelligence.opportunity_hypothesis,'Expansion creates an opportunity');
  assert.ok(detail.activities.some(row=>row.activity_type==='company.saved'));
  assert.ok(detail.activities.some(row=>row.activity_type==='contact.added'));
});

sqliteTest('contact deduplication uses normalized email and external person id without name-only merging',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),{...candidate(),contacts:[]});
  const companyId=saved.company.id;
  await upsertCrmContacts(db,ctx(),companyId,[{name:'Anna Buyer',work_email:'Anna@Example.com',source:'apollo',id:'p1'}]);
  await upsertCrmContacts(db,ctx(),companyId,[{name:'Anna B.',work_email:'anna@example.com',source:'apollo',id:'p1'}]);
  await upsertCrmContacts(db,ctx(),companyId,[{name:'Same Name',title:'CFO',source:'manual'}]);
  await upsertCrmContacts(db,ctx(),companyId,[{name:'Same Name',title:'CEO',source:'manual'}]);
  const detail=await getCrmCompany(db,ctx(),companyId);
  assert.equal(detail.contacts.filter(x=>x.normalized_email==='anna@example.com').length,1);
  assert.equal(detail.contacts.filter(x=>x.name==='Same Name').length,2);
});

sqliteTest('pipeline removal preserves CRM history; archive, restore, suppression and customer lifecycle are separate',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),candidate());
  const id=saved.company.id;
  await setCrmPipelineStage(db,ctx(),id,'Contact Found');
  let detail=await getCrmCompany(db,ctx(),id);
  assert.equal(detail.company.pipeline_stage,'Qualified');
  await removeCrmFromPipeline(db,ctx(),id);
  detail=await getCrmCompany(db,ctx(),id);
  assert.equal(detail.company.pipeline_stage,null);
  assert.ok(detail.activities.some(row=>row.activity_type==='pipeline.removed'));
  await archiveCrmCompany(db,ctx(),id);
  detail=await getCrmCompany(db,ctx(),id);assert.equal(detail.company.lifecycle_status,'archived');
  await restoreCrmCompany(db,ctx(),id);
  detail=await getCrmCompany(db,ctx(),id);assert.equal(detail.company.lifecycle_status,'prospect');
  await suppressCrmCompany(db,ctx(),id);
  await assert.rejects(()=>setCrmPipelineStage(db,ctx(),id,'Discovered'),error=>error.code==='CRM_COMPANY_SUPPRESSED');
  await assert.rejects(()=>restoreCrmCompany(db,ctx('w1','sales'),id),error=>error.code==='CRM_OWNER_REQUIRED');
  await restoreCrmCompany(db,ctx(),id);
  await markCrmCustomer(db,ctx(),id);
  detail=await getCrmCompany(db,ctx(),id);assert.equal(detail.company.lifecycle_status,'customer');
});

sqliteTest('activity writes require the company to belong to the authenticated workspace and are idempotent by explicit id',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx('w1'),candidate());
  await appendCrmActivity(db,ctx('w1'),{id:'activity-fixed-0001',companyId:saved.company.id,type:'content.approved',summary:'Approved'});
  await appendCrmActivity(db,ctx('w1'),{id:'activity-fixed-0001',companyId:saved.company.id,type:'content.approved',summary:'Approved'});
  const detail=await getCrmCompany(db,ctx('w1'),saved.company.id);
  assert.equal(detail.activities.filter(x=>x.id==='activity-fixed-0001').length,1);
  await assert.rejects(()=>appendCrmActivity(db,ctx('w2'),{companyId:saved.company.id,type:'content.approved'}),error=>error.code==='CRM_COMPANY_NOT_FOUND');
});

sqliteTest('CRM search matches company fields and contact name/email',async()=>{
  const db=new D1Db();
  await upsertCrmCompany(db,ctx(),candidate());
  assert.equal((await listCrmCompanies(db,ctx(),{q:'Example Manufacturing'})).companies.length,1);
  assert.equal((await listCrmCompanies(db,ctx(),{q:'anna@example.com'})).companies.length,1);
  assert.equal((await listCrmCompanies(db,ctx(),{q:'Anna Buyer'})).companies.length,1);
  assert.equal((await listCrmCompanies(db,ctx(),{q:'not-there'})).companies.length,0);
});
