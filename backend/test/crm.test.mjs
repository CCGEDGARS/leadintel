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
  constructor(){this.raw=new DatabaseSync(':memory:');this.batchTail=Promise.resolve();const migration=fs.readFileSync(path.join(__dirname,'..','migrations','0011_master_crm.sql'),'utf8');this.raw.exec(migration);this.raw.exec(fs.readFileSync(new URL('../migrations/0022_crm_public_contact_sources.sql',import.meta.url),'utf8'));}
  prepare(sql){return new D1Statement(this.raw,sql);}
  async batch(statements){const previous=this.batchTail;let release;this.batchTail=new Promise(resolve=>{release=resolve;});await previous;try{this.raw.exec('BEGIN IMMEDIATE');const out=[];for(const statement of statements)out.push(await statement.run());this.raw.exec('COMMIT');return out;}catch(error){this.raw.exec('ROLLBACK');throw error;}finally{release();}}
}
const ctx=(workspaceId='w1',role='owner')=>({workspaceId,userId:'u1',role});

const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node 22+ node:sqlite'},fn);
const candidate=(domain='example.com')=>({company:{company_name:'Example Manufacturing',domain,website:`https://${domain}/`,country:'LV',industry:'Manufacturing',opportunity_score:81,confidence:'High',source:'discovery'},intelligence:{matched_signals:[{name:'Expansion'}],evidence:[{url:`https://${domain}/news`,title:'Expansion'}],opportunity_hypothesis:'Expansion creates an opportunity',score_breakdown:{fit:25}},contacts:[{id:'apollo-1',name:'Anna Buyer',title:'Procurement Director',work_email:'ANNA@EXAMPLE.COM',source:'apollo'}]});

sqliteTest('CRM hydration prefers accepted saved email over a newer public copy of the same external person',async()=>{
 const db=new D1Db(),{company}=await upsertCrmCompany(db,ctx(),{company:{company_name:'Example',domain:'example.com'}});
 const [verified]=await upsertCrmContacts(db,ctx(),company.id,[{external_person_id:'same-person',name:'Anna Buyer',work_email:'anna@example.com',email_status:'verified',source:'treg'}]);
 const [publicCopy]=await upsertCrmContacts(db,ctx(),company.id,[{external_person_id:'same-person',name:'Anna Buyer',email_status:'public_unverified',source:'public_research'}]);
 db.raw.prepare('UPDATE crm_contacts SET updated_at=? WHERE id=?').run('2026-10-21T23:00:00Z',publicCopy.id);
 const detail=await getCrmCompany(db,ctx(),company.id),hydrated=detail.contacts.find(c=>c.external_person_id==='same-person');
 assert.equal(hydrated.id,verified.id);assert.equal(hydrated.work_email,'anna@example.com');assert.equal(detail.contacts.length,2,'keep both source records');
 await upsertCrmContacts(db,ctx(),company.id,[{external_person_id:'same-person',name:'Anna Buyer',work_email:'anna@wrong.example',email_status:'verified',source:'manual'}]);
 assert.equal((await getCrmCompany(db,ctx(),company.id)).contacts.find(c=>c.external_person_id==='same-person').id,verified.id,'unsupported provider or wrong-domain claims cannot outrank accepted evidence');
});

sqliteTest('paid profile data survives stale research replacement, empty rosters, older activity pages and later failed lookups',async()=>{
 const db=new D1Db(),buyer={id:'paid-anna',name:'Anna Buyer',title:'Director'},pack=candidate();pack.contacts=[];
 pack.intelligence.research_snapshot={buyerResearch:{version:2,checkedAt:'2026-10-20T08:00:00Z',buyers:[buyer]}};
 const {company}=await upsertCrmCompany(db,ctx(),pack);
 const data={version:1,domain:'example.com',personId:buyer.id,identityName:buyer.name,checkedAt:'2026-10-21T08:00:00Z',status:'updated',profile:{status:'provider_reported',title:'Director',city:'Riga'},phone:{status:'provider_listed',number:'+37120000001'},costMicro:14500,callIds:['profile-call']};
 await appendCrmActivity(db,ctx(),{companyId:company.id,type:'contact.enriched',metadata:{contact_data:data},occurredAt:data.checkedAt});
 for(let i=0;i<45;i++)await appendCrmActivity(db,ctx(),{companyId:company.id,type:'company.saved',occurredAt:'2026-10-21T09:00:00Z'});
 await upsertCrmCompany(db,ctx(),pack); // A stale client has no enrichment data.
 let detail=await getCrmCompany(db,ctx(),company.id);
 assert.equal(detail.intelligence.research_snapshot.buyerResearch.buyers[0].contactData.profile.city,'Riga');
 assert.equal(detail.contactData[0].phone.number,'+37120000001');
 await appendCrmActivity(db,ctx(),{companyId:company.id,type:'contact.enriched',metadata:{contact_data:{...data,checkedAt:'2026-10-21T09:30:00Z',profile:{status:'provider_reported',title:'Procurement Director'},phone:{status:'provider_listed',number:'+37120000001'}}},occurredAt:'2026-10-21T09:30:00Z'});
 await appendCrmActivity(db,ctx(),{companyId:company.id,type:'contact.enriched',metadata:{contact_data:{...data,checkedAt:'2026-10-21T10:00:00Z',status:'partial',profile:{status:'error',reason:'Unavailable'},phone:{status:'not_requested'}}},occurredAt:'2026-10-21T10:00:00Z'});
 await upsertCrmCompany(db,ctx(),{...pack,intelligence:{research_snapshot:{buyerResearch:{buyers:[]}}}});
 detail=await getCrmCompany(db,ctx(),company.id);
 assert.equal(detail.contactData[0].profile.city,'Riga');assert.equal(detail.contactData[0].profile.title,'Procurement Director');assert.equal(detail.contactData[0].phone.number,'+37120000001');
 assert.equal(detail.contactData[0].lastAttempt.status,'partial');
 await appendCrmActivity(db,ctx(),{companyId:company.id,type:'contact.enriched',metadata:{contact_data:{...data,checkedAt:'2026-10-21T11:00:00Z',status:'partial',lastAttempt:{phone:'error',phoneReason:'Treg usage limit reached'},phone:{...data.phone}}},occurredAt:'2026-10-21T11:00:00Z'});
 detail=await getCrmCompany(db,ctx(),company.id);assert.equal(detail.contactData[0].phone.number,data.phone.number);assert.equal(detail.contactData[0].lastAttempt.phone,'error');assert.equal(detail.contactData[0].lastAttempt.phoneReason,'Treg usage limit reached');
 await assert.rejects(getCrmCompany(db,ctx('other-workspace'),company.id),/not found/i);
 await upsertCrmCompany(db,ctx(),{...pack,intelligence:{research_snapshot:{buyerResearch:{buyers:[{...buyer,name:'Different Person'}]}}}});
 detail=await getCrmCompany(db,ctx(),company.id);assert.ok(!detail.intelligence.research_snapshot.buyerResearch.buyers[0].contactData);
 const [contact]=await upsertCrmContacts(db,ctx(),company.id,[{external_person_id:buyer.id,name:buyer.name,source:'treg'}]);
 await archiveCrmContact(db,ctx(),contact.id);
 detail=await getCrmCompany(db,ctx(),company.id);assert.equal(detail.contactData.length,0);
 assert.ok(db.raw.prepare("SELECT COUNT(*) AS n FROM crm_activities WHERE activity_type='contact.enriched'").get().n>0,'archiving hides the profile but retains its history');
});

sqliteTest('unconfirmed Gmail research and query receipts round-trip through durable CRM without creating a Gmail recipient',async()=>{
  await import('../../customer/discovery-engine.js');const D=globalThis.LeadIntelDiscovery,{default:C}=await import('../../customer/crm-engine.js');
  const row={url:'https://association.test/business',markdown:'Anna Andersson\nHead of Procurement, Example Manufacturing\nBusiness contact: anna.andersson@gmail.com',sourceRead:true};
  const researched={company:'Example Manufacturing',domain:'example.com',people:[{id:'anna',name:'Anna Andersson',title:'Head of Procurement',organization:'Example Manufacturing',publicNameUrl:'https://example.com/team'}]};
  await D.runMandatoryBuyerResearch(researched,{search:async q=>q.includes('"anna.andersson@gmail.com"')?[row]:[],readPage:async url=>({markdown:url===row.url?row.markdown:'Example Manufacturing team',metadata:{sourceURL:url}})});
  const db=new D1Db(),pack=C.mapDiscoveryCandidateToCrm(researched),saved=await upsertCrmCompany(db,ctx(),pack),detail=await getCrmCompany(db,ctx(),saved.company.id);
  const person=detail.intelligence.research_snapshot.buyerResearch.buyers[0];
  assert.equal(person.gmailMatches[0].status,'unconfirmed');assert.equal(person.gmailMatches[0].email,'anna.andersson@gmail.com');
  assert.equal(person.contactResearch.checks.gmail.queryLog.length,3);assert.equal(person.contactResearch.checks.direct_email.queryLog.length,2);
  assert.ok(detail.contacts.every(contact=>!String(contact.work_email||'').endsWith('@gmail.com')));
  await assert.rejects(getCrmCompany(db,ctx('other-workspace'),saved.company.id),/not found/i);
});

sqliteTest('permanent company deletion cascades through contacts, research and activities while preserving another workspace',async()=>{
  const db=new D1Db();
  const saved=await upsertCrmCompany(db,ctx('w1'),candidate());
  await upsertCrmCompany(db,ctx('w2'),candidate());
  for(const table of ['crm_companies','crm_contacts','crm_intelligence','crm_activities'])assert.ok(db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE workspace_id='w1'`).get().n>0,table);
  await crm.deleteCrmCompany(db,ctx('w1'),saved.company.id);
  for(const table of ['crm_companies','crm_contacts','crm_intelligence','crm_activities']){
    assert.equal(db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE workspace_id='w1'`).get().n,0,table);
    assert.ok(db.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE workspace_id='w2'`).get().n>0,table);
  }
});

sqliteTest('public buyer evidence survives CRM refresh without downgrading a verified email',async()=>{
  const db=new D1Db();
  const {company}=await upsertCrmCompany(db,ctx(),{...candidate(),contacts:[]});
  const publicContact={external_person_id:'apollo-1',source:'apollo',name:'Anna Buyer',work_email:'anna@example.com',email_status:'public_unverified',public_name_url:'https://example.com/team',public_email_url:'https://example.com/team',public_linkedin_url:'https://www.linkedin.com/in/anna-buyer'};
  await upsertCrmContacts(db,ctx(),company.id,[publicContact]);
  let [contact]=(await getCrmCompany(db,ctx(),company.id)).contacts;
  assert.equal(contact.public_email_url,'https://example.com/team');
  assert.equal(contact.email_status,'public_unverified');
  await upsertCrmContacts(db,ctx(),company.id,[{external_person_id:'apollo-1',source:'apollo',name:'Anna Buyer',work_email:'anna.verified@example.com',email_status:'verified'}]);
  await upsertCrmContacts(db,ctx(),company.id,[publicContact]);
  [contact]=(await getCrmCompany(db,ctx(),company.id)).contacts;
  assert.equal(contact.work_email,'anna.verified@example.com');
  assert.equal(contact.email_status,'verified');
  assert.equal(contact.public_name_url,'https://example.com/team');
});

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

sqliteTest('corporate newsroom and investor aliases reuse saved CRM identity and preserve contact and pipeline history',async()=>{
 const db=new D1Db();const original=await upsertCrmCompany(db,ctx(),candidate('polestar.com'));
 await setCrmPipelineStage(db,ctx(),original.company.id,'Meeting');
 // Simulate an existing legacy record saved before canonical company-domain support.
 db.raw.prepare('UPDATE crm_companies SET normalized_domain=? WHERE id=?').run('media.polestar.com',original.company.id);
 const refreshed=await upsertCrmCompany(db,ctx(),{...candidate('investors.polestar.com'),contacts:[]});
 assert.equal(refreshed.company.id,original.company.id);
 const detail=await getCrmCompany(db,ctx(),original.company.id);
 assert.equal(detail.company.pipeline_stage,'Meeting');assert.equal(detail.contacts.length,1);
 assert.equal((await listCrmCompanies(db,ctx())).companies.length,1);
 await suppressCrmCompany(db,ctx(),original.company.id);
 const suppressed=await upsertCrmCompany(db,ctx(),candidate('polestar.com'));assert.equal(suppressed.company.lifecycle_status,'suppressed');assert.equal(suppressed.company.id,original.company.id);
 await assert.rejects(upsertCrmCompany(db,ctx(),{company:{...candidate('polestar.com').company,pipeline_stage:'Qualified'}}),error=>error.code==='CRM_COMPANY_SUPPRESSED');
 const other=await upsertCrmCompany(db,ctx('w2'),candidate('media.polestar.com'));assert.notEqual(other.company.id,original.company.id);
});

sqliteTest('company identity cannot be silently replaced by a supplied CRM id or unrelated website',async()=>{
 const db=new D1Db(),saved=await upsertCrmCompany(db,ctx(),candidate());
 await assert.rejects(upsertCrmCompany(db,ctx(),{company:{id:saved.company.id,company_name:'Different',domain:'other.example'}}),error=>error.code==='CRM_COMPANY_IDENTITY_CONFLICT');
 await assert.rejects(upsertCrmCompany(db,ctx('w2'),{company:{id:saved.company.id,company_name:'Different',domain:'example.com'}}),error=>error.code==='CRM_COMPANY_NOT_FOUND');
 await assert.rejects(upsertCrmCompany(db,ctx(),{company:{company_name:'Different',domain:'example.com',website:'https://other.example/'}}),error=>error.code==='CRM_COMPANY_IDENTITY_CONFLICT');
 await assert.rejects(crm.updateCrmCompany(db,ctx(),saved.company.id,{website:'https://other.example/'}),error=>error.code==='CRM_COMPANY_IDENTITY_CONFLICT');
 const detail=await getCrmCompany(db,ctx(),saved.company.id);assert.equal(detail.company.company_name,'Example Manufacturing');assert.equal(detail.company.normalized_domain,'example.com');assert.equal((await listCrmCompanies(db,ctx(),{})).companies.length,1);
 const alias=await upsertCrmCompany(db,ctx(),{company:{id:saved.company.id,company_name:'Example Manufacturing',domain:'media.example.com',website:'https://media.example.com/news'}});assert.equal(alias.company.id,saved.company.id);
});

sqliteTest('replacing CRM intelligence retains immutable complete previous snapshots in scoped paginated history',async()=>{
 const db=new D1Db(),pack=candidate();pack.contacts=[];pack.intelligence.research_snapshot={companyResearch:{version:1,domain:'example.com',strategyFingerprint:'historical',buyerRoles:'Manual engineering role',buyerRolesSource:'manual'},buyerResearch:{discovery:{companyDossier:{facts:[{quote:'Original dossier quote'}]}}}};
 pack.intelligence.evidence=Array.from({length:28},(_,i)=>({url:`https://example.com/source/${i}`,text:`Quote ${i}`}));
 const saved=await upsertCrmCompany(db,ctx(),pack);
 const replacement={matched_signals:[],evidence:[{url:'https://example.com/new',text:'New quote'}],research_snapshot:{companyResearch:{version:1,domain:'example.com',strategyFingerprint:'new',qualification:{eligible:false}}}};
 await crm.upsertCrmIntelligence(db,ctx(),saved.company.id,replacement);
 await crm.upsertCrmIntelligence(db,ctx(),saved.company.id,replacement);
 for(let i=0;i<45;i++)await appendCrmActivity(db,ctx(),{companyId:saved.company.id,type:'company.saved',occurredAt:'2099-10-31T10:00:00Z'});
 let cursor=null,history=[];do{const page=await crm.listCrmActivities(db,ctx(),saved.company.id,{limit:20,cursor});history.push(...page.activities);cursor=page.next_cursor;}while(cursor);
 const archives=history.filter(row=>row.activity_type==='intelligence.snapshot');assert.equal(archives.length,1);const old=archives[0].metadata.intelligence;assert.equal(old.evidence.length,28);assert.equal(old.research_snapshot.companyResearch.buyerRoles,'Manual engineering role');assert.equal(old.research_snapshot.buyerResearch.discovery.companyDossier.facts[0].quote,'Original dossier quote');
 const current=await getCrmCompany(db,ctx(),saved.company.id);assert.equal(current.intelligence.evidence[0].text,'New quote');assert.equal(current.intelligence.research_snapshot.companyResearch.strategyFingerprint,'new');assert.equal(current.intelligence.research_snapshot.companyResearch.qualification.eligible,false);
 await assert.rejects(crm.listCrmActivities(db,ctx('w2'),saved.company.id,{}),error=>error.code==='CRM_COMPANY_NOT_FOUND');
});

sqliteTest('failed intelligence replacement rolls back its historical snapshot with the current update',async()=>{
 const db=new D1Db(),pack=candidate(),saved=await upsertCrmCompany(db,ctx(),pack);
 db.raw.exec(`CREATE TRIGGER reject_intelligence_update BEFORE UPDATE ON crm_intelligence BEGIN SELECT RAISE(ABORT,'intelligence storage rejected'); END;`);
 await assert.rejects(crm.upsertCrmIntelligence(db,ctx(),saved.company.id,{evidence:[{url:'https://example.com/new',text:'New quote'}]}),/storage rejected/);
 assert.deepEqual((await getCrmCompany(db,ctx(),saved.company.id)).intelligence.evidence,pack.intelligence.evidence);
 assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM crm_activities WHERE activity_type='intelligence.snapshot'").get().n,0);
});

sqliteTest('concurrent intelligence replacements archive each actual preceding revision once',async()=>{
 const db=new D1Db(),pack=candidate(),saved=await upsertCrmCompany(db,ctx(),pack);
 const versions=['Second quote','Third quote'];
 await Promise.all(versions.map(text=>crm.upsertCrmIntelligence(db,ctx(),saved.company.id,{evidence:[{url:'https://example.com/revision',text}]})));
 const rows=(await crm.listCrmActivities(db,ctx(),saved.company.id,{limit:100})).activities.filter(row=>row.activity_type==='intelligence.snapshot');
 assert.equal(rows.length,2);const retained=rows.flatMap(row=>row.metadata.intelligence.evidence.map(item=>item.text||item.title));
 assert.ok(retained.includes('Expansion'));assert.equal(retained.filter(value=>versions.includes(value)).length,1);
 const current=(await getCrmCompany(db,ctx(),saved.company.id)).intelligence.evidence[0].text;assert.ok(versions.includes(current));assert.ok(!retained.includes(current));
});
