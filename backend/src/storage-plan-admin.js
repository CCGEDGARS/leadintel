import {allowedOrigin} from './security.js';
import {storageAccount} from './workspace-storage.js';

const limits=['included_records_limit','included_files_limit','plus_records_limit','plus_files_limit'];
const fields=limits.join(',');
const respond=(value,status,cors)=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...cors}});
const revision=value=>Number.isSafeInteger(value)&&value>=0;

export async function storagePlanAdmin(request,env,cors){
 const url=new URL(request.url);
 const workspace=url.searchParams.get('workspace')||'';
 const db=env.DB;
 const error=(message,status)=>respond({error:message},status,cors);
 if(!['GET','POST'].includes(request.method))return error('Method not allowed',405);
 if(request.method==='POST'&&(!allowedOrigin(request,env.APP_ORIGIN)||!request.headers.get('Content-Type')?.startsWith('application/json')))return error('Use the signed-in admin page to save changes.',403);
 const settings=await db.prepare('SELECT * FROM storage_plan_settings WHERE id=1').first();
 let account=null;
 if(workspace){
  if(!await db.prepare('SELECT id FROM workspaces WHERE id=?').bind(workspace).first())return error('Workspace was not found.',404);
  account=await storageAccount(env,workspace);
 }
 if(request.method==='GET'){
  const workspaces=(await db.prepare('SELECT id,name FROM workspaces ORDER BY name,id').all()).results;
  const selected=account?Object.fromEntries(['workspace_id',...limits,'limits_overridden','limits_revision','records_bytes','files_bytes'].map(key=>[key,account[key]])):null;
  return respond({settings,workspaces,selected},200,cors);
 }
 const body=await request.json().catch(()=>null);
 if(!body||!revision(body.revision)||workspace&&!revision(body.limits_revision))return error('Reload the storage editor before saving.',400);
 const reset=workspace&&body.action==='reset';
 if(!reset&&body.action!=='save')return error('Unknown storage action.',400);
 const values=limits.map(key=>(reset?settings:body)[key]);
 if(values.some(value=>!Number.isSafeInteger(value)||value<=0)||values[2]<values[0]||values[3]<values[1])return error('Enter positive limits. Each Plus allowance must cover the Included allowance.',400);
 const assignments=limits.map(key=>key+'=?').join(',');
 let update;
 if(workspace){
  update=db.prepare('UPDATE workspace_storage_accounts SET '+assignments+',limits_overridden=?,limits_revision=limits_revision+1 WHERE workspace_id=? AND limits_revision=? AND (SELECT revision FROM storage_plan_settings WHERE id=1)=?')
   .bind(...values,reset?0:1,workspace,body.limits_revision,body.revision);
 }else{
  const amount=body.monthly_amount_minor;
  if(amount!==null&&(!Number.isInteger(amount)||amount<1||amount>99999999))return error('Enter a monthly EUR price with up to two decimal places.',400);
  update=db.prepare('UPDATE storage_plan_settings SET '+assignments+',monthly_amount_minor=?,revision=revision+1 WHERE id=1 AND revision=?').bind(...values,amount,body.revision);
 }
 if(!(await update.run()).meta.changes)return error('Another administrator changed these settings. Reload to review the new values.',409);
 return respond({saved:true},200,cors);
}
