const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();

export const CRM_LIFECYCLES=Object.freeze(['prospect','customer','archived','suppressed']);
export const CRM_PIPELINE_STAGES=Object.freeze(['Discovered','Qualified','Ready for Outreach','Contacted','Replied','Meeting','Proposal','Won','Lost']);
const TERMINAL_STAGES=new Set(['Won','Lost']);

function crmError(code,message,status=400){const error=new Error(message);error.code=code;error.status=status;return error;}
function clean(value,max=1000){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);}
function safeJson(value,fallback){try{return JSON.parse(value);}catch{return fallback;}}
function jsonString(value,fallback){try{return JSON.stringify(value??fallback);}catch{return JSON.stringify(fallback);}}
function validActivityId(value){return /^[A-Za-z0-9._:-]{8,128}$/.test(String(value||''));}
function isContactUniqueConstraint(error){const message=String(error?.message||'');return message.includes('UNIQUE constraint failed: crm_contacts.')&&/normalized_email|external_person_id/.test(message);}
function safeUrl(value){const raw=clean(value,2000);if(!raw)return '';try{const candidate=/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:`https://${raw}`;const url=new URL(candidate);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}

export function normalizeDomain(value){const raw=clean(value,2000);if(!raw||/\s/.test(raw))return '';try{const candidate=/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:`https://${raw}`;const url=new URL(candidate);let host=String(url.hostname||'').toLowerCase().replace(/\.$/,'').replace(/^www\./,'');if(!host||host==='localhost'||!host.includes('.'))return '';return host.slice(0,253);}catch{return '';}}
export function normalizeEmail(value){const email=clean(value,320).toLowerCase();if(!email||/\s/.test(email)||!(/^[^@]+@[^@]+\.[^@]+$/.test(email)))return '';return email;}
export function validateLifecycle(value){const lifecycle=clean(value,32);if(!CRM_LIFECYCLES.includes(lifecycle))throw crmError('CRM_INVALID_LIFECYCLE',`Invalid CRM lifecycle: ${lifecycle||'(empty)'}`);return lifecycle;}
export function normalizePipelineStage(value,{allowNull=true}={}){if(value===null||value===undefined||value===''){if(allowNull)return null;throw crmError('CRM_INVALID_PIPELINE_STAGE','Pipeline stage is required');}const stage=clean(value,64)==='Contact Found'?'Qualified':clean(value,64);if(!CRM_PIPELINE_STAGES.includes(stage))throw crmError('CRM_INVALID_PIPELINE_STAGE',`Invalid CRM pipeline stage: ${stage}`);return stage;}
export function nextPipelineStage(current,requested){const next=normalizePipelineStage(requested,{allowNull:false});const existing=normalizePipelineStage(current);if(!existing)return next;if(TERMINAL_STAGES.has(existing))return existing;return CRM_PIPELINE_STAGES.indexOf(next)>=CRM_PIPELINE_STAGES.indexOf(existing)?next:existing;}
export function canRestoreSuppressed(role){return clean(role,32).toLowerCase()==='owner';}

async function companyRow(db,workspaceId,id){return db.prepare(`SELECT * FROM crm_companies WHERE id=? AND workspace_id=? AND deleted_at IS NULL`).bind(id,workspaceId).first();}
export async function findCrmCompanyByDomain(db,workspaceId,value){const domain=normalizeDomain(value);if(!domain)return null;return db.prepare(`SELECT * FROM crm_companies WHERE workspace_id=? AND normalized_domain=? AND deleted_at IS NULL`).bind(workspaceId,domain).first();}
async function companyByDomain(db,workspaceId,domain){return findCrmCompanyByDomain(db,workspaceId,domain);}
function parseIntelligence(row){if(!row)return null;return {...row,matched_signals:safeJson(row.matched_signals_json,[]),evidence:safeJson(row.evidence_json,[]),score_breakdown:safeJson(row.score_breakdown_json,{}),research_snapshot:safeJson(row.research_snapshot_json,{})};}
function parseActivity(row){return {...row,metadata:safeJson(row.metadata_json,{})};}
function parseActivityCursor(value){if(!value)return null;try{const cursor=JSON.parse(String(value));if(!cursor||typeof cursor!=='object'||Array.isArray(cursor)||!clean(cursor.occurred_at,64)||!clean(cursor.created_at,64)||!validActivityId(cursor.id))throw new Error('Invalid cursor');return {occurred_at:clean(cursor.occurred_at,64),created_at:clean(cursor.created_at,64),id:String(cursor.id)};}catch{throw crmError('CRM_ACTIVITY_CURSOR_INVALID','Invalid CRM activity cursor');}}

function activityValues(context,activity={}){const workspaceId=clean(context?.workspaceId,160);const companyId=clean(activity.companyId||activity.company_id,160);if(!workspaceId||!companyId)throw crmError('CRM_ACTIVITY_INVALID','Workspace and company are required');const type=clean(activity.type||activity.activity_type,80);if(!type)throw crmError('CRM_ACTIVITY_INVALID','Activity type is required');return [validActivityId(activity.id)?String(activity.id):uuid(),workspaceId,companyId,clean(activity.contactId||activity.contact_id,160)||null,type,clean(activity.channel,40)||null,clean(activity.direction,40)||null,clean(activity.subject,500)||null,clean(activity.summary,4000)||null,jsonString(activity.metadata,{}),clean(activity.occurredAt||activity.occurred_at,64)||now(),now(),clean(context?.userId,160)||null];}
function activityInsertStatement(db,values,guardSql='',guardArgs=[]){const columns='id,workspace_id,company_id,contact_id,activity_type,channel,direction,subject,summary,metadata_json,occurred_at,created_at,actor_user_id';const placeholders=values.map(()=>'?').join(',');const sql=guardSql?`INSERT OR IGNORE INTO crm_activities(${columns}) SELECT ${placeholders} WHERE ${guardSql}`:`INSERT OR IGNORE INTO crm_activities(${columns}) VALUES(${placeholders})`;return db.prepare(sql).bind(...values,...guardArgs);}
async function writeWithActivity(db,context,activity,statements=[]){const values=activityValues(context,activity);const [id,workspaceId,companyId,contactId]=values;const company=await companyRow(db,workspaceId,companyId);if(!company)throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);let validContactId=contactId;if(validContactId){const contact=await db.prepare(`SELECT id FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL`).bind(validContactId,workspaceId,companyId).first();if(!contact)values[3]=null;}const result=await db.batch([...statements,activityInsertStatement(db,values)]);const activityResult=result?.at?.(-1);return {id,inserted:Number(activityResult?.meta?.changes||0)>0};}
function guardedActivityStatement(db,context,activity,guardSql,guardArgs=[]){const values=activityValues(context,activity);return activityInsertStatement(db,values,guardSql,guardArgs);}

export async function appendCrmActivity(db,context,activity={}){return writeWithActivity(db,context,activity);}

async function findContactIdentity(db,workspaceId,companyId,{email,source,externalId}){
  const byEmail=email?await db.prepare(`SELECT * FROM crm_contacts WHERE workspace_id=? AND normalized_email=?`).bind(workspaceId,email).first():null;
  const byExternal=externalId?await db.prepare(`SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND source=? AND external_person_id=?`).bind(workspaceId,companyId,source,externalId).first():null;
  if(byEmail&&byExternal&&byEmail.id!==byExternal.id)throw crmError('CRM_CONTACT_CONFLICT','The email and external identity belong to different contacts',409);
  const existing=byEmail||byExternal;
  if(existing&&existing.company_id!==companyId)throw crmError('CRM_CONTACT_CONFLICT','This contact email is already attached to another company',409);
  if(existing?.archived_at)throw crmError('CRM_CONTACT_ARCHIVED','This contact is archived and cannot be silently reactivated',409);
  return existing;
}

export async function upsertCrmContacts(db,context,companyId,contacts=[]){
  const workspaceId=clean(context?.workspaceId,160);
  if(!await companyRow(db,workspaceId,companyId))throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);
  const saved=[];
  for(const input of (Array.isArray(contacts)?contacts:[]).slice(0,50)){
    const email=normalizeEmail(input?.work_email||input?.email);
    const source=clean(input?.source,80)||'manual';
    const externalId=clean(input?.external_person_id||input?.id,180)||null;
    const identity={email,source,externalId};
    const name=clean(input?.name,180)||null;
    const title=clean(input?.title,180)||null;
    const workEmail=email?clean(input?.work_email||input?.email,320):null;
    const emailStatus=clean(input?.email_status,64)||null;
    const linkedin=clean(input?.linkedin_url,1000)||null;
    let existing=await findContactIdentity(db,workspaceId,companyId,identity);
    if(!existing){
      const id=uuid();
      const stamp=now();
      const insert=db.prepare(`INSERT OR IGNORE INTO crm_contacts(id,workspace_id,company_id,name,title,work_email,normalized_email,external_person_id,email_status,linkedin_url,source,created_at,updated_at,archived_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`).bind(id,workspaceId,companyId,name,title,workEmail,email||null,externalId,emailStatus,linkedin,source,stamp,stamp);
      const event=guardedActivityStatement(db,context,{companyId,contactId:id,type:'contact.added',summary:name||email||'Contact added',metadata:{source}},`EXISTS (SELECT 1 FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=?)`,[id,workspaceId,companyId]);
      const result=await db.batch([insert,event]);
      const inserted=Number(result?.[0]?.meta?.changes||0)>0;
      if(inserted){
        saved.push(await db.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=?`).bind(id,workspaceId).first());
        continue;
      }
      existing=await findContactIdentity(db,workspaceId,companyId,identity);
      if(!existing)throw crmError('CRM_CONTACT_SAVE_CONFLICT','Contact changed while it was being saved',409);
    }
    const stamp=now();
    const update=db.prepare(`UPDATE crm_contacts SET name=?,title=?,work_email=?,normalized_email=?,external_person_id=?,email_status=?,linkedin_url=?,source=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(name||existing.name,title||existing.title,workEmail||existing.work_email,email||existing.normalized_email,externalId||existing.external_person_id,emailStatus||existing.email_status,linkedin||existing.linkedin_url,source||existing.source,stamp,existing.id,workspaceId);
    try{
      await writeWithActivity(db,context,{companyId,contactId:existing.id,type:'contact.updated',summary:name||email||'Contact updated',metadata:{source}},[update]);
    }catch(error){
      if(isContactUniqueConstraint(error))throw crmError('CRM_CONTACT_CONFLICT','This contact email or external identity already exists',409);
      throw error;
    }
    saved.push(await db.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=?`).bind(existing.id,workspaceId).first());
  }
  return saved;
}

export async function upsertCrmIntelligence(db,context,companyId,intelligence={}){const workspaceId=clean(context?.workspaceId,160);const stamp=now();const upsert=db.prepare(`INSERT INTO crm_intelligence(company_id,workspace_id,matched_signals_json,evidence_json,opportunity_hypothesis,score_breakdown_json,confidence,research_snapshot_json,intelligence_updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET workspace_id=excluded.workspace_id,matched_signals_json=excluded.matched_signals_json,evidence_json=excluded.evidence_json,opportunity_hypothesis=excluded.opportunity_hypothesis,score_breakdown_json=excluded.score_breakdown_json,confidence=excluded.confidence,research_snapshot_json=excluded.research_snapshot_json,intelligence_updated_at=excluded.intelligence_updated_at`).bind(companyId,workspaceId,jsonString(intelligence.matched_signals,[]),jsonString(intelligence.evidence,[]),clean(intelligence.opportunity_hypothesis,4000)||null,jsonString(intelligence.score_breakdown,{}),clean(intelligence.confidence,40)||null,jsonString(intelligence.research_snapshot,{}),stamp);await writeWithActivity(db,context,{companyId,type:'intelligence.updated',summary:'Commercial intelligence updated',metadata:{confidence:clean(intelligence.confidence,40)||null}},[upsert]);return parseIntelligence(await db.prepare(`SELECT * FROM crm_intelligence WHERE company_id=? AND workspace_id=?`).bind(companyId,workspaceId).first());}

export async function getCrmCompany(db,context,companyId){const workspaceId=clean(context?.workspaceId,160);const company=await companyRow(db,workspaceId,companyId);if(!company)throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);const {results:contacts=[]}=await db.prepare(`SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND archived_at IS NULL ORDER BY updated_at DESC`).bind(workspaceId,companyId).all();const intelligence=parseIntelligence(await db.prepare(`SELECT * FROM crm_intelligence WHERE workspace_id=? AND company_id=?`).bind(workspaceId,companyId).first());const history=await listCrmActivities(db,context,companyId,{limit:40});return {company,contacts,intelligence,activities:history.activities,activity_next_cursor:history.next_cursor};}

export async function listCrmActivities(db,context,companyId,filters={}){const workspaceId=clean(context?.workspaceId,160);const company=await companyRow(db,workspaceId,companyId);if(!company)throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);const limit=Math.max(1,Math.min(100,Number(filters.limit)||40));const cursor=parseActivityCursor(filters.cursor);const clauses=['workspace_id=?','company_id=?'];const args=[workspaceId,companyId];if(cursor){clauses.push(`(occurred_at<? OR (occurred_at=? AND created_at<?) OR (occurred_at=? AND created_at=? AND id<?))`);args.push(cursor.occurred_at,cursor.occurred_at,cursor.created_at,cursor.occurred_at,cursor.created_at,cursor.id);}args.push(limit+1);const {results=[]}=await db.prepare(`SELECT * FROM crm_activities WHERE ${clauses.join(' AND ')} ORDER BY occurred_at DESC,created_at DESC,id DESC LIMIT ?`).bind(...args).all();const hasMore=results.length>limit;const activities=results.slice(0,limit);const last=activities.at(-1);return {activities:activities.map(parseActivity),next_cursor:hasMore&&last?JSON.stringify({occurred_at:last.occurred_at,created_at:last.created_at,id:last.id}):null};}

export async function listCrmCompanies(db,context,filters={}){const workspaceId=clean(context?.workspaceId,160);const clauses=[`c.workspace_id=?`,`c.deleted_at IS NULL`];const args=[workspaceId];const lifecycle=clean(filters.lifecycle,32);if(lifecycle&&lifecycle!=='all'){validateLifecycle(lifecycle);clauses.push(`c.lifecycle_status=?`);args.push(lifecycle);}const pipeline=clean(filters.pipeline_stage||filters.pipelineStage,64);if(pipeline==='active'){clauses.push(`c.pipeline_stage IS NOT NULL`);}else if(pipeline){clauses.push(`c.pipeline_stage=?`);args.push(normalizePipelineStage(pipeline,{allowNull:false}));}const q=clean(filters.q,200);if(q){clauses.push(`(c.company_name LIKE ? COLLATE NOCASE OR c.normalized_domain LIKE ? COLLATE NOCASE OR EXISTS (SELECT 1 FROM crm_contacts ct WHERE ct.workspace_id=c.workspace_id AND ct.company_id=c.id AND ct.archived_at IS NULL AND (ct.name LIKE ? COLLATE NOCASE OR ct.normalized_email LIKE ? COLLATE NOCASE)))`);const needle=`%${q}%`;args.push(needle,needle,needle,needle);}const limit=Math.max(1,Math.min(100,Number(filters.limit)||50));const offset=Math.max(0,Number(filters.cursor)||0);const sql=`SELECT c.*,(SELECT i.matched_signals_json FROM crm_intelligence i WHERE i.company_id=c.id AND i.workspace_id=c.workspace_id) AS matched_signals_json,(SELECT COUNT(*) FROM crm_contacts ct WHERE ct.company_id=c.id AND ct.workspace_id=c.workspace_id AND ct.archived_at IS NULL) AS contact_count,(SELECT MAX(a.occurred_at) FROM crm_activities a WHERE a.company_id=c.id AND a.workspace_id=c.workspace_id) AS last_activity_at FROM crm_companies c WHERE ${clauses.join(' AND ')} ORDER BY c.updated_at DESC,c.company_name ASC LIMIT ? OFFSET ?`;args.push(limit+1,offset);const {results=[]}=await db.prepare(sql).bind(...args).all();const hasMore=results.length>limit;return {companies:results.slice(0,limit),next_cursor:hasMore?String(offset+limit):null};}

export async function upsertCrmCompany(db,context,input={}){
  const workspaceId=clean(context?.workspaceId,160);
  if(!workspaceId)throw crmError('CRM_WORKSPACE_REQUIRED','Workspace is required');
  const companyInput=input.company&&typeof input.company==='object'?input.company:input;
  const domain=normalizeDomain(companyInput.domain||companyInput.website);
  let name=clean(companyInput.company_name||companyInput.company||companyInput.name,180);
  if(!name&&domain)name=domain;
  if(!name)throw crmError('CRM_COMPANY_NAME_REQUIRED','Company name is required');
  const requestedStage=companyInput.pipeline_stage!==undefined||companyInput.pipelineStage!==undefined?normalizePipelineStage(companyInput.pipeline_stage??companyInput.pipelineStage):null;
  const requestedLifecycle=companyInput.lifecycle_status?validateLifecycle(companyInput.lifecycle_status):'prospect';
  const website=safeUrl(companyInput.website)||(domain?`https://${domain}/`:null);
  const score=Number.isFinite(Number(companyInput.opportunity_score??companyInput.score?.total))?Math.max(0,Math.min(100,Math.round(Number(companyInput.opportunity_score??companyInput.score?.total)))):null;
  const confidence=clean(companyInput.confidence,40)||null;
  const source=clean(companyInput.source,80)||'manual';
  const stamp=now();
  let existing=domain?await companyByDomain(db,workspaceId,domain):null;
  let created=false;
  let id;

  const updateExisting=async(record)=>{
    const lifecycle=record.lifecycle_status;
    if(requestedStage&&lifecycle==='suppressed')throw crmError('CRM_COMPANY_SUPPRESSED','Suppressed companies must be restored before adding them to pipeline',409);
    if(requestedStage&&lifecycle==='archived')throw crmError('CRM_COMPANY_ARCHIVED','Archived companies must be restored before adding them to pipeline',409);
    const stage=['archived','suppressed'].includes(lifecycle)?null:(requestedStage?nextPipelineStage(record.pipeline_stage,requestedStage):record.pipeline_stage);
    const update=db.prepare(`UPDATE crm_companies SET company_name=?,website=?,country=?,industry=?,pipeline_stage=?,opportunity_score=?,confidence=?,source=?,last_seen_at=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(name,website||record.website,clean(companyInput.country,120)||record.country,clean(companyInput.industry,180)||record.industry,stage,score??record.opportunity_score,confidence||record.confidence,source||record.source,stamp,stamp,record.id,workspaceId);
    await writeWithActivity(db,context,{companyId:record.id,type:'company.saved',summary:'Company record updated',metadata:{created:false,source,domain}},[update]);
    return record.id;
  };

  if(existing){
    id=await updateExisting(existing);
  }else{
    if(requestedStage&&requestedLifecycle==='suppressed')throw crmError('CRM_COMPANY_SUPPRESSED','Suppressed companies must be restored before adding them to pipeline',409);
    if(requestedStage&&requestedLifecycle==='archived')throw crmError('CRM_COMPANY_ARCHIVED','Archived companies must be restored before adding them to pipeline',409);
    id=uuid();
    const insert=db.prepare(`INSERT OR IGNORE INTO crm_companies(id,workspace_id,normalized_domain,company_name,website,country,industry,lifecycle_status,pipeline_stage,opportunity_score,confidence,source,first_seen_at,last_seen_at,created_at,updated_at,archived_at,suppressed_at,customer_since,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL)`).bind(id,workspaceId,domain||null,name,website||null,clean(companyInput.country,120)||null,clean(companyInput.industry,180)||null,requestedLifecycle,requestedStage,score,confidence,source,stamp,stamp,stamp,stamp);
    const activity=guardedActivityStatement(db,context,{companyId:id,type:'company.saved',summary:'Company saved to CRM',metadata:{created:true,source,domain}},`EXISTS (SELECT 1 FROM crm_companies WHERE id=? AND workspace_id=?)`,[id,workspaceId]);
    await db.batch([insert,activity]);
    const inserted=await db.prepare(`SELECT id FROM crm_companies WHERE id=? AND workspace_id=? AND deleted_at IS NULL`).bind(id,workspaceId).first();
    if(inserted){
      created=true;
    }else{
      existing=domain?await companyByDomain(db,workspaceId,domain):null;
      if(!existing)throw crmError('CRM_COMPANY_SAVE_CONFLICT','Company changed while it was being saved',409);
      id=await updateExisting(existing);
    }
  }

  if(input.intelligence&&typeof input.intelligence==='object')await upsertCrmIntelligence(db,context,id,input.intelligence);
  if(Array.isArray(input.contacts)&&input.contacts.length)await upsertCrmContacts(db,context,id,input.contacts);
  return {created,company:(await getCrmCompany(db,context,id)).company};
}

async function transition(db,context,companyId,{lifecycle,pipelineStage,archivedAt,suppressedAt,customerSince,type,summary}){const workspaceId=clean(context?.workspaceId,160);const company=await companyRow(db,workspaceId,companyId);if(!company)throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);if(company.lifecycle_status==='suppressed'&&lifecycle&&lifecycle!=='suppressed'){if(type!=='company.restored')throw crmError('CRM_COMPANY_SUPPRESSED','Restore the suppressed company explicitly before changing its lifecycle',409);if(!canRestoreSuppressed(context?.role))throw crmError('CRM_OWNER_REQUIRED','Only the workspace owner can restore a suppressed company',403);}const stamp=now();const update=db.prepare(`UPDATE crm_companies SET lifecycle_status=?,pipeline_stage=?,archived_at=?,suppressed_at=?,customer_since=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(lifecycle??company.lifecycle_status,pipelineStage===undefined?company.pipeline_stage:pipelineStage,archivedAt===undefined?company.archived_at:archivedAt,suppressedAt===undefined?company.suppressed_at:suppressedAt,customerSince===undefined?company.customer_since:customerSince,stamp,companyId,workspaceId);if(type)await writeWithActivity(db,context,{companyId,type,summary,metadata:{from_lifecycle:company.lifecycle_status,from_pipeline:company.pipeline_stage}},[update]);else await db.batch([update]);return (await getCrmCompany(db,context,companyId)).company;}

export async function setCrmPipelineStage(db,context,companyId,stage){const workspaceId=clean(context?.workspaceId,160);const company=await companyRow(db,workspaceId,companyId);if(!company)throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);if(company.lifecycle_status==='suppressed')throw crmError('CRM_COMPANY_SUPPRESSED','Suppressed companies must be restored before adding them to pipeline',409);if(company.lifecycle_status==='archived')throw crmError('CRM_COMPANY_ARCHIVED','Archived companies must be restored before adding them to pipeline',409);const normalized=nextPipelineStage(company.pipeline_stage,stage);if(normalized===company.pipeline_stage)return company;return transition(db,context,companyId,{pipelineStage:normalized,type:company.pipeline_stage?'pipeline.stage_changed':'pipeline.added',summary:`Pipeline stage: ${normalized}`});}
export async function removeCrmFromPipeline(db,context,companyId){return transition(db,context,companyId,{pipelineStage:null,type:'pipeline.removed',summary:'Removed from active pipeline; CRM history preserved'});}
export async function archiveCrmCompany(db,context,companyId){return transition(db,context,companyId,{lifecycle:'archived',pipelineStage:null,archivedAt:now(),suppressedAt:null,type:'company.archived',summary:'Company archived'});}
export async function restoreCrmCompany(db,context,companyId){const workspaceId=clean(context?.workspaceId,160);const company=await companyRow(db,workspaceId,companyId);if(!company)throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);if(company.lifecycle_status==='suppressed'&&!canRestoreSuppressed(context?.role))throw crmError('CRM_OWNER_REQUIRED','Only the workspace owner can restore a suppressed company',403);return transition(db,context,companyId,{lifecycle:'prospect',pipelineStage:null,archivedAt:null,suppressedAt:null,type:'company.restored',summary:'Company restored'});}
export async function suppressCrmCompany(db,context,companyId){return transition(db,context,companyId,{lifecycle:'suppressed',pipelineStage:null,archivedAt:null,suppressedAt:now(),type:'company.suppressed',summary:'Company suppressed from rediscovery and outreach'});}
export async function markCrmCustomer(db,context,companyId){return transition(db,context,companyId,{lifecycle:'customer',customerSince:now(),type:'company.customer_marked',summary:'Company marked as customer'});}
export async function updateCrmCompany(db,context,companyId,patch={}){const workspaceId=clean(context?.workspaceId,160);const existing=await companyRow(db,workspaceId,companyId);if(!existing)throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);const name=clean(patch.company_name||patch.company||existing.company_name,180)||existing.company_name;const website=patch.website===undefined?existing.website:(safeUrl(patch.website)||null);const update=db.prepare(`UPDATE crm_companies SET company_name=?,website=?,country=?,industry=?,opportunity_score=?,confidence=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(name,website,patch.country===undefined?existing.country:clean(patch.country,120)||null,patch.industry===undefined?existing.industry:clean(patch.industry,180)||null,patch.opportunity_score===undefined?existing.opportunity_score:Math.max(0,Math.min(100,Math.round(Number(patch.opportunity_score)||0))),patch.confidence===undefined?existing.confidence:clean(patch.confidence,40)||null,now(),companyId,workspaceId);await writeWithActivity(db,context,{companyId,type:'company.updated',summary:'Company details updated'},[update]);return (await getCrmCompany(db,context,companyId)).company;}
export async function patchCrmContact(db,context,contactId,patch={}){const workspaceId=clean(context?.workspaceId,160);const existing=await db.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND archived_at IS NULL`).bind(contactId,workspaceId).first();if(!existing)throw crmError('CRM_CONTACT_NOT_FOUND','CRM contact not found',404);const email=patch.work_email===undefined?existing.normalized_email:normalizeEmail(patch.work_email);if(patch.work_email!==undefined&&patch.work_email&&!email)throw crmError('CRM_CONTACT_EMAIL_INVALID','Invalid work email');if(email&&email!==existing.normalized_email){const conflict=await db.prepare(`SELECT id FROM crm_contacts WHERE workspace_id=? AND normalized_email=? AND id<>?`).bind(workspaceId,email,contactId).first();if(conflict)throw crmError('CRM_CONTACT_CONFLICT','This contact email already exists',409);}const update=db.prepare(`UPDATE crm_contacts SET name=?,title=?,work_email=?,normalized_email=?,email_status=?,linkedin_url=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(patch.name===undefined?existing.name:clean(patch.name,180)||null,patch.title===undefined?existing.title:clean(patch.title,180)||null,patch.work_email===undefined?existing.work_email:(email?clean(patch.work_email,320):null),email||null,patch.email_status===undefined?existing.email_status:clean(patch.email_status,64)||null,patch.linkedin_url===undefined?existing.linkedin_url:clean(patch.linkedin_url,1000)||null,now(),contactId,workspaceId);try{await writeWithActivity(db,context,{companyId:existing.company_id,contactId,type:'contact.updated',summary:'Contact updated'},[update]);}catch(error){if(isContactUniqueConstraint(error))throw crmError('CRM_CONTACT_CONFLICT','This contact email already exists',409);throw error;}return db.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=?`).bind(contactId,workspaceId).first();}
export async function archiveCrmContact(db,context,contactId){const workspaceId=clean(context?.workspaceId,160);const existing=await db.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND archived_at IS NULL`).bind(contactId,workspaceId).first();if(!existing)throw crmError('CRM_CONTACT_NOT_FOUND','CRM contact not found',404);const stamp=now();const update=db.prepare(`UPDATE crm_contacts SET archived_at=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(stamp,stamp,contactId,workspaceId);await writeWithActivity(db,context,{companyId:existing.company_id,contactId,type:'contact.archived',summary:'Contact archived'},[update]);return {ok:true};}
export async function deleteCrmCompany(db,context,companyId){const workspaceId=clean(context?.workspaceId,160);const company=await companyRow(db,workspaceId,companyId);if(!company)throw crmError('CRM_COMPANY_NOT_FOUND','CRM company not found',404);await db.prepare(`DELETE FROM crm_companies WHERE id=? AND workspace_id=?`).bind(companyId,workspaceId).run();return {ok:true,id:companyId};}
