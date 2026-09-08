import {cookieValue,sha256} from './security.js';
import {sanitizeClientScreenContext,redactProtectedData} from './copilot-security.js';
import {buildCopilotWorkspaceContext} from './copilot-context.js';
import {runDeterministicDiagnostics,persistDiagnosticSnapshot} from './copilot-diagnostics.js';
import {listCopilotMemories,saveCopilotMemory} from './copilot-memory.js';
import {createActionProposal,executeConfirmedAction} from './copilot-actions.js';
import {runCopilotTurn} from './copilot-service.js';
import {getCustomerState} from './customer-state.js';

const OPERATING_ROLES=new Set(['owner','researcher','sales']);
const uuid=()=>crypto.randomUUID();
const json=(value,status=200,headers={})=>new Response(JSON.stringify(redactProtectedData(value)),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,extra={})=>json({error:message,...extra},status,headers);
function clean(value,max=8000){return String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').trim().slice(0,max);}
async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();}
async function requireMember(request,env,workspaceId){if(!workspaceId)return {error:'workspace_id is required',status:400};const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};const member=await env.DB.prepare(`SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?`).bind(workspaceId,user.id).first();if(!member)return {error:'Workspace access denied',status:403};if(!OPERATING_ROLES.has(String(member.role||'').toLowerCase()))return {error:'Workspace role is not permitted',status:403};return {user,member};}
async function conversation(env,workspaceId,id){return env.DB.prepare(`SELECT id,workspace_id,title,created_at,updated_at FROM copilot_conversations WHERE id=? AND workspace_id=?`).bind(id,workspaceId).first();}
async function messages(env,workspaceId,id){const {results=[]}=await env.DB.prepare(`SELECT id,role,content,metadata_json,created_at FROM copilot_messages WHERE workspace_id=? AND conversation_id=? ORDER BY created_at ASC LIMIT 100`).bind(workspaceId,id).all();return results.map(row=>{let metadata={};try{metadata=JSON.parse(row.metadata_json||'{}');}catch{}return {id:row.id,role:row.role,content:clean(row.content,12000),metadata:redactProtectedData(metadata),created_at:row.created_at};});}
async function latestConversation(env,workspaceId){return env.DB.prepare(`SELECT id,title,created_at,updated_at FROM copilot_conversations WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 1`).bind(workspaceId).first();}
function idempotency(){return `copilot-${crypto.randomUUID()}`;}

export async function handleCopilotRoute(request,env,cors={}){
  const url=new URL(request.url);const path=url.pathname;if(!path.startsWith('/api/copilot/'))return null;const workspaceId=clean(url.searchParams.get('workspace_id'),180);const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);

  if(path==='/api/copilot/bootstrap'&&request.method==='GET'){
    const [latest,memories,ai,context]=await Promise.all([
      latestConversation(env,workspaceId),listCopilotMemories(env,workspaceId).catch(()=>[]),env.DB.prepare(`SELECT provider,model,active FROM workspace_ai_integrations WHERE workspace_id=? AND active=1 LIMIT 1`).bind(workspaceId).first(),buildCopilotWorkspaceContext(env,{workspaceId,currentScreen:{step:1,label:'Company & Market'},role:access.member.role})
    ]);
    const diagnostics=runDeterministicDiagnostics(context);await persistDiagnosticSnapshot(env,{workspaceId,diagnostics}).catch(()=>{});const unreadImportant=diagnostics.filter(item=>item.severity==='important').length;
    return json({available:true,role:access.member.role,latestConversation:latest||null,diagnostics,unreadImportant,memories,ai:{configured:Boolean(ai),provider:ai?.provider||'',model:ai?.model||''},suggestedPrompts:['What should I improve next?','Which signals should I monitor?','How can I improve my ICP?']},200,cors);
  }

  if(path==='/api/copilot/conversations'&&request.method==='GET'){
    const {results=[]}=await env.DB.prepare(`SELECT id,title,created_at,updated_at FROM copilot_conversations WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 50`).bind(workspaceId).all();return json({conversations:results},200,cors);
  }
  const conversationMatch=path.match(/^\/api\/copilot\/conversations\/([^/]+)$/);
  if(conversationMatch&&request.method==='GET'){
    const id=decodeURIComponent(conversationMatch[1]);const row=await conversation(env,workspaceId,id);if(!row)return error('Copilot conversation not found',404,cors);return json({conversation:row,messages:await messages(env,workspaceId,id)},200,cors);
  }

  if(path==='/api/copilot/diagnostics'&&request.method==='POST'){
    const body=await request.json().catch(()=>({}));if(body&&Object.keys(body).some(key=>!['screen'].includes(key)))return error('Only screen context is accepted',400,cors);const screen=sanitizeClientScreenContext(body?.screen||{});const context=await buildCopilotWorkspaceContext(env,{workspaceId,currentScreen:screen,role:access.member.role});const diagnostics=runDeterministicDiagnostics(context);await persistDiagnosticSnapshot(env,{workspaceId,diagnostics});return json({diagnostics,unreadImportant:diagnostics.filter(item=>item.severity==='important').length},200,cors);
  }

  if(path==='/api/copilot/chat'&&request.method==='POST'){
    const contentLength=Number(request.headers.get('Content-Length')||0);if(contentLength>30000)return error('Copilot request is too large',413,cors);const body=await request.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body))return error('Copilot chat payload is required',400,cors);const allowed=new Set(['conversation_id','message','screen']);if(Object.keys(body).some(key=>!allowed.has(key)))return error('Copilot chat contains unsupported fields',400,cors);const message=String(body.message||'').trim();if(!message)return error('Copilot message is required',400,cors);if(message.length>8000)return error('Copilot message is too long',413,cors);const screen=sanitizeClientScreenContext(body.screen||{});
    let conversationId=clean(body.conversation_id,180);let convo=null;if(conversationId){convo=await conversation(env,workspaceId,conversationId);if(!convo)return error('Copilot conversation not found',404,cors);}else{conversationId=uuid();await env.DB.prepare(`INSERT INTO copilot_conversations(id,workspace_id,created_by,title) VALUES(?,?,?,?)`).bind(conversationId,workspaceId,access.user.id,clean(message,120)).run();convo=await conversation(env,workspaceId,conversationId);}
    const prior=await messages(env,workspaceId,conversationId);await env.DB.prepare(`INSERT INTO copilot_messages(id,workspace_id,conversation_id,user_id,role,content,metadata_json) VALUES(?,?,?,?, 'user',?, '{}')`).bind(uuid(),workspaceId,conversationId,access.user.id,clean(message,8000)).run();
    const turn=await runCopilotTurn(env,{workspaceId,userId:access.user.id,role:access.member.role,conversation:prior,question:message,currentScreen:screen});await persistDiagnosticSnapshot(env,{workspaceId,diagnostics:turn.diagnostics||[]}).catch(()=>{});
    const state=await getCustomerState(env,workspaceId);const proposals=[];for(const candidate of (turn.action_proposals||[]).slice(0,5)){try{proposals.push(await createActionProposal(env,{workspaceId,userId:access.user.id,conversationId,expectedStateVersion:state.version,idempotencyKey:idempotency(),candidate,state:state.payload}));}catch{}}
    const savedMemories=[];for(const candidate of (turn.memory_candidates||[]).slice(0,5)){try{savedMemories.push(await saveCopilotMemory(env,{workspaceId,userId:access.user.id,conversationId,candidate}));}catch{}}
    const metadata={skill_ids:turn.skill_ids||[],sources:turn.sources||[],action_proposal_ids:proposals.map(item=>item.id),research_used:Boolean(turn.research_used),provider:turn.provider||{},usage:turn.usage||{}};await env.DB.prepare(`INSERT INTO copilot_messages(id,workspace_id,conversation_id,user_id,role,content,metadata_json) VALUES(?,?,?,?, 'assistant',?,?)`).bind(uuid(),workspaceId,conversationId,null,clean(turn.answer,12000),JSON.stringify(redactProtectedData(metadata))).run();await env.DB.prepare(`UPDATE copilot_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(conversationId,workspaceId).run();
    return json({...turn,action_proposals:proposals,memory_candidates:savedMemories,conversation_id:conversationId},200,cors);
  }

  const actionMatch=path.match(/^\/api\/copilot\/actions\/([^/]+)\/(confirm|reject)$/);
  if(actionMatch&&request.method==='POST'){
    const proposalId=decodeURIComponent(actionMatch[1]),operation=actionMatch[2];const row=await env.DB.prepare(`SELECT id,status FROM copilot_action_proposals WHERE id=? AND workspace_id=?`).bind(proposalId,workspaceId).first();if(!row)return error('Copilot action proposal not found',404,cors);
    if(operation==='reject'){await env.DB.prepare(`UPDATE copilot_action_proposals SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND status='proposed'`).bind(proposalId,workspaceId).run();return json({rejected:true,proposal_id:proposalId},200,cors);}
    const body=await request.json().catch(()=>({}));const key=clean(request.headers.get('Idempotency-Key')||body.idempotency_key,128);try{const result=await executeConfirmedAction(env,{workspaceId,userId:access.user.id,role:access.member.role,proposalId,idempotencyKey:key});if(result.conflict)return json({error:'Customer state version conflict',...result},409,cors);if(result.error)return json(result,400,cors);return json(result,200,cors);}catch(cause){return error(clean(cause?.message||'Unable to confirm Copilot action',240),400,cors);}
  }
  return error('Method not allowed',405,cors);
}
