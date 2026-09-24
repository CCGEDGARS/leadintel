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
  markCrmCustomer, appendCrmActivity, upsertCrmContacts, archiveCrmContact
} from '../src/crm.js';
import * as crm from '../src/crm.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));

class D1Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.prepare(this.sql).get(...this.args)??null;}
  async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
  async run(){const result=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(result.changes||0)}};}
}
class D1Db{
  constructor(){this.raw=new DatabaseSync(':memory:');this.batchTail=Promise.resolve();const migration=fs.readFileSync(path.join(__dirname,'..','migrations','0011_master_crm.sql'),'utf8');this.raw.exec(migration);}
  prepare(sql){return new D1Statement(this.raw,sql);}
  async batch(statements){const previous=this.batchTail;let release;this.batchTail=new Promise(resolve=>{release=resolve;});await previous;try{this.raw.exec('BEGIN IMMEDIATE');const out=[];for(const statement of statements)out.push(await statement.run());this.raw.exec('COMMIT');return out;}catch(error){this.raw.exec('ROLLBACK');throw error;}finally{release();}}
}
const ctx=(workspaceId='w1',role='owner')=>({workspaceId,userId:'u1',role});

const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node 22+ node:sqlite'},fn);
const candidate=(domain='example.com')=>({company:{company_name:'Example Manufacturing',domain,website:`https://${domain}/`,country:'LV',industry:'Manufacturing',opportunity_score:81,confidence:'High',source:'discovery'},intelligence:{matched_signals:[{name:'Expansion'}],evidence:[{url:`https://${domain}/news`,title:'Expansion'}],opportunity_hypothesis:'Expansion creates an opportunity',score_breakdown:{fit:25}},contacts:[{id:'apollo-1',name:'Anna Buyer',title:'Procurement Director',work_email:'ANNA@EXAMPLE.COM',source:'apollo'}]});

sqliteTest('suppression cannot be cleared by archive or customer actions, even by owner',async()=>{
  for(const role of ['owner','sales'])for(const action of [archiveCrmCompany,markCrmCustomer]){
    const db=new D1Db();
    const saved=await upsertCrmCompany(db,ctx(),candidate());
    await suppressCrmCompany(db,ctx(),saved.company.id);
    await assert.rejects(action(db,ctx('w1',role),saved.company.id),e=>e.code==='CRM_COMPANY_SUPPRESSED');
    assert.equal((await getCrmCompany(db,ctx(),saved.company.id)).company.lifecycle_status,'suppressed');
  }
});

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

sqliteTest('concurrent company saves for the same workspace domain resolve to one canonical company',async()=>{
  const db=new D1Db();
  const [first,second]=await Promise.all([
    upsertCrmCompany(db,ctx(),{company:{company_name:'Example Manufacturing',domain:'example.com'}}),
    upsertCrmCompany(db,ctx(),{company:{company_name:'Example Manufacturing Ltd',domain:'https://www.example.com/about'}})
  ]);
  assert.equal(first.company.id,second.company.id);
  assert.equal(db.raw.prepare(`SELECT COUNT(*) AS count FROM crm_companies WHERE workspace_id='w1'`).get().count,1);
});

sqliteTest('concurrent contact upserts for the same email resolve to one canonical contact',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),{company:{company_name:'Contact Race',domain:'contact-race.example'}});
  const companyId=saved.company.id;
  const [first,second]=await Promise.all([
    upsertCrmContacts(db,ctx(),companyId,[{name:'Anna Buyer',work_email:'Anna@Example.com',source:'apollo'}]),
    upsertCrmContacts(db,ctx(),companyId,[{name:'Anna B.',work_email:'anna@example.com',source:'apollo'}])
  ]);
  assert.equal(first[0].id,second[0].id);
  assert.equal(db.raw.prepare(`SELECT COUNT(*) AS count FROM crm_contacts WHERE workspace_id='w1' AND normalized_email='anna@example.com'`).get().count,1);
});

sqliteTest('company save rolls back when its activity write fails',async()=>{
  const db=new D1Db();
  db.raw.exec(`CREATE TRIGGER fail_company_saved_activity BEFORE INSERT ON crm_activities WHEN NEW.activity_type='company.saved' BEGIN SELECT RAISE(ABORT, 'forced activity failure'); END`);
  await assert.rejects(upsertCrmCompany(db,ctx(),{company:{company_name:'Rollback Test',domain:'rollback.example'}}));
  assert.equal(db.raw.prepare(`SELECT COUNT(*) AS count FROM crm_companies WHERE workspace_id='w1'`).get().count,0);
});

sqliteTest('contact save rolls back when its activity write fails',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),{company:{company_name:'Contact Rollback',domain:'contact-rollback.example'}});
  db.raw.exec(`CREATE TRIGGER fail_contact_added_activity BEFORE INSERT ON crm_activities WHEN NEW.activity_type='contact.added' BEGIN SELECT RAISE(ABORT, 'forced activity failure'); END`);
  await assert.rejects(upsertCrmContacts(db,ctx(),saved.company.id,[{name:'Anna Buyer',work_email:'anna@example.com'}]));
  assert.equal(db.raw.prepare(`SELECT COUNT(*) AS count FROM crm_contacts WHERE company_id=?`).get(saved.company.id).count,0);
});

sqliteTest('company lifecycle changes roll back when their activity write fails',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),{company:{company_name:'Transition Rollback',domain:'transition-rollback.example'}});
  db.raw.exec(`CREATE TRIGGER fail_company_archived_activity BEFORE INSERT ON crm_activities WHEN NEW.activity_type='company.archived' BEGIN SELECT RAISE(ABORT, 'forced activity failure'); END`);
  await assert.rejects(archiveCrmCompany(db,ctx(),saved.company.id));
  assert.equal((await getCrmCompany(db,ctx(),saved.company.id)).company.lifecycle_status,'prospect');
});

sqliteTest('upserting an archived company cannot put it back into the active pipeline',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),candidate());
  await archiveCrmCompany(db,ctx(),saved.company.id);

  await assert.rejects(
    upsertCrmCompany(db,ctx(),{...candidate(),company:{...candidate().company,pipeline_stage:'Discovered'}}),
    error=>error.code==='CRM_COMPANY_ARCHIVED'&&error.status===409
  );

  const detail=await getCrmCompany(db,ctx(),saved.company.id);
  assert.equal(detail.company.lifecycle_status,'archived');
  assert.equal(detail.company.pipeline_stage,null);
});

sqliteTest('CRM activity history paginates without duplicates until the full timeline is read',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),{company:{company_name:'Timeline',domain:'timeline.example'}});
  for(let index=0;index<85;index++){
    await appendCrmActivity(db,ctx(),{
      companyId:saved.company.id,
      id:`activity-${String(index).padStart(4,'0')}`,
      type:'content.approved',
      summary:`Activity ${index}`,
      occurredAt:new Date(Date.UTC(2030,0,1,index,0,0)).toISOString()
    });
  }

  const detail=await getCrmCompany(db,ctx(),saved.company.id);
  assert.equal(detail.activities.length,40);
  assert.ok(detail.activity_next_cursor);

  const pages=[];
  let cursor='';
  do{
    assert.equal(typeof crm.listCrmActivities,'function','CRM must expose paginated activity history');
    const page=await crm.listCrmActivities(db,ctx(),saved.company.id,{limit:40,cursor});
    pages.push(page.activities);
    cursor=page.next_cursor||'';
  }while(cursor);

  const ids=pages.flat().map(activity=>activity.id);
  assert.equal(pages.length,3);
  assert.deepEqual(pages.map(page=>page.length),[40,40,6]);
  assert.equal(ids.length,86);
  assert.equal(new Set(ids).size,86);
  assert.equal(pages[0][0].id,'activity-0084');
  assert.equal(pages[1][0].id,'activity-0044');
  assert.equal(pages[2][0].id,'activity-0004');
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

sqliteTest('archived contact identities return a clear conflict instead of a database constraint error',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx(),{company:{company_name:'Archived Contact',domain:'archived-contact.example'}});
  const [contact]=await upsertCrmContacts(db,ctx(),saved.company.id,[{name:'Anna Buyer',work_email:'anna@example.com'}]);
  await archiveCrmContact(db,ctx(),contact.id);
  await assert.rejects(
    upsertCrmContacts(db,ctx(),saved.company.id,[{name:'Anna Buyer',work_email:'anna@example.com'}]),
    error=>error.code==='CRM_CONTACT_ARCHIVED'&&error.status===409
  );
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
