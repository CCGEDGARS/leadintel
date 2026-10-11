const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const DEFAULT_TIMEOUT_MS=12000;
const CHAT_TIMEOUT_MS=125000;

export async function readCopilotStream(response,onProgress=()=>{}){
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result=null;
  const consume=frame=>{let event='';const data=[];for(const line of frame.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data.push(line.slice(5).trimStart());}if(!data.length)return;const value=JSON.parse(data.join('\n'));if(event==='error')throw new Error(value.error||'Assistant request failed');if(event==='progress')onProgress(value);if(event==='result')result=value;};
  try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done}).replace(/\r\n/g,'\n');if(buffer.length>100000)throw new Error('Assistant response exceeded the limit');let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){consume(buffer.slice(0,boundary));buffer=buffer.slice(boundary+2);}if(done)break;}if(buffer.trim())consume(buffer);if(!result)throw new Error('Assistant response ended before completion');return result;}finally{reader.releaseLock();}
}

function bridgeState(){return window.LeadIntelServerBridge||null;}
function activeWorkspace(){const bridge=bridgeState();if(!bridge?.session?.authenticated||!bridge.workspace)return '';return String(bridge.workspace.id||'').trim();}
function withWorkspace(path,workspaceId){const url=new URL(path,API_BASE);url.searchParams.set('workspace_id',workspaceId);return url.toString();}

export async function requestCopilot(path,options={}){
  const workspaceId=activeWorkspace();if(!workspaceId)return null;
  const timeoutMs=Math.max(1000,Math.min(CHAT_TIMEOUT_MS,Number(options.timeoutMs)||DEFAULT_TIMEOUT_MS));const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(withWorkspace(path,workspaceId),{method:options.method||'GET',credentials:'include',headers:{Accept:'application/json',...(options.body!==undefined?{'Content-Type':'application/json'}:{}),...(options.headers||{})},body:options.body===undefined?undefined:JSON.stringify(options.body),signal:controller.signal});
    if(response.ok&&response.headers.get('Content-Type')?.includes('text/event-stream'))return await readCopilotStream(response,options.onProgress);
    const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(String(payload?.error||`Copilot request failed (${response.status})`).slice(0,240));error.status=response.status;error.payload=payload;throw error;}return payload;
  }finally{clearTimeout(timer);}
}

export function bootstrapCopilot(){return requestCopilot('/api/copilot/bootstrap',{timeoutMs:DEFAULT_TIMEOUT_MS});}
export function sendCopilotMessage(payload,{onProgress}={}){return requestCopilot('/api/copilot/chat',{method:'POST',body:payload||{},headers:{Accept:'text/event-stream'},onProgress,timeoutMs:CHAT_TIMEOUT_MS});}
export function confirmCopilotAction(id,idempotencyKey){return requestCopilot(`/api/copilot/actions/${encodeURIComponent(id)}/confirm`,{method:'POST',headers:{'Idempotency-Key':String(idempotencyKey||'')},body:{idempotency_key:String(idempotencyKey||'')},timeoutMs:DEFAULT_TIMEOUT_MS});}
export function rejectCopilotAction(id){return requestCopilot(`/api/copilot/actions/${encodeURIComponent(id)}/reject`,{method:'POST',body:{},timeoutMs:DEFAULT_TIMEOUT_MS});}

if(typeof window!=='undefined')window.LeadIntelCopilotApi={requestCopilot,bootstrapCopilot,sendCopilotMessage,confirmCopilotAction,rejectCopilotAction};
