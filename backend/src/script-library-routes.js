import {storageErrorResponse} from './workspace-storage.js';
import {cookieValue,sha256} from './security.js';
import {coreScriptSeeds} from './core-script-seeds.js';
const channels=['email','linkedin','phone'],styles=['professional','curiosity','friendly','brutal'];
const json=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function platformScriptOwner(env,user){return Boolean(env.ADMIN_EMAIL&&user?.email&&String(env.ADMIN_EMAIL).trim().toLowerCase()===String(user.email).trim().toLowerCase());}
export function validateScript(input,{core=false}={}){
 if(!input||!channels.includes(input.channel))fail('Choose a supported channel');
 if(core&&!styles.includes(input.style))fail('Choose one of the four core styles');
 const out={};for(const [key,max] of [['name',80],['subject',500],['body',12000]]){if(typeof input[key]!=='string'||input[key].length>max)fail('Invalid '+key);out[key]=input[key].trim();}
 if(!out.name||!out.body||input.channel==='email'&&!out.subject)fail('Name and script are required; email also requires a subject');
 if(input.channel!=='email'&&out.subject)fail('Only email scripts have a subject');
 return {...out,channel:input.channel,style:styles.includes(input.style)?input.style:'original'};
}
export async function coreScripts(db){const result=await db.prepare('SELECT id,payload_json,revision FROM core_script_registry').all(),rows=new Map(coreScriptSeeds.map(r=>[r.id,r]));for(const row of result.results||[])rows.set(row.id,{...JSON.parse(row.payload_json),id:row.id,revision:row.revision,builtin:false});return [...rows.values()];}
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
 if(path==='/api/script-library'&&request.method==='GET'){
  const personal=await env.DB.prepare('SELECT id,payload_json,revision FROM personal_script_library WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).all();
  const preferences=await env.DB.prepare('SELECT channel,template_id,revision FROM primary_script_preferences WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).all();
  return json({canManage,core:await coreScripts(env.DB),personal:(personal.results||[]).map(r=>({...JSON.parse(r.payload_json),id:r.id,revision:r.revision})),primary:preferences.results||[]},200,cors);
 }
 if(Number(request.headers.get('Content-Length'))>40000)fail('Script payload too large',413);
 const body=write?await request.json().catch(()=>null):null;
 if(write&&(!body||JSON.stringify(body).length>40000))fail('Invalid script payload');
 const match=path.match(/^\/api\/script-library\/(core|personal|primary|draft)(?:\/([^/]+))?$/);if(!match)fail('Not found',404);const [,kind,encoded]=match,id=decodeURIComponent(encoded||'');
 if(kind==='core'){
  if(!canManage)fail('Only the platform owner can manage core scripts',403);
  if(!['PUT','DELETE'].includes(request.method))fail('Method not allowed',405);
  if(!/^(email|linkedin|phone):(professional|curiosity|friendly|brutal)$/.test(id))fail('Invalid core script');
  const existing=(await coreScripts(env.DB)).find(r=>r.id===id);
  let next;if(request.method==='DELETE'){if(!existing||existing.deleted)fail('Script not found',404);next={...existing,deleted:true};}else{next={...validateScript(body,{core:true}),deleted:false};if(id!==next.channel+':'+next.style)fail('Script channel or style mismatch');}
  // Revisions preserve prior approved wording; AI paths have no access to these writes.
  const previous=await env.DB.prepare('SELECT payload_json FROM core_script_registry WHERE id=?').bind(id).first();
  next.history=[...(previous?JSON.parse(previous.payload_json).history||[]:[]),...(existing?[{body:existing.body,subject:existing.subject,name:existing.name,revision:existing.revision}]:[])].slice(-30);
  const saved=await cas(env.DB,'core_script_registry',['id'],[id],next,body.expectedRevision,{updated_by:user.id});return json({script:{...saved,id,builtin:false}},200,cors);
 }
 if(kind==='personal'){
  if(!['PUT','DELETE'].includes(request.method)||!/^personal-[a-f0-9-]{36}$/.test(id))fail('Invalid personal script request');
  if(body.expectedRevision===0){const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM personal_script_library WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).first();if(count.n>=60)fail('Your library holds up to 60 personal templates. Edit an existing template.',409);}
  let next;if(request.method==='DELETE'){const old=await env.DB.prepare('SELECT payload_json FROM personal_script_library WHERE workspace_id=? AND user_id=? AND id=?').bind(workspace,user.id,id).first();if(!old)fail('Script not found',404);next={...JSON.parse(old.payload_json),deleted:true};}else next={...validateScript(body),deleted:false};
  const saved=await cas(env.DB,'personal_script_library',['workspace_id','user_id','id'],[workspace,user.id,id],next,body.expectedRevision,{channel:next.channel});return json({script:{...saved,id}},200,cors);
 }
 if(kind==='primary'&&request.method==='PUT'){
  if(!channels.includes(id)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)fail('Invalid primary preference');
  if(body.templateId){const row=await env.DB.prepare('SELECT channel,payload_json FROM personal_script_library WHERE workspace_id=? AND user_id=? AND id=?').bind(workspace,user.id,body.templateId).first();if(!row||row.channel!==id||JSON.parse(row.payload_json).deleted)fail('Choose an available personal script in this channel');}
  let result;if(body.expectedRevision===0)result=await env.DB.prepare('INSERT OR IGNORE INTO primary_script_preferences(workspace_id,user_id,channel,template_id,revision) VALUES(?,?,?,?,1)').bind(workspace,user.id,id,body.templateId||null).run();else result=await env.DB.prepare('UPDATE primary_script_preferences SET template_id=?,revision=revision+1 WHERE workspace_id=? AND user_id=? AND channel=? AND revision=?').bind(body.templateId||null,workspace,user.id,id,body.expectedRevision).run();
  if(!result.meta?.changes)fail('Primary changed elsewhere. Refresh before choosing again.',409);return json({ok:true},200,cors);
 }
 if(kind==='draft'){
  const companyId=write?body.companyId:url.searchParams.get('companyId'),contactId=write?body.contactId:url.searchParams.get('contactId');
  const contact=await env.DB.prepare('SELECT c.id FROM crm_contacts c JOIN crm_companies co ON co.id=c.company_id AND co.workspace_id=c.workspace_id WHERE c.workspace_id=? AND c.company_id=? AND c.id=? AND c.archived_at IS NULL AND co.deleted_at IS NULL').bind(workspace,companyId||'',contactId||'').first();if(!contact)fail('Select a saved CRM company and contact before using phone scripts',409);
  const keys=['workspace_id','user_id','company_id','contact_id'],values=[workspace,user.id,companyId,contactId];
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT payload_json,revision FROM phone_script_drafts WHERE workspace_id=? AND user_id=? AND company_id=? AND contact_id=?').bind(...values).first();return json({draft:row?{...JSON.parse(row.payload_json),revision:row.revision}:null},200,cors);}
  if(request.method!=='PUT')fail('Method not allowed',405);
  const script=validateScript({channel:'phone',subject:'',name:'Phone script',body:body.message,style:body.style});
  if(/\{\{|\}\}/.test(script.body))fail('Complete missing script fields before saving');
  const saved=await cas(env.DB,'phone_script_drafts',keys,values,{message:script.body,style:script.style,savedAt:new Date().toISOString(),sourceId:String(body.sourceId||'').slice(0,120)},body.expectedRevision);return json({draft:saved},200,cors);
 }
 fail('Method not allowed',405);
 }catch(error){const storage=storageErrorResponse(error,cors);if(storage)return storage;if(!error.status)throw error;return json({error:error.message},error.status,cors);}
}
