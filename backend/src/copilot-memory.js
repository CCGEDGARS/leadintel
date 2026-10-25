import {sanitizeExternalResearchQuery} from './copilot-security.js';

// B3 (CTO, 2026-10-25): durable facts the person states and reminders with a due date join decisions, preferences and constraints.
const KINDS=new Set(['decision','preference','constraint','fact','reminder']);
function dueDate(value){const text=String(value??'').trim();const match=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);if(!match)return '';const date=new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);return Number.isNaN(date.getTime())?'':`${match[1]}-${match[2]}-${match[3]}`;}
const uuid=()=>crypto.randomUUID();
function clean(value,max=800){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);}
function fingerprint(value){let hash=2166136261;for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return `mem-${(hash>>>0).toString(16).padStart(8,'0')}`;}
function secretLike(value){const text=String(value||'');return /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{12,}\b/i.test(text)||/(?:api_?key|password|refresh_?token|access_?token|client_?secret|authorization)\s*[:=]/i.test(text)||/\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/i.test(text)||sanitizeExternalResearchQuery(text)!==clean(text,1000);}

export function normalizeMemoryCandidate(candidate){
  const source=candidate&&typeof candidate==='object'?candidate:{};const kind=clean(source.kind,40).toLowerCase();
  if(!KINDS.has(kind))throw new Error('Copilot memory kind is not allowed');
  const raw=String(source.value??'').trim();if(!raw)throw new Error('Copilot memory value is required');
  if(raw.length>700||/(^|\n)\s*(?:user|assistant|system)\s*:/i.test(raw))throw new Error('Copilot memory is too long or resembles a raw transcript');
  if(secretLike(raw))throw new Error('Copilot memory contains protected secret or credential-like content');
  const value=clean(raw,700);const canonical=`${kind}|${value.toLowerCase().replace(/[^a-z0-9\p{L}]+/gu,' ').trim()}`;
  return {kind,value,due:kind==='reminder'?dueDate(source.due):'',fingerprint:fingerprint(canonical)};
}

export async function listCopilotMemories(env,workspaceId){
  const {results=[]}=await env.DB.prepare(`SELECT id,kind,value_json,due_at,created_at,updated_at FROM copilot_memories WHERE workspace_id=? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 50`).bind(workspaceId).all();
  return results.map(row=>{let parsed={};try{parsed=JSON.parse(row.value_json||'{}');}catch{}return {id:row.id,kind:row.kind,value:clean(parsed.value,700),due:dueDate(row.due_at),created_at:row.created_at,updated_at:row.updated_at};});
}

// Reminders whose day has come (today as YYYY-MM-DD, UTC), oldest first.
export async function dueReminders(env,workspaceId,today=new Date().toISOString().slice(0,10)){
  const {results=[]}=await env.DB.prepare(`SELECT id,kind,value_json,due_at,created_at,updated_at FROM copilot_memories WHERE workspace_id=? AND archived_at IS NULL AND kind='reminder' AND due_at IS NOT NULL AND due_at<=? ORDER BY due_at ASC,updated_at DESC LIMIT 20`).bind(workspaceId,clean(today,10)).all();
  return results.map(row=>{let parsed={};try{parsed=JSON.parse(row.value_json||'{}');}catch{}return {id:row.id,kind:row.kind,value:clean(parsed.value,700),due:dueDate(row.due_at),created_at:row.created_at,updated_at:row.updated_at};});
}

export async function saveCopilotMemory(env,{workspaceId,userId,conversationId,candidate}){
  const normalized=normalizeMemoryCandidate(candidate);const existing=await env.DB.prepare(`SELECT id,kind,value_json,created_at,updated_at FROM copilot_memories WHERE workspace_id=? AND fingerprint=?`).bind(workspaceId,normalized.fingerprint).first();
  if(existing){await env.DB.prepare(`UPDATE copilot_memories SET archived_at=NULL,due_at=COALESCE(?,due_at),updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(normalized.due||null,existing.id,workspaceId).run();const list=await listCopilotMemories(env,workspaceId);return list.find(item=>item.id===existing.id)||{id:existing.id,kind:normalized.kind,value:normalized.value,due:normalized.due};}
  const id=uuid();await env.DB.prepare(`INSERT INTO copilot_memories(id,workspace_id,kind,fingerprint,value_json,due_at,created_by,source_conversation_id) VALUES(?,?,?,?,?,?,?,?)`).bind(id,workspaceId,normalized.kind,normalized.fingerprint,JSON.stringify({value:normalized.value}),normalized.due||null,userId||null,conversationId||null).run();
  return {id,kind:normalized.kind,value:normalized.value,due:normalized.due,fingerprint:normalized.fingerprint};
}

export async function archiveCopilotMemory(env,{workspaceId,memoryId}){
  const result=await env.DB.prepare(`UPDATE copilot_memories SET archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND archived_at IS NULL`).bind(memoryId,workspaceId).run();
  return {archived:Number(result?.meta?.changes||0)>0,id:memoryId};
}
