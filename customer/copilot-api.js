const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
const DEFAULT_TIMEOUT_MS=12000;
const CHAT_TIMEOUT_MS=35000;
const FILE_ANALYSIS_TIMEOUT_MS=70000;

function bridgeState(){return window.LeadIntelServerBridge||null;}
function activeWorkspace(){const bridge=bridgeState();if(!bridge?.session?.authenticated||!bridge.workspace)return '';return String(bridge.workspace.id||'').trim();}
function withWorkspace(path,workspaceId){const url=new URL(path,API_BASE);url.searchParams.set('workspace_id',workspaceId);return url.toString();}

export async function requestCopilot(path,options={}){
  const workspaceId=activeWorkspace();if(!workspaceId)return null;
  const ceiling=options.extendedTimeout===true?FILE_ANALYSIS_TIMEOUT_MS:CHAT_TIMEOUT_MS;const timeoutMs=Math.max(1000,Math.min(ceiling,Number(options.timeoutMs)||DEFAULT_TIMEOUT_MS));const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const abort=()=>controller.abort();if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
  try{
    const response=await fetch(withWorkspace(path,workspaceId),{method:options.method||'GET',credentials:'include',headers:{Accept:'application/json',...(options.body!==undefined&&!options.formData?{'Content-Type':'application/json'}:{}),...(options.headers||{})},body:options.formData|| (options.body===undefined?undefined:JSON.stringify(options.body)),signal:controller.signal});
    const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(String(payload?.error||`Copilot request failed (${response.status})`).slice(0,240));error.status=response.status;error.payload=payload;throw error;}return payload;
  }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}

export function bootstrapCopilot(){return requestCopilot('/api/copilot/bootstrap',{timeoutMs:DEFAULT_TIMEOUT_MS});}
export function sendCopilotMessage(payload){return requestCopilot('/api/copilot/chat',{method:'POST',body:payload||{},timeoutMs:CHAT_TIMEOUT_MS});}
export function confirmCopilotAction(id,idempotencyKey){return requestCopilot(`/api/copilot/actions/${encodeURIComponent(id)}/confirm`,{method:'POST',headers:{'Idempotency-Key':String(idempotencyKey||'')},body:{idempotency_key:String(idempotencyKey||'')},timeoutMs:DEFAULT_TIMEOUT_MS});}
export function rejectCopilotAction(id){return requestCopilot(`/api/copilot/actions/${encodeURIComponent(id)}/reject`,{method:'POST',body:{},timeoutMs:DEFAULT_TIMEOUT_MS});}

export function uploadCopilotFile({file,extraction,sha256,extractorVersion},options={}){const formData=new FormData();formData.set('file',file);formData.set('extraction_json',JSON.stringify(extraction));formData.set('sha256',sha256);formData.set('extractor_version',extractorVersion);return requestCopilot('/api/copilot/files',{method:'POST',formData,timeoutMs:CHAT_TIMEOUT_MS,signal:options.signal});}
export function analyzeCopilotFile(payload,options={}){return requestCopilot('/api/copilot/file-analyses',{method:'POST',body:payload,timeoutMs:FILE_ANALYSIS_TIMEOUT_MS,extendedTimeout:true,signal:options.signal});}
export function continueCopilotFileAnalysis(id,message,options={}){return requestCopilot(`/api/copilot/file-analyses/${encodeURIComponent(id)}/messages`,{method:'POST',body:{message},timeoutMs:FILE_ANALYSIS_TIMEOUT_MS,extendedTimeout:true,signal:options.signal});}
export function listCopilotFileAnalyses(options={}){return requestCopilot('/api/copilot/file-analyses',{signal:options.signal});}
export function getCopilotFileAnalysis(id,options={}){return requestCopilot(`/api/copilot/file-analyses/${encodeURIComponent(id)}`,{signal:options.signal});}
export function saveCopilotFileAnalysis(id,options={}){return requestCopilot(`/api/copilot/file-analyses/${encodeURIComponent(id)}/save`,{method:'POST',body:{},signal:options.signal});}
export function deleteCopilotFileAnalysis(id,options={}){return requestCopilot(`/api/copilot/file-analyses/${encodeURIComponent(id)}`,{method:'DELETE',signal:options.signal});}

if(typeof window!=='undefined')window.LeadIntelCopilotApi={requestCopilot,bootstrapCopilot,sendCopilotMessage,confirmCopilotAction,rejectCopilotAction,uploadCopilotFile,analyzeCopilotFile,continueCopilotFileAnalysis,listCopilotFileAnalyses,getCopilotFileAnalysis,saveCopilotFileAnalysis,deleteCopilotFileAnalysis};
