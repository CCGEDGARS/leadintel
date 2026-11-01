import {handleCreatorLibrary,creatorUnlocked} from './creator-library.js';
import {validSkillAttribution} from './workspace-skill-attribution.js';
import StorysellingNative from '../../customer/storyselling-native.js';
import {validCompanyMaterialAttribution} from './company-materials-context.js';
import RichText from '../../customer/rich-text.js';
import {storageErrorResponse} from './workspace-storage.js';
import {cookieValue,sha256} from './security.js';
import {inmailScriptSeeds} from './inmail-script-seeds.js';
import {coreScriptSeeds} from './core-script-seeds.js';
import {phoneScriptSeeds} from './phone-script-seeds.js';
const channels=['email','linkedin','phone'],styles=['professional','curiosity','friendly','brutal','storyselling'];
const json=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function appliedAssistant(value,workspace){
 if(value===null||value===undefined)return null;
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),bounded=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max,revision=v=>Number.isSafeInteger(v)&&v>0;
 if(!object(value)||JSON.stringify(value).length>8000||Object.keys(value).some(k=>!['workspaceId','referenceRevision','sourceRefs','skillRefs','citations','appliedAt','writingContext','sourceSelection','companyMaterialRefs'].includes(k))||value.workspaceId!==workspace||!Number.isSafeInteger(value.referenceRevision)||value.referenceRevision<0||!Array.isArray(value.sourceRefs)||value.sourceRefs.length>3||!Array.isArray(value.citations)||value.citations.length>8||!bounded(value.appliedAt,40)||!Number.isFinite(Date.parse(value.appliedAt)))fail('Invalid applied writing-source attribution');
 if(!validCompanyMaterialAttribution(value.companyMaterialRefs))fail('Invalid company reference attribution');
 if(value.writingContext!==undefined&&!['general','customer'].includes(value.writingContext)||value.sourceSelection!==undefined&&!['session','active'].includes(value.sourceSelection))fail('Invalid writing-source context');
 if(!validSkillAttribution(value.skillRefs))fail('Invalid historical skill references');
 const refs=value.sourceRefs;if(refs.some(r=>!object(r)||Object.keys(r).some(k=>!['id','revision'].includes(k))||!bounded(r.id,120)||!revision(r.revision))||new Set(refs.map(r=>r.id)).size!==refs.length)fail('Invalid applied writing-source references');
 for(const citation of value.citations)if(!object(citation)||Object.keys(citation).some(k=>!['passageId','sourceId','revision','filename','location','role'].includes(k))||!refs.some(r=>r.id===citation.sourceId&&r.revision===citation.revision)||!bounded(citation.filename,256)||!bounded(citation.location,80)||!/^(page|line):\d+$/.test(citation.location)||!['guidance','seller','customer'].includes(citation.role)||citation.passageId!==undefined&&!bounded(citation.passageId,200))fail('Invalid applied writing-source citation');
 // This is historical attribution for the saved text, never current evidence or activation authority.
 return value;
}
function validateInMailSequence(record,workspace,{historical=false}={}){
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(!object(record)||historical&&(Object.hasOwn(record,'previousSequences')||Object.hasOwn(record,'tailoredOriginal')))fail('Invalid InMail sequence history');
 const {previousSequences,tailoredOriginal,...current}=record;
 if(![...styles,'original'].includes(current.style)||!['initial','connection','followup','calendar'].includes(current.stage)||!object(current.stages)||!object(current.values)||!object(current.checks)||JSON.stringify(current).length>30000)fail('Invalid InMail draft');
 for(const [id,draft] of Object.entries(current.stages)){
  if(!['initial','connection','followup','calendar'].includes(id)||!object(draft)||typeof draft.subject!=='string'||typeof draft.message!=='string'||draft.message.length>12000||draft.subject.length>500||id!=='initial'&&draft.subject)fail('Invalid InMail stage');
  const assistant=appliedAssistant(draft.writingAssistant,workspace);if(assistant)draft.writingAssistant=assistant;else delete draft.writingAssistant;
 }
 for(const [key,value] of Object.entries(current.values))if(!/^[A-Za-z][A-Za-z0-9]*$/.test(key)||typeof value!=='string'||value.length>3000)fail('Invalid InMail fact');
 if(!historical){
  if(previousSequences!==undefined&&(!Array.isArray(previousSequences)||previousSequences.length>5))fail('Invalid InMail sequence history');
  if(previousSequences)current.previousSequences=previousSequences.map(snapshot=>validateInMailSequence(snapshot,workspace,{historical:true}));
  if(tailoredOriginal!==undefined)current.tailoredOriginal=validateInMailSequence(tailoredOriginal,workspace,{historical:true});
 }
 return current;
}
export function platformScriptOwner(env,user){return Boolean(env.ADMIN_EMAIL&&user?.email&&String(env.ADMIN_EMAIL).trim().toLowerCase()===String(user.email).trim().toLowerCase());}
export function validateScript(input,{core=false}={}){
 if(!input||!channels.includes(input.channel))fail('Choose a supported channel');
 if(core&&!styles.includes(input.style))fail('Choose a supported core style');
 const out={};for(const [key,max] of [['name',80],['subject',500],['body',12000]]){if(typeof input[key]!=='string'||input[key].length>max)fail('Invalid '+key);out[key]=input[key].trim();}
 if(!out.name||!out.body||input.channel==='email'&&!out.subject)fail('Name and script are required; email also requires a subject');
 if(!core&&input.channel==='email'&&input.bodyHtml!==undefined){if(typeof input.bodyHtml!=='string'||input.bodyHtml.length>RichText.MAX_HTML)fail('Invalid template formatting');const html=RichText.matchingHtml(out.body,input.bodyHtml);if(input.bodyHtml&&!html)fail('Formatting does not match the template');if(html)out.bodyHtml=html;}
 const inmail=input.channel==='linkedin'&&input.mode==='inmail';
 if(input.mode&&input.mode!=='inmail'&&input.mode!=='direct')fail('Invalid script mode');
 if(input.mode==='inmail'&&input.channel!=='linkedin')fail('InMail is a LinkedIn mode');
 if(input.channel!=='email'&&!inmail&&out.subject)fail('Only email scripts have a subject');
 if(inmail){
  const ids=['initial','connection','followup','calendar'];
  if(!Array.isArray(input.stages)||input.stages.length!==4||input.stages.some((s,i)=>s?.id!==ids[i]))fail('InMail requires four ordered stages');
  const stages=input.stages.map((stage,i)=>{if(typeof stage.body!=='string'||!stage.body.trim()||stage.body.length>12000||typeof stage.subject!=='string'||stage.subject.length>500||i===0&&!stage.subject.trim()||i>0&&stage.subject)fail('Invalid InMail stage body or subject');return {id:ids[i],title:String(stage.title||ids[i]).slice(0,80),condition:String(stage.condition||'').slice(0,200),subject:stage.subject,body:stage.body};});
  return {...out,channel:'linkedin',mode:'inmail',style:styles.includes(input.style)?input.style:'original',subject:stages[0].subject,body:stages[0].body,stages};
 }
 return {...out,channel:input.channel,style:styles.includes(input.style)?input.style:'original'};
}
export async function coreScripts(db){
 const result=await db.prepare('SELECT id,payload_json,revision FROM core_script_registry').all(),rows=new Map([...StorysellingNative.seeds,StorysellingNative.inmail,...coreScriptSeeds,...inmailScriptSeeds,...phoneScriptSeeds].map(r=>[r.id,r]));
 for(const row of result.results||[]){
  const saved=JSON.parse(row.payload_json),master=rows.get(row.id);
  // Upgrade obsolete built-in copies, never an owner's separately edited master
  // or a deletion tombstone. Retain every replaced original in revision history.
  const sameStages=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((stage,i)=>stage.id===b[i].id&&stage.body===b[i].body&&stage.subject===b[i].subject);
  const obsoleteInMail=master?.mode==='inmail'&&saved.masterVersion!==master.masterVersion&&master.previousBuiltinStages?.some(stages=>sameStages(saved.stages,stages)&&saved.body===stages[0].body&&saved.subject===stages[0].subject);
  // Missing version metadata is not proof of a builtin; owner subjects and
  // explicit owner-copy markers must survive even when the body is familiar.
  const obsoleteEmail=master?.channel==='email'&&saved.masterVersion!==master.masterVersion&&saved.builtin!==false&&saved.subject===master.subject&&master.previousBuiltinBodies?.includes(saved.body);
  const obsolete=obsoleteInMail||obsoleteEmail;
  if(obsolete&&!saved.deleted)rows.set(row.id,{...master,id:row.id,revision:row.revision,history:[...(saved.history||[]),{body:saved.body,subject:saved.subject,name:saved.name,revision:row.revision,...(saved.stages?{stages:saved.stages}:{})}].slice(-30)});
  else rows.set(row.id,{...saved,id:row.id,revision:row.revision,builtin:!saved.deleted&&saved.body===master?.body&&saved.subject===master?.subject});
 }
 return [...rows.values()];
}
async function cas(db,table,keys,values,payload,expected,extra={}){
 if(!Number.isSafeInteger(expected)||expected<0)fail('Expected revision is required');
 const names=Object.keys(extra),args=Object.values(extra),where=keys.map(k=>k+'=?').join(' AND ');let result;
 if(expected===0)result=await db.prepare(`INSERT OR IGNORE INTO ${table}(${[...keys,'payload_json','revision',...names].join(',')}) VALUES(${[...keys,'payload_json','revision',...names].map(()=>'?').join(',')})`).bind(...values,JSON.stringify(payload),1,...args).run();
 else result=await db.prepare(`UPDATE ${table} SET payload_json=?,revision=revision+1${names.map(k=>','+k+'=?').join('')} WHERE ${where} AND revision=?`).bind(JSON.stringify(payload),...args,...values,expected).run();
 if(!result.meta?.changes)fail('This record changed elsewhere. Refresh before saving; your edits are preserved.',409);
 return {...payload,revision:expected+1};
}
export async function handleScriptLibraryRoute(request,env,cors={}){
 const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/script-library'))return null;
 const token=cookieValue(request,'leadintel_session');if(!token)return json({error:'Authentication required'},401,cors);
 const user=await env.DB.prepare("SELECT users.id,users.email FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();if(!user)return json({error:'Authentication required'},401,cors);
 const workspace=url.searchParams.get('workspace_id')||'',member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).first();if(!member)return json({error:'Workspace access denied'},403,cors);
 try{
 const canManage=platformScriptOwner(env,user),write=request.method!=='GET';if(write&&!['owner','researcher','sales'].includes(member.role))fail('Write access required',403);
 if(path==='/api/script-library/creator'||path.startsWith('/api/script-library/creator/'))return await handleCreatorLibrary(request,env,cors,{user,session:token,canManage});
 if(path==='/api/script-library'&&request.method==='GET'){
  const personal=await env.DB.prepare('SELECT id,payload_json,revision FROM personal_script_library WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).all();
  const preferences=await env.DB.prepare('SELECT channel,template_id,revision FROM primary_script_preferences WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).all();
  return json({canManage,core:(await coreScripts(env.DB)).map(row=>row.creatorSource?((({original,history,...safe})=>safe)(row)):row),inmailPrimary:(await env.DB.prepare('SELECT template_id,revision FROM inmail_script_preferences WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).all()).results||[],personal:(personal.results||[]).map(r=>({...JSON.parse(r.payload_json),id:r.id,revision:r.revision})),primary:preferences.results||[]},200,cors);
 }
 const maximumPayload=path==='/api/script-library/draft'?500000:path==='/api/script-library/inmail-draft'?250000:40000;
 if(Number(request.headers.get('Content-Length'))>maximumPayload)fail('Script payload too large',413);
 const body=write?await request.json().catch(()=>null):null;
 if(write&&(!body||JSON.stringify(body).length>maximumPayload))fail('Invalid script payload');
 const match=path.match(/^\/api\/script-library\/(core|personal|primary|draft|inmail-draft|inmail-primary)(?:\/([^/]+))?$/);if(!match)fail('Not found',404);const [,kind,encoded]=match,id=decodeURIComponent(encoded||'');
 if(kind==='core'){
  if(!canManage)fail('Only the platform owner can manage core scripts',403);
  if(!await creatorUnlocked(request,env,token))fail('Unlock Creator Library before changing a master',423);
  if(!['PUT','DELETE'].includes(request.method))fail('Method not allowed',405);
  if(!/^(email|linkedin|phone|linkedin-inmail):(professional|curiosity|friendly|brutal|storyselling)$/.test(id))fail('Invalid core script');
  const existing=(await coreScripts(env.DB)).find(r=>r.id===id);
  let next;if(request.method==='DELETE'){if(!existing||existing.deleted)fail('Script not found',404);next={...existing,deleted:true};}else{next={...validateScript(body,{core:true}),deleted:false,builtin:false,...(existing?.masterVersion?{masterVersion:existing.masterVersion}:{})};if(id!==(next.mode==='inmail'?'linkedin-inmail':next.channel)+':'+next.style)fail('Script channel or style mismatch');}
  // Revisions preserve prior approved wording; AI paths have no access to these writes.
  if(existing?.mode==='inmail')next={...next,original:existing.original,sourceFile:existing.sourceFile,sourceSha256:existing.sourceSha256};
  // The resolved row includes any builtin migration's recoverable prior text.
  next.history=[...(existing?.history||[]),...(existing?[{body:existing.body,subject:existing.subject,name:existing.name,revision:existing.revision,...(existing.stages?{stages:existing.stages}:{} )}]:[])].slice(-30);
  const saved=await cas(env.DB,'core_script_registry',['id'],[id],next,body.expectedRevision,{updated_by:user.id});return json({script:{...saved,id,builtin:false}},200,cors);
 }
 if(kind==='personal'){
  if(!['PUT','DELETE'].includes(request.method)||!/^personal-[a-f0-9-]{36}$/.test(id))fail('Invalid personal script request');
  if(body.expectedRevision===0){const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM personal_script_library WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).first();if(count.n>=60)fail('Your library holds up to 60 personal templates. Edit an existing template.',409);}
  let next;if(request.method==='DELETE'){const old=await env.DB.prepare('SELECT payload_json FROM personal_script_library WHERE workspace_id=? AND user_id=? AND id=?').bind(workspace,user.id,id).first();if(!old)fail('Script not found',404);next={...JSON.parse(old.payload_json),deleted:true};}else next={...validateScript(body),deleted:false};
  const saved=await cas(env.DB,'personal_script_library',['workspace_id','user_id','id'],[workspace,user.id,id],next,body.expectedRevision,{channel:next.channel});return json({script:{...saved,id}},200,cors);
 }
 if(kind==='inmail-primary'&&request.method==='PUT'){
  if(body.templateId){const row=await env.DB.prepare('SELECT payload_json FROM personal_script_library WHERE workspace_id=? AND user_id=? AND id=?').bind(workspace,user.id,body.templateId).first();const t=row&&JSON.parse(row.payload_json);if(!t||t.deleted||t.mode!=='inmail')fail('Choose an InMail personal template');}
  const saved=await cas(env.DB,'inmail_script_preferences',['workspace_id','user_id'],[workspace,user.id],{templateId:body.templateId||null},body.expectedRevision,{template_id:body.templateId||null});return json({ok:true,revision:saved.revision},200,cors);
 }
 if(kind==='primary'&&request.method==='PUT'){
  if(!channels.includes(id)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)fail('Invalid primary preference');
  if(body.templateId){const row=await env.DB.prepare('SELECT channel,payload_json FROM personal_script_library WHERE workspace_id=? AND user_id=? AND id=?').bind(workspace,user.id,body.templateId).first();if(!row||row.channel!==id||JSON.parse(row.payload_json).deleted||JSON.parse(row.payload_json).mode==='inmail')fail('Choose an available personal script in this channel');}
  let result;if(body.expectedRevision===0)result=await env.DB.prepare('INSERT OR IGNORE INTO primary_script_preferences(workspace_id,user_id,channel,template_id,revision) VALUES(?,?,?,?,1)').bind(workspace,user.id,id,body.templateId||null).run();else result=await env.DB.prepare('UPDATE primary_script_preferences SET template_id=?,revision=revision+1 WHERE workspace_id=? AND user_id=? AND channel=? AND revision=?').bind(body.templateId||null,workspace,user.id,id,body.expectedRevision).run();
  if(!result.meta?.changes)fail('Primary changed elsewhere. Refresh before choosing again.',409);return json({ok:true},200,cors);
 }
 if(kind==='inmail-draft'){
  const companyId=write?body.companyId:url.searchParams.get('companyId'),contactId=write?body.contactId:url.searchParams.get('contactId');
  const contact=await env.DB.prepare('SELECT c.id FROM crm_contacts c JOIN crm_companies co ON co.id=c.company_id AND co.workspace_id=c.workspace_id WHERE c.workspace_id=? AND c.company_id=? AND c.id=? AND c.archived_at IS NULL AND co.deleted_at IS NULL').bind(workspace,companyId||'',contactId||'').first();if(!contact)fail('Select a saved CRM contact before preparing InMail',409);
  const keys=['workspace_id','user_id','company_id','contact_id'],values=[workspace,user.id,companyId,contactId];
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT payload_json,revision FROM inmail_script_drafts WHERE workspace_id=? AND user_id=? AND company_id=? AND contact_id=?').bind(...values).first();return json({draft:row?{...JSON.parse(row.payload_json),revision:row.revision}:null},200,cors);}
  if(request.method!=='PUT')fail('Method not allowed',405);
  const record=validateInMailSequence(body.record,workspace);
  const saved=await cas(env.DB,'inmail_script_drafts',keys,values,{record,savedAt:new Date().toISOString()},body.expectedRevision);return json({draft:saved},200,cors);
 }
 if(kind==='draft'){
  const companyId=write?body.companyId:url.searchParams.get('companyId'),contactId=write?body.contactId:url.searchParams.get('contactId');
  const contact=await env.DB.prepare('SELECT c.id FROM crm_contacts c JOIN crm_companies co ON co.id=c.company_id AND co.workspace_id=c.workspace_id WHERE c.workspace_id=? AND c.company_id=? AND c.id=? AND c.archived_at IS NULL AND co.deleted_at IS NULL').bind(workspace,companyId||'',contactId||'').first();if(!contact)fail('Select a saved CRM company and contact before using phone scripts',409);
  const keys=['workspace_id','user_id','company_id','contact_id'],values=[workspace,user.id,companyId,contactId];
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT payload_json,revision FROM phone_script_drafts WHERE workspace_id=? AND user_id=? AND company_id=? AND contact_id=?').bind(...values).first();return json({draft:row?{...JSON.parse(row.payload_json),revision:row.revision}:null},200,cors);}
  if(request.method!=='PUT')fail('Method not allowed',405);
  const script=validateScript({channel:'phone',subject:'',name:'Phone script',body:body.message,style:body.style});
  if(/\{\{|\}\}/.test(script.body))fail('Complete missing script fields before saving');
  const assistant=appliedAssistant(body.writingAssistant,workspace);
  const historical=value=>{if(!value||typeof value.message!=='string'||value.message.length>12000||!['original',...styles].includes(value.style))fail('Invalid phone script history');const attribution=appliedAssistant(value.writingAssistant,workspace);return {message:value.message,style:value.style,sourceId:String(value.sourceId||'').slice(0,120),...(attribution?{writingAssistant:attribution}:{})};};
  if(body.previousDrafts!==undefined&&(!Array.isArray(body.previousDrafts)||body.previousDrafts.length>20))fail('Invalid phone script history');
  const history={...(body.previousDrafts?{previousDrafts:body.previousDrafts.map(historical)}:{}),...(body.tailoredOriginal?{tailoredOriginal:historical(body.tailoredOriginal)}:{})};
  const saved=await cas(env.DB,'phone_script_drafts',keys,values,{...history,message:script.body,style:script.style,savedAt:new Date().toISOString(),sourceId:String(body.sourceId||'').slice(0,120),...(assistant?{writingAssistant:assistant}:{})},body.expectedRevision);return json({draft:saved},200,cors);
 }
 fail('Method not allowed',405);
 }catch(error){const storage=storageErrorResponse(error,cors);if(storage)return storage;if(!error.status)throw error;return json({error:error.message},error.status,cors);}
}
