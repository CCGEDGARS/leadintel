import {cookieValue,sha256} from './security.js';
import {sanitizeClientScreenContext,redactProtectedData} from './copilot-security.js';
import {buildCopilotWorkspaceContext} from './copilot-context.js';
import {runDeterministicDiagnostics,persistDiagnosticSnapshot} from './copilot-diagnostics.js';
import {listCopilotMemories,saveCopilotMemory,archiveCopilotMemory,dueReminders} from './copilot-memory.js';
import {runCopilotTurn} from './copilot-service.js';

const OPERATING_ROLES=new Set(['owner','researcher','sales']);
const uuid=()=>crypto.randomUUID();
const json=(value,status=200,headers={})=>new Response(JSON.stringify(redactProtectedData(value)),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,extra={})=>json({error:message,...extra},status,headers);
function clean(value,max=8000){return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g,' ').trim().slice(0,max);}
async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();}
async function requireMember(request,env,workspaceId){if(!workspaceId)return {error:'workspace_id is required',status:400};const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};const member=await env.DB.prepare(`SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?`).bind(workspaceId,user.id).first();if(!member)return {error:'Workspace access denied',status:403};if(!OPERATING_ROLES.has(String(member.role||'').toLowerCase()))return {error:'Workspace role is not permitted',status:403};return {user,member};}
async function conversation(env,workspaceId,id){return env.DB.prepare(`SELECT id,workspace_id,title,created_at,updated_at FROM copilot_conversations WHERE id=? AND workspace_id=?`).bind(id,workspaceId).first();}
async function messages(env,workspaceId,id){const {results=[]}=await env.DB.prepare(`SELECT id,role,content,metadata_json,created_at FROM copilot_messages WHERE workspace_id=? AND conversation_id=? ORDER BY created_at ASC LIMIT 100`).bind(workspaceId,id).all();return results.map(row=>{let metadata={};try{metadata=JSON.parse(row.metadata_json||'{}');}catch{}return {id:row.id,role:row.role,content:clean(row.content,12000),metadata:redactProtectedData(metadata),created_at:row.created_at};});}
// B4 (2026-10-25): the launcher badge needs a count, not a context — open important checks plus reminders due.
async function attentionCounts(env,workspaceId){
  const important=await env.DB.prepare(`SELECT COUNT(*) AS n FROM copilot_diagnostics WHERE workspace_id=? AND status='open' AND severity='important'`).bind(workspaceId).first().catch(()=>null);
  const due=await dueReminders(env,workspaceId).catch(()=>[]);
  return {important:Number(important?.n)||0,reminders_due:due.length,due};
}
async function workspaceUpdatedAt(env,workspaceId){const row=await env.DB.prepare(`SELECT updated_at FROM customer_workspace_state WHERE workspace_id=?`).bind(workspaceId).first().catch(()=>null);return clean(row?.updated_at,40);}
async function latestConversation(env,workspaceId){return env.DB.prepare(`SELECT id,title,created_at,updated_at FROM copilot_conversations WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 1`).bind(workspaceId).first();}

export async function handleCopilotRoute(request,env,cors={}){
  const url=new URL(request.url);const path=url.pathname;if(!path.startsWith('/api/copilot/'))return null;const workspaceId=clean(url.searchParams.get('workspace_id'),180);const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);

  if(path==='/api/copilot/attention'&&request.method==='GET'){
    const [counts,latest,updatedAt]=await Promise.all([attentionCounts(env,workspaceId),latestConversation(env,workspaceId),workspaceUpdatedAt(env,workspaceId)]);
    return json({important:counts.important,reminders_due:counts.reminders_due,total:counts.important+counts.reminders_due,last_conversation_at:clean(latest?.updated_at,40),workspace_updated_at:updatedAt},200,cors);
  }
  if(path==='/api/copilot/bootstrap'&&request.method==='GET'){
    const [latest,memories,remindersDue,updatedAt,ai,context]=await Promise.all([
      latestConversation(env,workspaceId),listCopilotMemories(env,workspaceId).catch(()=>[]),dueReminders(env,workspaceId).catch(()=>[]),workspaceUpdatedAt(env,workspaceId),env.DB.prepare(`SELECT provider,model,active FROM workspace_ai_integrations WHERE workspace_id=? AND active=1 LIMIT 1`).bind(workspaceId).first(),buildCopilotWorkspaceContext(env,{workspaceId,currentScreen:{step:1,label:'Company & Market'},role:access.member.role,user:{name:access.user.display_name}})
    ]);
    const diagnostics=runDeterministicDiagnostics(context);await persistDiagnosticSnapshot(env,{workspaceId,diagnostics}).catch(()=>{});const unreadImportant=diagnostics.filter(item=>item.severity==='important').length;
    return json({available:true,role:access.member.role,latestConversation:latest||null,diagnostics,unreadImportant,memories,reminders_due:remindersDue,since:{last_conversation_at:clean(latest?.updated_at,40),workspace_updated_at:updatedAt,important:unreadImportant},ai:{configured:Boolean(ai),provider:ai?.provider||'',model:ai?.model||''},readOnly:true,uploadsAllowed:false,suggestedPrompts:['Help me fix an error','Where can I top up credits?','Estimate my monthly costs']},200,cors);
  }

  // B3 (2026-10-25): what the assistant remembers is visible and forgettable; forgetting archives, it never deletes.
  if(path==='/api/copilot/memories'&&request.method==='GET'){
    const [memories,remindersDue]=await Promise.all([listCopilotMemories(env,workspaceId).catch(()=>[]),dueReminders(env,workspaceId).catch(()=>[])]);return json({memories,reminders_due:remindersDue},200,cors);
  }
  const memoryMatch=path.match(/^\/api\/copilot\/memories\/([^/]+)\/archive$/);
  if(memoryMatch&&request.method==='POST'){
    const memoryId=clean(decodeURIComponent(memoryMatch[1]),180);const result=await archiveCopilotMemory(env,{workspaceId,memoryId});if(!result.archived)return error('Memory not found',404,cors);return json({archived:true,id:memoryId},200,cors);
  }
  if(path==='/api/copilot/conversations'&&request.method==='GET'){
    const {results=[]}=await env.DB.prepare(`SELECT id,title,created_at,updated_at FROM copilot_conversations WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 50`).bind(workspaceId).all();return json({conversations:results,canDelete:String(access.member.role).toLowerCase()==='owner'},200,cors);
  }
  const conversationMatch=path.match(/^\/api\/copilot\/conversations\/([^/]+)$/);
  if(request.method==='DELETE'&&(path==='/api/copilot/conversations'||conversationMatch)){
    if(String(access.member.role).toLowerCase()!=='owner')return error('Only the workspace owner can delete chat history',403,cors);
    // One atomic statement: messages cascade; saved memories retain their values with source set to NULL.
    const id=conversationMatch?decodeURIComponent(conversationMatch[1]):'';
    const result=await (id?env.DB.prepare('DELETE FROM copilot_conversations WHERE workspace_id=? AND id=?').bind(workspaceId,id):env.DB.prepare('DELETE FROM copilot_conversations WHERE workspace_id=?').bind(workspaceId)).run();
    const deleted=Number(result.meta?.changes)||0;if(id&&!deleted)return error('Copilot conversation not found',404,cors);
    return json({deleted,memoriesPreserved:true},200,cors);
  }
  if(conversationMatch&&request.method==='GET'){
    const id=decodeURIComponent(conversationMatch[1]);const row=await conversation(env,workspaceId,id);if(!row)return error('Copilot conversation not found',404,cors);return json({conversation:row,messages:await messages(env,workspaceId,id)},200,cors);
  }

  if(path==='/api/copilot/diagnostics'&&request.method==='POST'){
    const body=await request.json().catch(()=>({}));if(body&&Object.keys(body).some(key=>!['screen'].includes(key)))return error('Only screen context is accepted',400,cors);const screen=sanitizeClientScreenContext(body?.screen||{});const context=await buildCopilotWorkspaceContext(env,{workspaceId,currentScreen:screen,role:access.member.role});const diagnostics=runDeterministicDiagnostics(context);await persistDiagnosticSnapshot(env,{workspaceId,diagnostics});return json({diagnostics,unreadImportant:diagnostics.filter(item=>item.severity==='important').length},200,cors);
  }

  if(path==='/api/copilot/chat'&&request.method==='POST'){
    const startedAt=Date.now();// Speed burst (2026-10-26): the route measures its own prelude and total next to the turn's timings.
    const contentLength=Number(request.headers.get('Content-Length')||0);if(contentLength>30000)return error('Copilot request is too large',413,cors);if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return error('Support accepts text-only JSON; file uploads are disabled',415,cors);const raw=await request.text();if(raw.length>30000)return error('Copilot request is too large',413,cors);let body;try{body=JSON.parse(raw);}catch{body=null;}if(!body||typeof body!=='object'||Array.isArray(body))return error('Copilot chat payload is required',400,cors);const allowed=new Set(['conversation_id','message','screen']);if(Object.keys(body).some(key=>!allowed.has(key)))return error('Copilot chat contains unsupported fields',400,cors);const message=String(body.message||'').trim();if(!message)return error('Copilot message is required',400,cors);if(message.length>8000)return error('Copilot message is too long',413,cors);const screen=sanitizeClientScreenContext(body.screen||{});
    // Speed burst step 3 (2026-10-26): the rate-limit count, the conversation lookup and its prior messages are independent reads; they run together.
    const requestedConversation=clean(body.conversation_id,180);
    const [recent,existing,priorMessages]=await Promise.all([env.DB.prepare(`SELECT COUNT(*) AS count FROM copilot_messages WHERE workspace_id=? AND user_id=? AND role='user' AND created_at>=datetime('now','-10 minutes')`).bind(workspaceId,access.user.id).first(),requestedConversation?conversation(env,workspaceId,requestedConversation):null,requestedConversation?messages(env,workspaceId,requestedConversation):[]]);
    if(Number(recent?.count)>=30)return error('Support request limit reached. Wait a few minutes; official billing links remain available.',429,cors,{code:'SUPPORT_RATE_LIMIT'});
    let conversationId=requestedConversation;let convo=existing;if(conversationId){if(!convo)return error('Copilot conversation not found',404,cors);}else{conversationId=uuid();await env.DB.prepare(`INSERT INTO copilot_conversations(id,workspace_id,created_by,title) VALUES(?,?,?,?)`).bind(conversationId,workspaceId,access.user.id,clean(redactProtectedData(message),120)).run();convo=await conversation(env,workspaceId,conversationId);}
    const prior=requestedConversation?priorMessages:[];await env.DB.prepare(`INSERT INTO copilot_messages(id,workspace_id,conversation_id,user_id,role,content,metadata_json) VALUES(?,?,?,?, 'user',?, '{}')`).bind(uuid(),workspaceId,conversationId,access.user.id,clean(redactProtectedData(message),8000)).run();
    const execute=async(onProgress=()=>{},onDelta=null)=>{
      const preludeMs=Date.now()-startedAt;
      const turn=await runCopilotTurn(env,{workspaceId,userId:access.user.id,role:access.member.role,user:{name:access.user.display_name},conversation:prior,question:message,currentScreen:screen,onProgress,onDelta});if(turn.diagnostics_evaluated===true)await persistDiagnosticSnapshot(env,{workspaceId,diagnostics:turn.diagnostics||[]}).catch(()=>{});
      const proposals=[],savedMemories=[];
      for(const candidate of Array.isArray(turn.memory_candidates)?turn.memory_candidates.slice(0,3):[]){try{const saved=await saveCopilotMemory(env,{workspaceId,userId:access.user.id,conversationId,candidate});if(saved?.id)savedMemories.push({id:saved.id,kind:saved.kind,value:saved.value,due:saved.due||''});}catch{}}
      const metadata={skills_used:turn.skills_used||[],skill_warnings:turn.skill_warnings||[],research_tools:turn.research_tools||[],skill_ids:turn.skill_ids||[],sources:turn.sources||[],action_proposal_ids:[],memory_ids:savedMemories.map(item=>item.id),memory_candidates_returned:Number(turn.memory_candidates_returned)||0,memory_candidates_kept:Array.isArray(turn.memory_candidates)?turn.memory_candidates.length:0,research_used:Boolean(turn.research_used),research_status:turn.research_status||'not_needed',research_passes:turn.research_passes||0,provider:turn.provider||{},usage:turn.usage||{},timings_ms:{...(turn.timings_ms||{}),route_prelude:preludeMs},model_calls:Number(turn.model_calls)||0,search_calls:Number(turn.search_calls)||0};await env.DB.prepare(`INSERT INTO copilot_messages(id,workspace_id,conversation_id,user_id,role,content,metadata_json) VALUES(?,?,?,?, 'assistant',?,?)`).bind(uuid(),workspaceId,conversationId,null,clean(turn.answer,12000),JSON.stringify(redactProtectedData(metadata))).run();await env.DB.prepare(`UPDATE copilot_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(conversationId,workspaceId).run();
      return {...turn,action_proposals:proposals,memory_candidates:savedMemories,conversation_id:conversationId,timings_ms:{...metadata.timings_ms,server_total:Date.now()-startedAt}};
    };
    if(request.headers.get('Accept')?.includes('text/event-stream')){
      let closed=false;const encoder=new TextEncoder();
      const stream=new ReadableStream({async start(controller){const emit=(type,data)=>{if(!closed)controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(redactProtectedData(data))}\n\n`));};try{const result=await execute(progress=>emit('progress',{phase:progress.phase}),delta=>emit(delta?.replace?'rewrite':'delta',{text:String(delta?.text||'')}));emit('result',result);}catch{emit('error',{error:'Ask LeadIntel could not complete this request. Please try again.'});}finally{if(!closed){closed=true;controller.close();}}},cancel(){closed=true;}});
      return new Response(stream,{headers:{...cors,'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    return json(await execute(),200,cors);
  }

  const actionMatch=path.match(/^\/api\/copilot\/actions\/([^/]+)\/(confirm|reject)$/);
  if(actionMatch&&request.method==='POST'){
    return error('Support is read-only; workspace actions are disabled',403,cors,{code:'SUPPORT_READ_ONLY'});
  }
  return error('Method not allowed',405,cors);
}
