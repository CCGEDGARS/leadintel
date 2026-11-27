import S from '../../customer/website-scanning.js';
import {fetchDirectPublicPage,readPublicBuyerPage} from './service-integrations.js';
import {productionProvider} from './copilot-service.js';
import {allowFullResearch} from './research-strategy.js';
import {contactRequestGuard} from './contact-operation-authority.js';
import {sha256} from './security.js';
import {findCrmCompanyByDomain,upsertCrmCompany} from './crm.js';
import {contactError,contactSql} from './website-contact-store.js';
import {fastCompanyPage} from './fast-research-evidence.js';

function looksLikeDirectory(page){
 return /\b(?:directory|rankings?|member list|companies listed|top \d+ companies)\b/i.test(page.title+' '+page.text.slice(0,1200));
}
function groundedHomepage(page){
 if(looksLikeDirectory(page))return null;
 const candidates=page.title.split(/\s+[–—-]\s+|[|]/).map(s=>s.trim());
 for(const name of candidates){
  if(/^(?:home|homepage|welcome|front page|forside|startseite)$/i.test(name)||name.includes('.')||name.length<2||name.length>100||!S.assessIdentity({name},page).verified)continue;
  const lines=page.text.split('\n').map(s=>s.trim()).filter(s=>s.toLowerCase().includes(name.toLowerCase())&&s.length<=700);
  const line=lines.find(s=>s.length>=name.length+25)||lines[0];
  if(line)return {pageType:'company',companies:[{name,quote:line.trim(),website:page.url}]};
 }
 return null;
}

export async function scanWebsite(request,env,context,body){
 const url=S.safeUrl(body.url),domain=S.domain(url);
 if(!url)throw contactError('Enter a public website URL.',400);
 const guard=await contactRequestGuard(request,env,context);
 const scope={...context,guard,writeAuthority:guard.writeAuthority};
 const key=await sha256(url),token=crypto.randomUUID(),now=Date.now();
 await guard();
 await contactSql(env,'DELETE FROM website_scan_requests WHERE expires_at<=?',now).run();
 const claim=await contactSql(env,'INSERT INTO website_scan_requests(workspace_id,url_hash,token,expires_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING',scope.workspaceId,key,token,now+120000).run();
 if(!claim.meta.changes){
  const other=await contactSql(env,'SELECT result_json FROM website_scan_requests WHERE workspace_id=? AND url_hash=?',scope.workspaceId,key).first();
  if(!other?.result_json)return {pending:true};
  const result=JSON.parse(other.result_json);
  if(result.fastResearch){
   const company=await findCrmCompanyByDomain(env.DB,scope.workspaceId,domain);
   if(!company||company.id!==result.rows[0].crmId||company.company_name!==result.rows[0].name)throw contactError('Company identity changed. Review the saved website.');
  }
  await guard();return result;
 }
 try{
  const scan=await identifyWebsite(request,env,scope,{url,domain});
  await guard();
  await contactSql(env,'UPDATE website_scan_requests SET result_json=?,expires_at=? WHERE workspace_id=? AND url_hash=? AND token=?',JSON.stringify(scan),Date.now()+120000,scope.workspaceId,key,token).run();
  return scan;
 }catch(error){
  await contactSql(env,'DELETE FROM website_scan_requests WHERE workspace_id=? AND url_hash=? AND token=?',scope.workspaceId,key,token).run();
  throw error;
 }
}

async function identifyWebsite(request,env,scope,{url,domain}){
 const {guard,workspaceId}=scope;
 const known=await findCrmCompanyByDomain(env.DB,workspaceId,domain);
 // Only a prior scan of this exact company page can establish its type without a new read.
 const cached=await fastCompanyPage(env,workspaceId,url,domain);
 let metered=true;
 try{await allowFullResearch(env,workspaceId);}catch(error){if(error.code!=='FULL_RESEARCH_DISABLED')throw error;metered=false;}
 await guard();
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(50000)]);
 let raw;
 try{raw=cached||(metered?await readPublicBuyerPage(env,workspaceId,url,{signal,purpose:'website_scan'}):await fetchDirectPublicPage(url,{signal}));}
 catch(error){throw contactError(metered?'The website could not be read. Check the URL or try its official homepage.':'Direct reading failed. Metered web extraction is disabled in Search strategy.',error.status||502);}
 await guard();
 const data=raw.data,actual=S.safeUrl(data.url||data.metadata?.sourceURL||url);
 if(!actual||S.domain(actual)!==domain)throw contactError('The site redirected to another domain. Review its official URL before scanning.');
 const page={url:actual,title:String(data.title||data.metadata?.title||''),text:String(data.markdown||''),links:data.links||[]};
 if(page.text.trim().length<40)throw contactError('The page returned too little readable content to identify a company.',422);
 let extracted=groundedHomepage(page);
 if(!extracted){
  await guard();await allowFullResearch(env,workspaceId);
  const ai=await productionProvider(env,workspaceId);
  if(!ai)throw contactError('Connect an AI engine to extract companies from this page, or enter the company homepage.',422);
  const result=await ai.generate({...S.buildPrompt(page,null,S.MAX_COMPANIES),maxOutputTokens:10000,signal});
  extracted=S.parseScanResponse(result.text||result.output_text);
 }
 const rows=S.parseExtraction(extracted,page);
 const single=!looksLikeDirectory(page)&&extracted.pageType==='company'&&rows.length===1&&S.domain(rows[0].website)===domain&&S.assessIdentity(rows[0],page).verified;
 const notice=S.scanCoverage(page,rows);
 if(!single){await guard();return {url,rows,notice};}
 const row=rows[0];
 if(known&&!S.assessIdentity({name:known.company_name},page).verified)throw contactError('This domain is saved under '+known.company_name+'. Review the company identity in CRM.');
 await guard();
 const company=known||(await upsertCrmCompany(env.DB,scope,{company_name:row.name,website:actual,domain,source:'website_scan'})).company;
 if(['suppressed','archived'].includes(company.lifecycle_status))throw contactError('Review the company’s CRM status before starting contact research.');
 Object.assign(row,{name:company.company_name,crmId:company.id,website:actual,identityUrl:actual,identityEvidence:page.title,identityStatus:'verified'});
 return {url,rows,fastResearch:true,notice};
}
