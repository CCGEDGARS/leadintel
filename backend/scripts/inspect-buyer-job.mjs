import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomBytes,createCipheriv,publicEncrypt,constants} from 'node:crypto';
import {readBuyerJob,publicBuyerJob,authoritySql,parse} from '../src/buyer-research-store.js';

export function readOnlyD1({accountId,databaseId,token,fetchImpl=fetch,notAfter=Infinity}){
 if(!/^[a-f0-9]{32}$/i.test(accountId||'')||!/^[-a-f0-9]{36}$/i.test(databaseId||'')||!token)throw Error('D1 inspection credentials are unavailable');
 const endpoint=`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
 return {prepare(sql){
  if(!/^\s*(?:SELECT|WITH)\b/i.test(sql)||/;|\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|ATTACH|DETACH|PRAGMA|VACUUM)\b|\bREPLACE\s+INTO\b/i.test(sql))throw Error('Only read-only inspection queries are permitted');
  let params=[];
  const query=async()=>{
   if(Date.now()>=notAfter)throw Error('Read-only inspection request expired');
   const response=await fetchImpl(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(Math.max(1,Math.min(20000,notAfter-Date.now())))});
   if(!response.ok)throw Error(`D1 inspection HTTP ${response.status}`);
   const data=await response.json(),result=data.result?.[0];
   if(!data.success||!result?.success||!Array.isArray(result.results))throw Error('D1 inspection query was not accepted');
   return result;
  };
  return {bind(...values){params=values;return this;},async first(){return (await query()).results[0]||null;},all:query};
 }};
}

export async function inspectBuyerJob(DB,{workspaceId,domain}){
 if(!/^[a-z0-9_-]{1,160}$/i.test(workspaceId||'')||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(domain||''))throw Error('A bounded workspace and company domain are required');
 const row=await readBuyerJob({DB},workspaceId,{domain});
 if(!row)return {observedAt:new Date().toISOString(),verdict:'NOT_FOUND'};
 const view=await publicBuyerJob({DB},row),input=parse(row.input_json),research=view.candidate.publicResearch?.accountability||{};
 const authority=await DB.prepare(`SELECT CASE WHEN ${authoritySql} THEN 1 ELSE 0 END authorized FROM buyer_research_jobs WHERE workspace_id=? AND id=?`).bind(workspaceId,row.id).first();
 const accepted=view.status==='complete'&&view.quality.passed&&view.quality.confirmedPriorityContacts>=4&&view.quality.researchPassed&&view.quality.aiReviewStatus==='complete';
 return {observedAt:new Date().toISOString(),verdict:accepted?'ACCEPTED':['queued','running'].includes(view.status)?'RUNNING':'INCOMPLETE',job:{id:row.id,status:view.status,phase:view.phase,revision:view.revision,updatedAt:view.updatedAt,continuationVersion:Number(input.contactContinuationVersion)||0,authorized:Boolean(authority?.authorized)},research:{status:research.status,checkedPeople:research.checkedPeople||0,totalPeople:research.totalPeople||0,stopReason:research.stopReason,tools:research.tools},quality:view.quality,progress:view.progress,diagnostics:view.diagnostics};
}

// The repository is public. Production evidence is encrypted to a task-local
// private key; no customer record, credential or raw database body is logged.
export function encryptInspection(value,publicKey){
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return {version:1,algorithm:'RSA-OAEP-SHA256+A256GCM',key:publicEncrypt({key:publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
}

async function main(){
 const args=Object.fromEntries(process.argv.slice(2).reduce((rows,value,index,list)=>index%2?rows:[...rows,[value.replace(/^--/,''),list[index+1]]],[]));
 const expires=Date.parse(args.expires||'');if(!Number.isFinite(expires))throw Error('An explicit inspection expiry is required');
 if(Date.now()>=expires){console.log('[buyer-inspection] Request expired; no production query executed');return;}
 const publicKey=await readFile(new URL('./buyer-inspection-public.pem',import.meta.url),'utf8'),observations=[];
 const emit=async value=>{const envelope=encryptInspection(value,publicKey);console.log('[buyer-inspection] '+JSON.stringify(envelope));await writeFile(args.output||'buyer-inspection.encrypted.json',JSON.stringify(encryptInspection({releaseSha:process.env.EXPECTED_SHA,observations},publicKey)));};
 try{
  const config=await readFile(new URL('../wrangler.toml',import.meta.url),'utf8'),databaseId=config.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
  const started=Date.now(),maxWait=Math.min(600000,Math.max(0,Number(args['max-wait-ms'])||0)),deadline=Math.min(expires,maxWait?started+maxWait:expires),DB=readOnlyD1({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,databaseId,token:process.env.CLOUDFLARE_API_TOKEN,notAfter:deadline});
  do{
   if(Date.now()>=deadline)break;
   const value=await inspectBuyerJob(DB,{workspaceId:args['workspace-id'],domain:args.domain});observations.push(value);await emit(value);
   const freshTerminal=value.job?.continuationVersion>=1&&!['queued','running'].includes(value.job.status);
   if(value.verdict==='NOT_FOUND'||freshTerminal||value.job?.authorized===false||Date.now()-started>=maxWait||Date.now()>=deadline)break;
   await new Promise(resolve=>setTimeout(resolve,Math.max(1,Math.min(30000,deadline-Date.now()))));
  }while(Date.now()<deadline);
 }catch(error){const failure={observedAt:new Date().toISOString(),verdict:'UNAVAILABLE',reason:String(error.message||'Inspection unavailable').slice(0,180)};observations.push(failure);await emit(failure);process.exitCode=1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
