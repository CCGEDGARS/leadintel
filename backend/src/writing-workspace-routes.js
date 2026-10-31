import {contactRequestGuard} from './contact-operation-authority.js';
import {messageBatch} from './message-operation-authority.js';
import {validSkillAttribution} from './workspace-skill-attribution.js';
import {validCompanyMaterialAttribution} from './company-materials-context.js';
import RichText from '../../customer/rich-text.js';
import {cookieValue,sha256} from './security.js';
import {storageErrorResponse} from './workspace-storage.js';

const MAX_REQUEST_BYTES=100000;
const json=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const object=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const bounded=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Attribution describes a past application of writing guidance. It never grants
// evidence, customer access, source activation, or permission to send anything.
function attribution(value,workspace){
 if(value==null)return null;
 if(!object(value)||JSON.stringify(value).length>8000||Object.keys(value).some(key=>!['workspaceId','referenceRevision','sourceRefs','skillRefs','citations','appliedAt','writingContext','sourceSelection','companyMaterialRefs','storyRef','storyReview'].includes(key))||value.workspaceId!==workspace||!Number.isSafeInteger(value.referenceRevision)||value.referenceRevision<0||!Array.isArray(value.sourceRefs)||value.sourceRefs.length>3||!Array.isArray(value.citations)||value.citations.length>8||!bounded(value.appliedAt,40)||!Number.isFinite(Date.parse(value.appliedAt)))fail('Invalid historical writing-source attribution');
 if(value.storyRef&&(!object(value.storyRef)||!bounded(value.storyRef.id,120)||!Number.isSafeInteger(value.storyRef.revision)||value.storyRef.revision<1))fail('Invalid story attribution');
 if(value.storyReview&&(!object(value.storyReview)||!Number.isInteger(value.storyReview.score)||value.storyReview.score<16||value.storyReview.score>20))fail('Invalid story review');
 if(!validCompanyMaterialAttribution(value.companyMaterialRefs))fail('Invalid company reference attribution');
 if(value.writingContext!==undefined&&!['general','customer'].includes(value.writingContext)||value.sourceSelection!==undefined&&!['session','active'].includes(value.sourceSelection))fail('Invalid writing-source context');
 if(!validSkillAttribution(value.skillRefs))fail('Invalid historical skill references');
 const refs=value.sourceRefs;
 if(refs.some(ref=>!object(ref)||Object.keys(ref).some(key=>!['id','revision'].includes(key))||!bounded(ref.id,120)||!Number.isSafeInteger(ref.revision)||ref.revision<1)||new Set(refs.map(ref=>ref.id)).size!==refs.length)fail('Invalid historical writing-source references');
 for(const citation of value.citations)if(!object(citation)||Object.keys(citation).some(key=>!['passageId','sourceId','revision','filename','location','role'].includes(key))||!refs.some(ref=>ref.id===citation.sourceId&&ref.revision===citation.revision)||!bounded(citation.filename,256)||!bounded(citation.location,80)||!/^(page|line):\d+$/.test(citation.location)||!['guidance','seller','customer'].includes(citation.role)||citation.passageId!==undefined&&!bounded(citation.passageId,200))fail('Invalid historical writing-source citation');
 return value;
}

async function readBody(request){
 if(Number(request.headers.get('Content-Length'))>MAX_REQUEST_BYTES)fail('Writing payload too large',413);
 const reader=request.body?.getReader();if(!reader)fail('Invalid writing payload');
 const chunks=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_REQUEST_BYTES){await reader.cancel();fail('Writing payload too large',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const raw=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.byteLength;}
 let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{fail('Invalid writing payload');}
 if(!object(body)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)fail('Expected revision is required');
 return body;
}

function payload(body,workspace){
 if(Object.keys(body).some(key=>!['expectedRevision','kind','title','subject','message','messageHtml','writingAssistant'].includes(key))||!['draft','template'].includes(body.kind))fail('Invalid writing record');
 if(!bounded(body.title,80)||!body.title.trim())fail('A title of up to 80 characters is required');
 if(body.subject!==undefined&&(typeof body.subject!=='string'||body.subject.length>500))fail('Subject must be at most 500 characters');
 if(!bounded(body.message,12000)||!body.message.trim())fail('A message of up to 12000 characters is required');
 let html='';if(body.messageHtml!==undefined){if(typeof body.messageHtml!=='string'||body.messageHtml.length>RichText.MAX_HTML)fail('Invalid message formatting');html=RichText.matchingHtml(body.message,body.messageHtml);if(body.messageHtml&&!html)fail('Formatting does not match the message');}
 const writingAssistant=attribution(body.writingAssistant,workspace);
 return {kind:body.kind,title:body.title.trim(),subject:body.subject||'',message:body.message,...(html?{messageHtml:html}:{}),...(writingAssistant?{writingAssistant}:{})};
}
const record=row=>({...JSON.parse(row.payload_json),id:row.id,revision:row.revision,updatedAt:row.updated_at});

export async function handleWritingWorkspaceRoute(request,env,cors={}){
 const url=new URL(request.url),path=url.pathname;
 if(path!=='/api/writing-workspace'&&!path.startsWith('/api/writing-workspace/'))return null;
 try{
  const token=cookieValue(request,'leadintel_session');if(!token)fail('Authentication required',401);
  const user=await env.DB.prepare("SELECT users.id FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();if(!user)fail('Authentication required',401);
  const workspace=url.searchParams.get('workspace_id')||'';
  const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).first();if(!member)fail('Workspace access denied',403);
  const context={workspaceId:workspace,userId:user.id,role:member.role};context.guard=await contactRequestGuard(request,env,context);context.writeAuthority=context.guard.writeAuthority;const respond=async(...args)=>{await context.guard();return json(...args);};
  if(path==='/api/writing-workspace'&&request.method==='GET'){
   const rows=await env.DB.prepare('SELECT id,payload_json,revision,updated_at FROM writing_workspace_records WHERE workspace_id=? AND user_id=? AND archived=0 ORDER BY updated_at DESC,id').bind(workspace,user.id).all();
   return await respond({records:(rows.results||[]).map(record)},200,cors);
  }
  if(!['PUT','DELETE'].includes(request.method))fail('Method not allowed',405);
  if(!['owner','researcher','sales'].includes(member.role))fail('Write access required',403);
  const match=path.match(/^\/api\/writing-workspace\/([^/]+)$/);if(!match||!uuid.test(match[1]))fail('A valid writing record UUID is required');
  const id=match[1],body=await readBody(request),expected=body.expectedRevision,updatedAt=new Date().toISOString();
  let next,result;
  if(request.method==='DELETE'){
   if(Object.keys(body).some(key=>key!=='expectedRevision')||expected===0)fail('This record changed elsewhere. Refresh before deleting.',409);
   result=(await messageBatch(env,context,[env.DB.prepare('UPDATE writing_workspace_records SET archived=1,revision=revision+1,updated_at=? WHERE workspace_id=? AND user_id=? AND id=? AND revision=? AND archived=0').bind(updatedAt,workspace,user.id,id,expected)])).at(-1);
  }else{
   next=payload(body,workspace);
   if(expected===0){
    // Count and insertion share one statement: two concurrent creates cannot
    // both claim the final slot, and existing IDs are never overwritten.
    result=(await messageBatch(env,context,[env.DB.prepare('INSERT OR IGNORE INTO writing_workspace_records(workspace_id,user_id,id,payload_json,revision,updated_at) SELECT ?,?,?,?,1,? WHERE (SELECT COUNT(*) FROM writing_workspace_records WHERE workspace_id=? AND user_id=? AND archived=0)<60').bind(workspace,user.id,id,JSON.stringify(next),updatedAt,workspace,user.id)])).at(-1);
   }else result=(await messageBatch(env,context,[env.DB.prepare('UPDATE writing_workspace_records SET payload_json=?,revision=revision+1,updated_at=? WHERE workspace_id=? AND user_id=? AND id=? AND revision=? AND archived=0').bind(JSON.stringify(next),updatedAt,workspace,user.id,id,expected)])).at(-1);
  }
  if(!result.meta?.changes){
   if(expected===0){const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM writing_workspace_records WHERE workspace_id=? AND user_id=? AND archived=0').bind(workspace,user.id).first();if(count.n>=60)fail('Your writing workspace holds up to 60 drafts and templates. Delete or edit an existing record.',409);}
   fail('This record changed elsewhere. Refresh before saving; your edits are preserved.',409);
  }
  return request.method==='DELETE'?await respond({ok:true,revision:expected+1},200,cors):await respond({record:{...next,id,revision:expected+1,updatedAt}},200,cors);
 }catch(error){const storage=storageErrorResponse(error,cors);if(storage)return storage;if(!error.status)throw error;return json({error:error.message},error.status,cors);}
}
