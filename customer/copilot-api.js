const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const DEFAULT_TIMEOUT_MS=12000;
const CHAT_TIMEOUT_MS=35000;

function bridgeState(){return window.LeadIntelServerBridge||null;}
function activeWorkspace(){const bridge=bridgeState();if(!bridge?.session?.authenticated||!bridge.workspace)return '';return String(bridge.workspace.id||'').trim();}
function withWorkspace(path,workspaceId){const url=new URL(path,API_BASE);url.searchParams.set('workspace_id',workspaceId);return url.toString();}

export async function requestCopilot(path,options={}){
  const workspaceId=activeWorkspace();if(!workspaceId)return null;
  const timeoutMs=Math.max(1000,Math.min(35000,Number(options.timeoutMs)||DEFAULT_TIMEOUT_MS));const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(withWorkspace(path,workspaceId),{method:options.method||'GET',credentials:'include',headers:{Accept:'application/json',...(options.body!==undefined?{'Content-Type':'application/json'}:{}),...(options.headers||{})},body:options.body===undefined?undefined:JSON.stringify(options.body),signal:controller.signal});
    const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(String(payload?.error||`Copilot request failed (${response.status})`).slice(0,240));error.status=response.status;error.payload=payload;throw error;}return payload;
  }finally{clearTimeout(timer);}
}

export function bootstrapCopilot(){return requestCopilot('/api/copilot/bootstrap',{timeoutMs:DEFAULT_TIMEOUT_MS});}
export function sendCopilotMessage(payload){return requestCopilot('/api/copilot/chat',{method:'POST',body:payload||{},timeoutMs:CHAT_TIMEOUT_MS});}
export function confirmCopilotAction(id,idempotencyKey){return requestCopilot(`/api/copilot/actions/${encodeURIComponent(id)}/confirm`,{method:'POST',headers:{'Idempotency-Key':String(idempotencyKey||'')},body:{idempotency_key:String(idempotencyKey||'')},timeoutMs:DEFAULT_TIMEOUT_MS});}
export function rejectCopilotAction(id){return requestCopilot(`/api/copilot/actions/${encodeURIComponent(id)}/reject`,{method:'POST',body:{},timeoutMs:DEFAULT_TIMEOUT_MS});}

if(typeof window!=='undefined')window.LeadIntelCopilotApi={requestCopilot,bootstrapCopilot,sendCopilotMessage,confirmCopilotAction,rejectCopilotAction};
