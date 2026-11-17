import {getCustomerState} from './customer-state.js';
import {copilotResearchUrls,operationalChangeRequest} from './copilot-mentor.js';
import {sanitizeExternalResearchQuery} from './copilot-security.js';

const clean=(value,max=180)=>sanitizeExternalResearchQuery(String(value??'')).slice(0,max);
export function researchDeclined(question=''){
 return /\b(?:do not|don't|without|no)\s+(?:web\s+)?(?:search|brows\w*|research)\b|nemekl[eē]|nepārlūko/i.test(question)||operationalChangeRequest(question);
}
export function referenceResearchRequested(question='',conversation=[]){
 if(researchDeclined(question))return false;
 // A new explicit target must never inherit another company's saved scope.
 if(/https?:\/\/|\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(question))return false;
 if(/\breference\s+(?:compan(?:y|ies)|customers?|clients?|models?|list)|\b(?:saved|added|active|my|our|these)\s+references\b/i.test(question)&&/\bsuggest|\brecommend|\banaly[sz]|\bresearch|\bfind|\bcheck|\binvestig|\bcompare|\bsignals?\b|\btriggers?\b|\bwebsites?\b|\bsources?\b|\bevidence\b|\bbuying\b/i.test(question))return true;
 const last=[...conversation].reverse().find(m=>m.role==='assistant'&&(m.metadata?.research_target||m.metadata?.research_scope));
 return last?.metadata.research_scope?.mode==='references'&&/\b(?:their|them|these|same|continue|those)\b/i.test(question);
}
export function publicReferenceUrl(value=''){
 const raw=String(value||'').trim();if(!raw||/\s/.test(raw))return '';
 const url=/^https?:\/\//i.test(raw)?raw:'https://'+raw;
 return copilotResearchUrls(url)[0]||'';
}
export function savedReferenceScope(main={},version=0){
 const reference=main.referenceCustomers||{},rows=Array.isArray(reference.rows)?reference.rows:[];
 const targets=[],seen=new Set();
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row))continue;
  const url=publicReferenceUrl(row.website||row.domain),name=clean(row.companyName||row.company||row.name||row.domain);
  if(!name&&!url)continue;const key=url?new URL(url).hostname.replace(/^www\./,''):name.toLowerCase();
  if(seen.has(key))continue;seen.add(key);
  if(targets.length<10)targets.push({name:name||key,url,country:clean(row.country,80)});
 }
 return {mode:'references',stateVersion:Number(version)||0,listId:clean(main.referenceCustomerPortfolio?.selectedListId,120),targets,total:seen.size,omitted:Math.max(0,seen.size-targets.length),markets:(Array.isArray(main.targetMarkets)?main.targetMarkets:[]).slice(0,10).map(v=>clean(v,80)),coverage:'Saved selected reference list at request time. Reference location and target-market eligibility are separate; a domain suffix does not prove operating geography.'};
}
export async function resolveReferenceResearchScope(env,workspaceId,question,conversation=[]){
 if(!referenceResearchRequested(question,conversation))return null;
 const prior=[...conversation].reverse().find(m=>m.role==='assistant'&&m.metadata?.research_scope?.mode==='references');
 if(prior&&!/\breference|\breferences\b/i.test(question))return prior.metadata.research_scope;
 const state=await getCustomerState(env,workspaceId);
 return savedReferenceScope(state.payload?.main||{},state.version);
}
