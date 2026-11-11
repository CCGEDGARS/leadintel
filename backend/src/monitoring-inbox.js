import {readMonitor,monitorScope,categoryAuthority,categoryAssertion} from './monitoring-store.js';
import '../../customer/strategy-integrity.js';
import Model from '../../customer/monitoring-model.js';
import Library from '../../customer/personal-template-library.js';
import {automaticGmailDeliveryEnabled} from './outreach-automation.js';
import {sha256} from './security.js';
import {readOwnedPayload} from './workspace-record-store.js';
import {contactRequestGuard} from './contact-operation-authority.js';
import {messageBatch,messageRowAssertion} from './message-operation-authority.js';

export const parseMonitoring=(value,fallback={})=>{try{return JSON.parse(value||'')??fallback;}catch{return fallback;}};
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const json=(data,status,cors)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...cors}});
const changed=r=>Number(r?.meta?.changes||0)>0;
const rowAssertion=(env,table,row,where='workspace_id=? AND id=?',args=[row.workspace_id,row.id])=>messageRowAssertion(env.DB,table,where,args,row);
const assertSql=(env,guard)=>env.DB.prepare(`SELECT CASE WHEN (${guard.sql}) THEN 1 ELSE json('MESSAGE_CONTEXT_CHANGED') END`).bind(...guard.args);

// Immutable event versions and current subjects commit as one unit under the run's
// lease/config/source authority. A semantic amendment revokes pending messages.
export async function recordFinding(env,{workspaceId,configRevision,monitorId='legacy',sourceId=null,sourceRevision=null},event,assessment,guard){
 const eventKey=await sha256(monitorId==='legacy'?event.eventKey:monitorId+'|'+event.eventKey),fingerprint=await sha256(event.versionMaterial),previous=await env.DB.prepare('SELECT * FROM monitoring_findings WHERE workspace_id=? AND event_key=?').bind(workspaceId,eventKey).first();
 if(previous?.fingerprint===fingerprint){await env.DB.batch([assertSql(env,guard),messageRowAssertion(env.DB,'monitoring_findings','workspace_id=? AND id=?',[workspaceId,previous.id],previous),env.DB.prepare('UPDATE monitoring_findings SET config_revision=?,assessment_json=? WHERE workspace_id=? AND id=?').bind(configRevision,JSON.stringify(assessment),workspaceId,previous.id)]);return {id:previous.id,changed:false};}
 const id=previous?.id||'MF-'+crypto.randomUUID(),revision=(previous?.revision||0)+1,writes=[],eventJson=JSON.stringify({...event,versionMaterial:undefined}),assessmentJson=JSON.stringify(assessment),assertions=[assertSql(env,guard),messageRowAssertion(env.DB,'monitoring_findings','workspace_id=? AND event_key=?',[workspaceId,eventKey],previous)];
 if(sourceId)assertions.push(env.DB.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM intelligence_sources WHERE id=? AND workspace_id=? AND revision=? AND monitoring_enabled=1) THEN 1 ELSE json('MESSAGE_CONTEXT_CHANGED') END").bind(sourceId,workspaceId,sourceRevision));
 if(previous)writes.push(env.DB.prepare("UPDATE monitoring_findings SET title=?,source_url=?,event_json=?,assessment_json=?,fingerprint=?,revision=?,status='new',config_revision=?,source_id=?,source_revision=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=?").bind(event.title,event.sourceUrl,eventJson,assessmentJson,fingerprint,revision,configRevision,sourceId,sourceRevision,workspaceId,id));
 else writes.push(env.DB.prepare('INSERT INTO monitoring_findings(id,workspace_id,monitor_id,event_key,purpose,title,source_url,event_json,assessment_json,fingerprint,config_revision,source_id,source_revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,workspaceId,monitorId,eventKey,event.purpose,event.title,event.sourceUrl,eventJson,assessmentJson,fingerprint,configRevision,sourceId,sourceRevision));
 writes.push(env.DB.prepare('INSERT INTO monitoring_finding_versions(id,workspace_id,finding_id,revision,fingerprint,event_json,assessment_json) VALUES(?,?,?,?,?,?,?)').bind('MV-'+crypto.randomUUID(),workspaceId,id,revision,fingerprint,eventJson,assessmentJson));
 writes.push(env.DB.prepare("UPDATE monitoring_messages SET status='held',error_code='source_facts_changed',revision=revision+1 WHERE workspace_id=? AND finding_id=? AND status IN ('draft','approved')").bind(workspaceId,id));
 for(const subject of (event.subjects||[]).slice(0,10)){
  const key=await sha256(JSON.stringify([subject.kind,subject.name,subject.role]));
  writes.push(env.DB.prepare(`INSERT INTO monitoring_subjects(id,workspace_id,finding_id,subject_key,kind,name,role,website,source_quote,finding_revision) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,finding_id,subject_key) DO UPDATE SET finding_revision=excluded.finding_revision,website=COALESCE(NULLIF(excluded.website,''),monitoring_subjects.website),source_quote=excluded.source_quote,review_json='{}',revision=monitoring_subjects.revision+1`).bind('MS-'+crypto.randomUUID(),workspaceId,id,key,subject.kind,subject.name,subject.role,subject.website||'',subject.sourceQuote||'',revision));
 }
 await env.DB.batch([...assertions,...writes]);return {id,changed:true};
}
export async function monitoringWorkspace(env,workspaceId){const row=await env.DB.prepare('SELECT * FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();return readOwnedPayload(env,workspaceId,row);}
export function monitoringTemplate(payload,id){const template=Library.normalize(payload?.main?.messageStudio?.myTemplates)[id];return template&&!template.deleted?template:null;}
function renderMonitoringTemplate(template,owned,subject,event){return Model.renderMessage(template,{name:subject.name,buyerName:subject.name,firstName:subject.kind==='person'?subject.name.split(' ')[0]:'',company:owned.payload.main?.messageStudio?.essentials?.company||owned.payload.main?.profile?.companyName||'',buyerCompany:subject.kind==='organization'?subject.name:'',role:subject.role,buyerRole:subject.role,event:event.title,eventDate:event.eventDate||'',deadline:event.deadline||'',reference:event.reference||'',caseNumber:event.fields?.caseNumber||'',tenderId:event.fields?.tenderId||'',jobRole:event.fields?.jobRole||'',sourceUrl:event.sourceUrl,evidenceUrl:event.sourceUrl,sender:owned.payload.main?.messageStudio?.essentials?.sender||'',offer:owned.payload.main?.messageStudio?.essentials?.offer||''});}
export async function monitoringConnectionHash(connection){return sha256(JSON.stringify(connection?Object.fromEntries(['workspace_id','user_id','google_email','connected_at','encrypted_refresh_token','status'].map(k=>[k,connection[k]??null])):{}));}
export async function currentMonitoringAuthority(env,message){
 const {workspace_id:workspaceId}=message,[finding,subject,config,owned,connection,member]=await Promise.all([
  env.DB.prepare('SELECT * FROM monitoring_findings WHERE workspace_id=? AND id=?').bind(workspaceId,message.finding_id).first(),
  env.DB.prepare('SELECT * FROM monitoring_subjects WHERE workspace_id=? AND id=?').bind(workspaceId,message.subject_id).first(),
  readMonitor(env,workspaceId,message.monitor_id||'legacy'),monitoringWorkspace(env,workspaceId),
  env.DB.prepare("SELECT * FROM gmail_connections WHERE workspace_id=? AND status='connected'").bind(workspaceId).first(),
  env.DB.prepare("SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?").bind(workspaceId,message.approved_by||message.prepared_by).first()
 ]);
 const workflow=Model.normalizeWorkflow(parseMonitoring(config?.workflow_json)),category=await categoryAuthority(env,workspaceId,workflow),ms=monitorScope(config),event=parseMonitoring(finding?.event_json),review=parseMonitoring(subject?.review_json),assessment=Model.assessEvent(event,workflow),template=monitoringTemplate(owned.payload,message.template_id);
 if(!finding||!subject||config?.archived||(finding.monitor_id||'legacy')!==(message.monitor_id||'legacy')||finding.config_revision!==config?.revision||workflow.purpose!==finding.purpose||subject.finding_id!==finding.id||subject.finding_revision!==finding.revision||finding.revision!==message.finding_revision||subject.revision!==message.subject_revision||subject.email!==message.recipient||config?.revision!==message.config_revision||member?.role!=='owner'||!review.identityConfirmed||!review.contactPermitted||!Model.publicUrl(review.contactSourceUrl)||subject.kind==='unresolved'||subject.kind==='person'&&!review.publicationReviewed||event.sensitive||!assessment.relevant||finding.status==='dismissed')fail('Source, recipient or workspace changed. Review this finding and prepare a new message.');
 if(!template||await sha256(JSON.stringify(template))!==message.template_hash)fail('The saved format changed. Prepare a new message.');
 const rendered=renderMonitoringTemplate(template,owned,subject,event);if(rendered.missingFields.length||rendered.subject!==message.subject||rendered.body!==message.body)fail('The message facts or sender changed. Prepare and review a new message.');
 const approval=globalThis.LeadIntelStrategyIntegrity.status(owned.payload?.main||{});if(!approval.current||await sha256(approval.signature||'')!==config.strategy_signature)fail('The current Strategy needs approval before message preparation or delivery.');
 const source=finding.source_id?await env.DB.prepare('SELECT * FROM intelligence_sources WHERE workspace_id=? AND id=?').bind(workspaceId,finding.source_id).first():null;
 if(finding.source_id&&(!source?.monitoring_enabled||source.revision!==finding.source_revision))fail('Monitoring source settings changed. Run monitoring and review again.');
 const configOwner=Object.fromEntries(['workspace_id','revision','enabled','workflow_json','strategy_signature','custom_sources_json','created_by'].map(k=>[k,config[k]??null]));
 const sourceOwner=source?Object.fromEntries(['id','workspace_id','revision','monitoring_enabled','canonical_url','auth_mode'].map(k=>[k,source[k]??null])):null;
 const assertions=[rowAssertion(env,'monitoring_findings',finding),rowAssertion(env,'monitoring_subjects',subject),rowAssertion(env,ms.table,configOwner,ms.where,ms.args),...(category?[categoryAssertion(env,category)]:[]),rowAssertion(env,'customer_workspace_state',owned.row,'workspace_id=?',[workspaceId]),...(source?[rowAssertion(env,'intelligence_sources',sourceOwner)]:[]),messageRowAssertion(env.DB,'workspace_members','workspace_id=? AND user_id=?',[workspaceId,message.approved_by||message.prepared_by],{role:'owner'})];
 return {finding,subject,config,workflow,owned,connection,assertions};
}
async function body(request){const text=await request.text();if(text.length>20000)fail('Request is too large',413);try{return JSON.parse(text);}catch{fail('Valid JSON is required',400);}}
export async function handleMonitoringInbox(request,env,scope,cors={}){
 const url=new URL(request.url),path=url.pathname.replace('/api/market-monitoring','');
 if(!/^\/(?:inbox|subjects|messages)(?:\/|$)/.test(path))return null;
 try{
 const {workspaceId,userId,role}=scope;
 if(request.method!=='GET'&&!['owner','researcher'].includes(role))fail('Workspace role is not permitted',403);
 const context={...scope};context.guard=await contactRequestGuard(request,env,context);context.writeAuthority=context.guard.writeAuthority;await context.guard();
 if(path==='/inbox/summary'&&request.method==='GET'){const counts=await env.DB.prepare("SELECT count(*) total,COALESCE(SUM(status='new'),0) unread FROM monitoring_findings WHERE workspace_id=?").bind(workspaceId).first();return json(counts,200,cors);}
 if(path==='/inbox'&&request.method==='GET'){
  const offset=Math.max(0,Math.min(10000,Number(url.searchParams.get('offset'))||0)),purpose=url.searchParams.get('purpose'),status=url.searchParams.get('status'),filters=['workspace_id=?'],args=[workspaceId];if(Model.PURPOSES[purpose]){filters.push('purpose=?');args.push(purpose);}if(['new','reviewed','dismissed'].includes(status)){filters.push('status=?');args.push(status);}
  const monitorId=url.searchParams.get('monitor_id'),categoryId=url.searchParams.get('category_id');if(monitorId){filters.push('monitor_id=?');args.push(monitorId);}if(categoryId){filters.push("(monitor_id IN (SELECT id FROM monitoring_monitors WHERE workspace_id=? AND category_id=?) OR (monitor_id='legacy' AND EXISTS(SELECT 1 FROM market_monitoring_configs WHERE workspace_id=? AND json_extract(workflow_json,'$.categoryId')=?)))");args.push(workspaceId,categoryId,workspaceId,categoryId);}
  const {results:findings=[]}=await env.DB.prepare('SELECT * FROM monitoring_findings WHERE '+filters.join(' AND ')+' ORDER BY updated_at DESC,id LIMIT 30 OFFSET ?').bind(...args,offset).all();
  const counts=await env.DB.prepare("SELECT count(*) total,COALESCE(SUM(status='new'),0) unread FROM monitoring_findings WHERE workspace_id=?").bind(workspaceId).first();const owned=await monitoringWorkspace(env,workspaceId),templates=Object.values(Library.normalize(owned.payload?.main?.messageStudio?.myTemplates)).filter(t=>!t.deleted).map(t=>({id:t.id,name:t.name}));
  const savedConfig=await env.DB.prepare('SELECT workflow_json FROM market_monitoring_configs WHERE workspace_id=?').bind(workspaceId).first();
  const {results:monitors=[]}=await env.DB.prepare('SELECT id,name,category_id,archived FROM monitoring_monitors WHERE workspace_id=? ORDER BY name').bind(workspaceId).all();const {results:categories=[]}=await env.DB.prepare('SELECT id,name,archived FROM monitoring_categories WHERE workspace_id=? ORDER BY name').bind(workspaceId).all();
  return json({...counts,monitors:[{id:'legacy',name:'Existing monitor'},...monitors],categories,selectedTemplateId:Model.normalizeWorkflow(parseMonitoring(savedConfig?.workflow_json)).templateId,findings:findings.map(f=>({...f,event:{...parseMonitoring(f.event_json),bodyText:undefined},assessment:parseMonitoring(f.assessment_json),event_json:undefined,assessment_json:undefined})),templates,role,offset,automaticDeliveryAvailable:automaticGmailDeliveryEnabled(env)},200,cors);
 }
 const detail=path.match(/^\/inbox\/([^/]+)$/);
 if(detail){const finding=await env.DB.prepare('SELECT * FROM monitoring_findings WHERE workspace_id=? AND id=?').bind(workspaceId,detail[1]).first();if(!finding)fail('Finding not found',404);
  if(request.method==='GET'){const [subjects,versions,messages]=await Promise.all([env.DB.prepare('SELECT * FROM monitoring_subjects WHERE workspace_id=? AND finding_id=? AND finding_revision=? ORDER BY rowid').bind(workspaceId,finding.id,finding.revision).all(),env.DB.prepare('SELECT revision,event_json,created_at FROM monitoring_finding_versions WHERE workspace_id=? AND finding_id=? ORDER BY revision DESC LIMIT 20').bind(workspaceId,finding.id).all(),env.DB.prepare('SELECT * FROM monitoring_messages WHERE workspace_id=? AND finding_id=? ORDER BY created_at DESC LIMIT 20').bind(workspaceId,finding.id).all()]);const findingConfig=await readMonitor(env,workspaceId,finding.monitor_id||'legacy');return json({selectedTemplateId:Model.normalizeWorkflow(parseMonitoring(findingConfig?.workflow_json)).templateId,finding:{...finding,event:parseMonitoring(finding.event_json),assessment:parseMonitoring(finding.assessment_json)},subjects:subjects.results.map(s=>({...s,review:parseMonitoring(s.review_json)})),versions:versions.results,messages:messages.results},200,cors);}
  if(request.method==='PATCH'){const input=await body(request);if(input.revision!==finding.revision||!['new','reviewed','dismissed'].includes(input.status))fail('Finding changed; reopen it before reviewing.');await messageBatch(env,context,[env.DB.prepare('UPDATE monitoring_findings SET status=? WHERE workspace_id=? AND id=?').bind(input.status,workspaceId,finding.id),...(input.status==='dismissed'?[env.DB.prepare("UPDATE monitoring_messages SET status='held',error_code='finding_dismissed',revision=revision+1 WHERE workspace_id=? AND finding_id=? AND status IN ('draft','approved')").bind(workspaceId,finding.id)]:[])],[rowAssertion(env,'monitoring_findings',finding)]);return json({updated:true},200,cors);}
 }
 if(role!=='owner')fail('Only the workspace owner can review contacts or approve messages',403);
 const identityMatch=path.match(/^\/subjects\/([^/]+)\/identity$/);
 if(identityMatch&&request.method==='PATCH'){
  const input=await body(request),subject=await env.DB.prepare('SELECT * FROM monitoring_subjects WHERE workspace_id=? AND id=?').bind(workspaceId,identityMatch[1]).first();if(!subject)fail('Subject not found',404);
  const finding=await env.DB.prepare('SELECT * FROM monitoring_findings WHERE workspace_id=? AND id=?').bind(workspaceId,subject.finding_id).first(),event=parseMonitoring(finding.event_json),website=Model.publicUrl(input.website),identitySourceUrl=Model.publicUrl(input.identitySourceUrl);
  if(subject.kind!=='organization'||event.sensitive||event.access!=='read'||subject.finding_revision!==finding.revision||input.revision!==subject.revision||input.findingRevision!==finding.revision)fail('Reopen a current organization finding before reviewing its identity.');
  const name=String(input.name||subject.name).trim().slice(0,180),role=String(input.role||subject.role).trim().slice(0,100);if(!website||!identitySourceUrl||!name||input.identityConfirmed!==true)fail('Supply the official website and identity evidence, then confirm the organization.');
  const review={organizationIdentityReviewed:true,identitySourceUrl,reviewedBy:userId,reviewedAt:new Date().toISOString()};
  await messageBatch(env,context,[env.DB.prepare('UPDATE monitoring_subjects SET name=?,role=?,website=?,review_json=?,revision=revision+1 WHERE workspace_id=? AND id=?').bind(name,role,website,JSON.stringify(review),workspaceId,subject.id),env.DB.prepare("UPDATE monitoring_messages SET status='held',error_code='identity_review_changed',revision=revision+1 WHERE workspace_id=? AND subject_id=? AND status IN ('draft','approved')").bind(workspaceId,subject.id)],[rowAssertion(env,'monitoring_subjects',subject),rowAssertion(env,'monitoring_findings',finding)]);return json({updated:true,revision:subject.revision+1},200,cors);
 }
 const subjectMatch=path.match(/^\/subjects\/([^/]+)$/);
 if(subjectMatch&&request.method==='PATCH'){
  const input=await body(request),subject=await env.DB.prepare('SELECT * FROM monitoring_subjects WHERE workspace_id=? AND id=?').bind(workspaceId,subjectMatch[1]).first();if(!subject)fail('Subject not found',404);
  const finding=await env.DB.prepare('SELECT * FROM monitoring_findings WHERE workspace_id=? AND id=?').bind(workspaceId,subject.finding_id).first(),event=parseMonitoring(finding.event_json);
  if(input.revision!==subject.revision||input.findingRevision!==finding.revision||subject.finding_revision!==finding.revision)fail('Source facts changed. Reopen this finding.');
  if(subject.kind==='unresolved'||event.sensitive||event.subjects?.some(s=>s.anonymized)||event.access!=='read')fail('The source or identity needs further review; contact preparation is held.');
  const email=String(input.email||'').trim().toLowerCase(),source=Model.publicUrl(input.contactSourceUrl);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!source||input.identityConfirmed!==true||input.contactPermitted!==true||subject.kind==='person'&&input.publicationReviewed!==true)fail('Confirm the exact identity, published contact source and contact permission first.');
  const review={...parseMonitoring(subject.review_json),identityConfirmed:true,contactPermitted:true,publicationReviewed:input.publicationReviewed===true,contactSourceUrl:source,reviewedBy:userId,reviewedAt:new Date().toISOString()};
  await messageBatch(env,context,[env.DB.prepare('UPDATE monitoring_subjects SET email=?,review_json=?,revision=revision+1 WHERE workspace_id=? AND id=?').bind(email,JSON.stringify(review),workspaceId,subject.id),env.DB.prepare("UPDATE monitoring_messages SET status='held',error_code='recipient_review_changed',revision=revision+1 WHERE workspace_id=? AND subject_id=? AND status IN ('draft','approved')").bind(workspaceId,subject.id)],[rowAssertion(env,'monitoring_subjects',subject),rowAssertion(env,'monitoring_findings',finding)]);return json({updated:true,revision:subject.revision+1},200,cors);
 }
 const prepare=path.match(/^\/inbox\/([^/]+)\/messages$/);
 if(prepare&&request.method==='POST'){
  const input=await body(request),subject=await env.DB.prepare('SELECT * FROM monitoring_subjects WHERE workspace_id=? AND id=? AND finding_id=?').bind(workspaceId,input.subjectId||'',prepare[1]).first();if(!subject)fail('Subject not found',404);
  const finding=await env.DB.prepare('SELECT * FROM monitoring_findings WHERE workspace_id=? AND id=?').bind(workspaceId,prepare[1]).first(),config=await readMonitor(env,workspaceId,finding.monitor_id||'legacy'),owned=await monitoringWorkspace(env,workspaceId),workflow=Model.normalizeWorkflow(parseMonitoring(config?.workflow_json)),template=monitoringTemplate(owned.payload,input.templateId),event=parseMonitoring(finding.event_json);
  if(workflow.messageMode==='alerts')fail('Select draft or automatic message mode in monitoring settings first.');if(!template)fail('Choose a saved personal format in Messages.');
  if(input.findingRevision!==finding.revision||input.subjectRevision!==subject.revision)fail('Finding or recipient changed. Reload before preparing.');
  const rendered=renderMonitoringTemplate(template,owned,subject,event);
  if(rendered.missingFields.length)fail('This format needs factual values: '+rendered.missingFields.join(', '));
  const message={id:'MM-'+crypto.randomUUID(),workspace_id:workspaceId,monitor_id:finding.monitor_id||'legacy',finding_id:finding.id,subject_id:subject.id,finding_revision:finding.revision,subject_revision:subject.revision,config_revision:config.revision,template_id:template.id,template_hash:await sha256(JSON.stringify(template)),workspace_version:owned.row.version,recipient:subject.email,subject:rendered.subject,body:rendered.body,status:'draft',revision:1,prepared_by:userId};
  const authority=await currentMonitoringAuthority(env,message),columns=Object.keys(message);await messageBatch(env,context,[env.DB.prepare(`INSERT INTO monitoring_messages(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...columns.map(k=>message[k]))],authority.assertions);return json({message},200,cors);
 }
 const action=path.match(/^\/messages\/([^/]+)\/(approve|cancel)$/);
 if(action&&request.method==='POST'){
  const input=await body(request),message=await env.DB.prepare('SELECT * FROM monitoring_messages WHERE workspace_id=? AND id=?').bind(workspaceId,action[1]).first();if(!message)fail('Message not found',404);if(input.revision!==message.revision)fail('Message changed. Reload before continuing.');if(!['draft','approved','held'].includes(message.status))fail('This delivery already has a transport receipt.');
  if(action[2]==='cancel'){await messageBatch(env,context,[env.DB.prepare("UPDATE monitoring_messages SET status='canceled',revision=revision+1 WHERE workspace_id=? AND id=?").bind(workspaceId,message.id)],[rowAssertion(env,'monitoring_messages',message)]);return json({updated:true},200,cors);}
  if(!automaticGmailDeliveryEnabled(env))fail('Automatic delivery is not enabled for this deployment. Your formatted draft is saved.');if(message.status!=='draft')fail('Prepare a fresh draft before approval.');const authority=await currentMonitoringAuthority(env,message);if(authority.workflow.messageMode!=='automatic'||!authority.config.enabled||!authority.connection)fail('Enable reviewed automatic messages and connect Gmail before approving delivery.');
  await messageBatch(env,context,[env.DB.prepare("UPDATE monitoring_messages SET status='approved',approved_by=?,approved_at=?,connection_hash=?,revision=revision+1 WHERE workspace_id=? AND id=?").bind(userId,new Date().toISOString(),await monitoringConnectionHash(authority.connection),workspaceId,message.id)],[...authority.assertions,rowAssertion(env,'monitoring_messages',message),rowAssertion(env,'gmail_connections',authority.connection,'workspace_id=?',[workspaceId])]);return json({approved:true},200,cors);
 }
 fail('Monitoring inbox route not found',404);
 }catch(cause){return json({error:String(cause.message||'Monitoring inbox failed').slice(0,500)},cause.status||(/MESSAGE_|malformed JSON/.test(cause.message)?409:500),cors);}
}
