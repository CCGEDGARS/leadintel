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

export async function inspectBuyerJob(DB,{workspaceId,domain,details=false}){
 if(!/^[a-z0-9_-]{1,160}$/i.test(workspaceId||'')||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(domain||''))throw Error('A bounded workspace and company domain are required');
 const row=await readBuyerJob({DB},workspaceId,{domain});
 if(!row)return {observedAt:new Date().toISOString(),verdict:'NOT_FOUND'};
 const rawView=await publicBuyerJob({DB},row),view=await publicBuyerJob({DB},row,{recoverRetained:true}),input=parse(row.input_json),research=view.candidate.publicResearch?.accountability||{};
 const authority=await DB.prepare(`SELECT CASE WHEN ${authoritySql} THEN 1 ELSE 0 END authorized FROM buyer_research_jobs WHERE workspace_id=? AND id=?`).bind(workspaceId,row.id).first();
 const accepted=view.status==='complete'&&view.quality.passed&&view.quality.confirmedPriorityContacts>=4&&view.quality.researchPassed&&view.quality.aiReviewStatus==='complete';
 const result={observedAt:new Date().toISOString(),verdict:accepted?'ACCEPTED':['queued','running'].includes(view.status)?'RUNNING':'INCOMPLETE',job:{id:row.id,status:view.status,phase:view.phase,revision:view.revision,updatedAt:view.updatedAt,continuationVersion:Number(input.contactContinuationVersion)||0,executionVersion:Number(input.executionContinuationVersion)||0,authorized:Boolean(authority?.authorized),phaseRuns:row.phase_runs,phaseMs:row.phase_ms},research:{status:research.status,checkedPeople:research.checkedPeople||0,totalPeople:research.totalPeople||0,stopReason:research.stopReason,tools:research.tools},quality:view.quality,rawJobQuality:rawView.quality,retainedEvidenceRecovered:view.retainedEvidenceRecovered,progress:view.progress,diagnostics:view.diagnostics};
 if(details){
  const D=globalThis.LeadIntelDiscovery,c=view.candidate,inventory=c.buyerDiscovery?.officialContactInventory||{},dossier=c.buyerDiscovery?.companyDossier||{};
  const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
  const person=p=>({...pick(p,['id','name','publicName','title','organization','publicNameUrl','publicEmail','publicEmailUrl','publicEmailEvidence','publicEmailSourceCheck','publicPhone','publicPhoneUrl','publicPhoneEvidence','publicPhoneSourceCheck','publicLinkedinUrl','linkedin_url','linkedinIdentityEvidence','linkedinProfileReview','roleReview','corporateRoleEvidence','decisionEvidence','opportunityScope','identityStatus','nameVerification','contactResearch','emailResearch','contactData']),qualification:D.qualifyBuyer(p,input.profile||{},c)});
  const [models,policy,tasks,owner]=await Promise.all([
   DB.prepare('SELECT provider,model,active,verified_at,last_used_at FROM workspace_ai_integrations WHERE workspace_id=? ORDER BY provider').bind(workspaceId).all(),
   DB.prepare('SELECT enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,updated_at FROM additional_contact_policies WHERE workspace_id=?').bind(workspaceId).first(),
   DB.prepare("SELECT kind,phase,request_value,status,attempts,error,updated_at FROM buyer_research_tasks WHERE job_id=? AND status<>'complete' ORDER BY phase,updated_at LIMIT 256").bind(row.id).all(),
   DB.prepare('SELECT payload_json,updated_at FROM workspace_company_dossiers WHERE workspace_id=? AND domain=?').bind(workspaceId,domain).first()
  ]);
  const ownerDossier=parse(owner?.payload_json,{});
  const failedUrls=[...new Set((c.people||[]).flatMap(p=>Object.values(p.contactResearch?.checks||{}).flatMap(check=>(check.queryLog||[]).flatMap(query=>(query.sourceReads||[]).filter(source=>source.status==='partial').map(source=>source.url)))).filter(url=>typeof url==='string'))].slice(0,32);
  const sourceTasks=failedUrls.length?await DB.prepare(`SELECT request_value,status,attempts,result_json,error FROM buyer_research_tasks WHERE job_id=? AND kind='read' AND request_value IN (${failedUrls.map(()=>'?').join(',')}) LIMIT 32`).bind(row.id,...failedUrls).all():{results:[]};
  result.details={dossierOwner:{updatedAt:owner?.updated_at,...pick(ownerDossier,['status','reason','continuation','checkedAt','gaps','conflicts']),passes:(ownerDossier.passes||[]).map(pass=>pick(pass,['provider','model','status','reason','searchFamilies','sourceReads','failures','extractedSources','people']))},input:pick(input,['profile','roles','scope','personIds']),people:(c.people||[]).map(person),pool:(c.buyerDiscovery?.pool||[]).slice(0,30).map(person),official:{research:inventory.research,sourcePages:inventory.sourcePages,contacts:(inventory.contacts||[]).slice(0,40).map(person)},dossier:{...pick(dossier,['status','reason','checkedAt','gaps','conflicts','facts','people','assignments']),passes:(dossier.passes||[]).map(pass=>pick(pass,['provider','model','status','reason','searchFamilies','sourceReads','failures']))},buyerAgent:c.publicResearch?.buyerAgent,aiReview:c.publicResearch?.aiReview,paidResearch:c.publicResearch?.paidResearch,paidPolicy:policy,models:models.results||[],failedTasks:tasks.results||[],crm:view.crm?{contacts:(view.crm.contacts||[]).map(p=>pick(p,['id','external_person_id','name','title','normalized_email','work_email','email_status','email_verification_provider','phone_number','phone_status','linkedin_url','contact_data'])),contactData:view.crm.contactData}:null};
  result.details.sourceFailures=(sourceTasks.results||[]).map(task=>{const page=parse(task.result_json,{});return {requested:task.request_value,status:task.status,attempts:task.attempts,error:task.error,actual:page.url,metadataSourceURL:page.metadata?.sourceURL,metadataURL:page.metadata?.url,statusCode:page.metadata?.statusCode,textLength:String(page.markdown||page.content||page.text||'').length};});
 }
 return result;
}

// The repository is public. Production evidence is encrypted to a task-local
// private key; no customer record, credential or raw database body is logged.
export function encryptInspection(value,publicKey){
 const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return {version:1,algorithm:'RSA-OAEP-SHA256+A256GCM',key:publicEncrypt({key:publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
}

export function inspectionLogLines(envelope){
 const value=JSON.stringify(envelope),size=6000;if(value.length<=size)return ['[buyer-inspection] '+value];
 const id=randomBytes(8).toString('hex'),total=Math.ceil(value.length/size);
 return Array.from({length:total},(_,i)=>`[buyer-inspection-part] ${id} ${i+1}/${total} ${value.slice(i*size,(i+1)*size)}`);
}

async function main(){
 const args=Object.fromEntries(process.argv.slice(2).reduce((rows,value,index,list)=>index%2?rows:[...rows,[value.replace(/^--/,''),list[index+1]]],[]));
 const expires=Date.parse(args.expires||'');if(!Number.isFinite(expires))throw Error('An explicit inspection expiry is required');
 if(Date.now()>=expires){console.log('[buyer-inspection] Request expired; no production query executed');return;}
 const publicKey=await readFile(new URL('./buyer-inspection-public.pem',import.meta.url),'utf8'),observations=[];
 const emit=async value=>{const envelope=encryptInspection(value,publicKey);for(const line of inspectionLogLines(envelope))console.log(line);await writeFile(args.output||'buyer-inspection.encrypted.json',JSON.stringify(encryptInspection({releaseSha:process.env.EXPECTED_SHA,observations},publicKey)));};
 try{
  const config=await readFile(new URL('../wrangler.toml',import.meta.url),'utf8'),databaseId=config.match(/database_id\s*=\s*"([^"]+)"/)?.[1];
  const started=Date.now(),maxWait=Math.min(600000,Math.max(0,Number(args['max-wait-ms'])||0)),deadline=Math.min(expires,maxWait?started+maxWait:expires),DB=readOnlyD1({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,databaseId,token:process.env.CLOUDFLARE_API_TOKEN,notAfter:deadline});
  do{
   if(Date.now()>=deadline)break;
   const value=await inspectBuyerJob(DB,{workspaceId:args['workspace-id'],domain:args.domain,details:args.details==='true'});observations.push(value);await emit(value);
   const freshTerminal=value.job?.continuationVersion>=1&&!['queued','running'].includes(value.job.status);
   if(value.verdict==='NOT_FOUND'||freshTerminal||value.job?.authorized===false||Date.now()-started>=maxWait||Date.now()>=deadline)break;
   await new Promise(resolve=>setTimeout(resolve,Math.max(1,Math.min(30000,deadline-Date.now()))));
  }while(Date.now()<deadline);
 }catch(error){const failure={observedAt:new Date().toISOString(),verdict:'UNAVAILABLE',reason:String(error.message||'Inspection unavailable').slice(0,180)};observations.push(failure);await emit(failure);process.exitCode=1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
