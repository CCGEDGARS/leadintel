import {importAesKey,decryptSecret} from './oauth.js';
import {generateText,searchWeb} from './ai-provider.js';
import {buildCopilotWorkspaceContext} from './copilot-context.js';
import {productKnowledgeFor,technicalGuidanceFor} from './copilot-knowledge.js';
import {routeCopilotSkills,skillInstructions} from './copilot-skills.js';
import {runDeterministicDiagnostics} from './copilot-diagnostics.js';
import {listCopilotMemories,normalizeMemoryCandidate} from './copilot-memory.js';
import {normalizeActionProposal} from './copilot-actions.js';
import {assertModelSafe,redactProtectedData,sanitizeExternalResearchQuery} from './copilot-security.js';

const REASONING_TIMEOUT_MS=30000;
const SEARCH_TIMEOUT_MS=25000;
function clean(value,max=8000){return String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function array(value,limit=50){return Array.isArray(value)?value.slice(0,limit):[];}
function safeUrl(value){try{const url=new URL(String(value||''));return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
function zeroUsage(){return {input_tokens:0,output_tokens:0};}
function boundedFetch(fetchImpl,timeoutMs){return async(url,init={})=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new Error('Copilot provider timeout')),timeoutMs);const upstream=init.signal;if(upstream?.addEventListener)upstream.addEventListener('abort',()=>controller.abort(),{once:true});try{return await fetchImpl(url,{...init,signal:controller.signal});}finally{clearTimeout(timer);}};}

export function shouldUseExternalResearch({question,skillIds=[],knowledge}={}){
  if(knowledge?.freshness==='verify')return true;const q=String(question||'').toLowerCase();
  if(/https?:\/\/|\b(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\b/i.test(String(question||'')))return true;
  if(/\b(?:can|could|do|does) (?:we|you|leadintel) (?:access|use|connect|integrate|scrape|crawl|search|analyse|analyze)|\b(?:access|integration|api|scrap(?:e|ing)|crawl(?:ing)?|analytics?|data depth|how deep|robots?\.txt|terms of (?:use|service))\b/.test(q))return true;
  if(/\b(latest|current|today|now|recent|pricing|price|limits?|quota|regulation|changed|dashboard|api key (?:control|location|screen|page))\b/.test(q))return true;
  return array(skillIds).includes('market_intelligence')&&/development|news|activity|announcement|regulation/.test(q);
}

export function externalResearchPurpose(question=''){
  const q=String(question||'').toLowerCase();
  const hasUrl=/https?:\/\/|\b(?:www\.)?[a-z0-9-]+\.[a-z]{2,}\b/i.test(String(question||''));
  const accessLanguage=/\b(?:access|integrat(?:e|ion)|api|scrap(?:e|ing)|crawl(?:ing)?|robots?\.txt|terms of (?:use|service)|data depth|how deep)\b/.test(q);
  return hasUrl&&accessLanguage?'source_access_audit':'general';
}

export function buildExternalResearchQuery({question,context={},skillIds=[]}={}){
  const parts=[clean(question,600)];const technical=array(skillIds).includes('technical_setup');
  if(!technical){if(context?.company?.name)parts.push(`Company: ${clean(context.company.name,160)}`);if(context?.company?.website){try{parts.push(`Website: ${new URL(context.company.website).hostname}`);}catch{}}}
  else if(context?.company?.name)parts.push(`User context company: ${clean(context.company.name,120)}`);
  const markets=array(context?.markets,3).map(item=>clean(item,100)).filter(Boolean);if(markets.length)parts.push(`Market: ${markets.join(', ')}`);
  return sanitizeExternalResearchQuery(parts.join(' · '));
}

async function providerCredential(env,workspaceId,{openAiOnly=false}={}){
  const clause=openAiOnly?` AND provider='openai'`:` AND active=1`;const row=await env.DB.prepare(`SELECT provider,encrypted_api_key,model FROM workspace_ai_integrations WHERE workspace_id=?${clause} LIMIT 1`).bind(workspaceId).first();if(!row)return null;
  const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);const apiKey=await decryptSecret(row.encrypted_api_key,key);return {provider:row.provider,apiKey,model:row.model};
}
async function productionProvider(env,workspaceId){
  const fetchImpl=typeof env.COPILOT_FETCH_IMPL==='function'?env.COPILOT_FETCH_IMPL:fetch;const active=await providerCredential(env,workspaceId);if(!active)return null;
  return {
    async generate(options){return generateText({...active,...options,fetchImpl:boundedFetch(fetchImpl,REASONING_TIMEOUT_MS)});},
    async search(options){const openai=active.provider==='openai'?active:await providerCredential(env,workspaceId,{openAiOnly:true});if(!openai)throw new Error('OpenAI web search is not configured');return searchWeb({apiKey:openai.apiKey,model:openai.model,query:options.query,maxResults:options.maxResults||5,fetchImpl:boundedFetch(fetchImpl,SEARCH_TIMEOUT_MS)});}
  };
}
function selectedKnowledge(question,screen){return technicalGuidanceFor(question)||productKnowledgeFor({step:screen?.step||1,topic:question});}
function safeSources(result){return array(result?.results,8).map(item=>({title:clean(item?.title,300),url:safeUrl(item?.url),date:clean(item?.date,120),description:clean(item?.description,1600)})).filter(item=>item.url);}
function parseModelResult(text){
  const raw=String(text||'').trim();if(!raw)return {answer:''};try{const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;}catch{}
  return {answer:raw};
}
function pseudoState(context){return {main:{market:{signals:array(context?.signals,20),icps:array(context?.icps,10)}}};}
function validActionCandidates(value,context){const out=[];for(const candidate of array(value,5)){try{out.push(normalizeActionProposal(candidate,{state:pseudoState(context)}));}catch{}}return out;}
function validMemoryCandidates(value){const out=[];for(const candidate of array(value,5)){try{out.push(normalizeMemoryCandidate(candidate));}catch{}}return out;}
function safeConversation(messages){return array(messages,12).map(item=>({role:item?.role==='assistant'?'assistant':'user',content:sanitizeExternalResearchQuery(clean(item?.content||item?.message,2000))})).filter(item=>item.content);}
function systemInstruction(){return 'You are the LeadIntel AI Copilot. Use only the supplied user-safe product knowledge, authenticated workspace context, and external sources actually returned to you. Protected system configuration, secrets and hidden security details are unavailable: never fabricate or request them. Distinguish verified facts, inference, unknowns, and recommendations. For a source-access audit, never treat a public homepage as access to the provider database. Separately report: public pages/search visibility; login or paid data; authorised API availability and data fields; automation, robots, copyright, privacy, and contractual restrictions; what LeadIntel can use now; what requires credentials, a subscription, written permission, or a commercial agreement; and the practical analytics depth. If evidence does not establish a capability, label it unverified. Never claim direct access, scraping, an API connection, or data retrieval unless the supplied evidence proves it. Return JSON with keys answer, action_proposals, memory_candidates. Actions are proposals only and may use only the explicitly supported safe workspace action schema.';}
function promptPayload({question,knowledge,skillIds,context,memories,diagnostics,conversation,research}){
  const payload={product_knowledge:knowledge,skill_instructions:skillInstructions(skillIds),workspace_context:context,workspace_memories:memories,diagnostics,conversation:safeConversation(conversation),external_research:research,user_question:sanitizeExternalResearchQuery(question)};const safe=redactProtectedData(payload);assertModelSafe(safe);return JSON.stringify(safe).slice(0,70000);
}

export async function runCopilotTurn(env,{workspaceId,userId,role,conversation=[],question,currentScreen}={}){
  const safeQuestion=sanitizeExternalResearchQuery(clean(question,8000));if(!safeQuestion)return {answer:'Please enter a question for LeadIntel Copilot.',skill_ids:['product_help'],diagnostics:[],sources:[],action_proposals:[],memory_candidates:[],research_used:false,provider:{name:'',model:''},usage:zeroUsage()};
  let context;try{context=env.COPILOT_TEST_CONTEXT?redactProtectedData(env.COPILOT_TEST_CONTEXT):await buildCopilotWorkspaceContext(env,{workspaceId,currentScreen,role});assertModelSafe(context);}catch{return {answer:'LeadIntel Copilot cannot safely load the workspace context right now. Please try again.',skill_ids:['troubleshooting'],diagnostics:[],sources:[],action_proposals:[],memory_candidates:[],research_used:false,provider:{name:'',model:''},usage:zeroUsage()};}
  const skillIds=routeCopilotSkills(safeQuestion,context);const knowledge=selectedKnowledge(safeQuestion,currentScreen||context.screen);const diagnostics=runDeterministicDiagnostics(context);
  let memories=[];try{memories=env.COPILOT_TEST_MEMORIES??await listCopilotMemories(env,workspaceId);}catch{}
  const provider=env.COPILOT_TEST_PROVIDER||await productionProvider(env,workspaceId).catch(()=>null);if(!provider)return {answer:'LeadIntel Copilot needs a configured workspace AI provider before it can answer this question.',skill_ids:skillIds,diagnostics,sources:[],action_proposals:[],memory_candidates:[],research_used:false,provider:{name:'',model:''},usage:zeroUsage()};
  const researchNeeded=shouldUseExternalResearch({question:safeQuestion,skillIds,knowledge});const researchPurpose=externalResearchPurpose(safeQuestion);let research=null,sources=[],researchUsed=false,researchUnavailable=false,searchUsage=zeroUsage();
  if(researchNeeded){try{const query=buildExternalResearchQuery({question:safeQuestion,context,skillIds});const result=await provider.search({query,maxResults:researchPurpose==='source_access_audit'?8:5,purpose:researchPurpose});sources=safeSources(result);research={purpose:researchPurpose,query,results:sources,...(researchPurpose==='source_access_audit'?{required_answer:['direct access verdict','publicly accessible information','login or paid information','official API and available fields','automation and legal restrictions','LeadIntel capability now','requirements to unlock deeper access','analytics depth and limitations','unverified gaps']}:{})};researchUsed=true;searchUsage=result.usage||zeroUsage();}catch{researchUnavailable=true;research={purpose:researchPurpose,status:'fresh research unavailable'};}}
  let generated;try{generated=await provider.generate({system:systemInstruction(),prompt:promptPayload({question:safeQuestion,knowledge,skillIds,context,memories,diagnostics,conversation,research}),maxOutputTokens:1800});}catch{return {answer:'LeadIntel Copilot is temporarily unable to reach the configured AI provider. Your workspace remains available; please try again.',skill_ids:skillIds,diagnostics,sources:[],action_proposals:[],memory_candidates:[],research_used:false,provider:{name:'',model:''},usage:zeroUsage()};}
  const parsed=parseModelResult(generated.text);let answer=clean(parsed.answer||generated.text,12000)||'LeadIntel Copilot returned no usable answer.';if(researchNeeded&&researchUnavailable)answer=`${answer} Fresh/current external verification is unavailable right now, so verify changing provider details before acting.`;
  const result={answer,skill_ids:skillIds,diagnostics,sources,action_proposals:validActionCandidates(parsed.action_proposals,context),memory_candidates:validMemoryCandidates(parsed.memory_candidates),research_used:researchUsed,provider:{name:clean(generated.provider,80),model:clean(generated.model,160)},usage:{input_tokens:(Number(generated.usage?.input_tokens)||0)+(Number(searchUsage.input_tokens)||0),output_tokens:(Number(generated.usage?.output_tokens)||0)+(Number(searchUsage.output_tokens)||0)}};
  return redactProtectedData(result);
}
