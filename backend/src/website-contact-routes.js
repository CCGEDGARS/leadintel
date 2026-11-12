import {websiteContactAccess,contactError,publicWebsiteContacts,websiteContactView,readWebsiteContacts,startWebsiteContacts,commandWebsiteContacts} from './website-contact-store.js';
import {runWebsiteContactJobs} from './website-contact-runner.js';
import {lookupWebsiteContact} from './website-contact-paid.js';
import {readAdditionalContactPolicy} from './additional-contact-services.js';
import {storageErrorResponse} from './workspace-storage.js';

export async function handleWebsiteContactRoute(request,env,cors={},ctx){
 const url=new URL(request.url);if(url.pathname!=='/api/websites/contacts')return null;
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...cors}});
 try{
  const workspaceId=url.searchParams.get('workspace_id');if(!workspaceId||workspaceId.length>160)throw contactError('Workspace is required.',400);
  const context=await websiteContactAccess(request,env,workspaceId);
  if(request.method==='GET')return json({job:await websiteContactView(env,await readWebsiteContacts(env,workspaceId,{id:url.searchParams.get('job_id'),companyId:url.searchParams.get('company_id')})),paidPolicy:await readAdditionalContactPolicy(env,workspaceId)});
  if(request.method!=='POST')throw contactError('Method not allowed.',405);
  const text=await request.text();if(text.length>12000)throw contactError('Contact request is too large.',413);
  let body;try{body=JSON.parse(text);}catch{throw contactError('A contact research request is required.',400);}
  if(!body||typeof body!=='object'||Array.isArray(body))throw contactError('A contact research request is required.',400);
  if(body.action==='paid'){const result=await lookupWebsiteContact(request,env,context,body);return json({result,job:await websiteContactView(env,await readWebsiteContacts(env,workspaceId,{id:body.jobId}))});}
  if(!['start','resume','cancel','wake'].includes(body.action||'start'))throw contactError('Unknown research action.',400);
  const row=(body.action||'start')==='start'?await startWebsiteContacts(env,context,body):await commandWebsiteContacts(env,context,body);
  if(ctx?.waitUntil&&['queued','running'].includes(row.status))ctx.waitUntil(runWebsiteContactJobs(env,{jobId:row.id,windowMs:18000}).catch(()=>{}));
  return json({job:await websiteContactView(env,row)});
 }catch(error){return storageErrorResponse(error,cors)||json({error:error.status?error.message:'Contact research could not be saved. Completed results are preserved.',code:error.code||'WEBSITE_CONTACT_UNAVAILABLE'},error.status||503);}
}
