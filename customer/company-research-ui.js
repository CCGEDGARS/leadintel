import './commercial-profile-adviser.js?v=20261101-v1';
import './message-evidence.js?v=20261010-evidence-v3&messages-reliability=20261031-v1';
import './first-party-research.js?v=20260930-research-pipeline-v1&message-evidence=20261010-v1';
import './company-research-engine.js?v=20260918-translation-fidelity-v3&message-evidence=20261010-v1&profile-audit=20261030-v1&profile-adviser=20261101-v2';

const MAIN_STORAGE_KEY='leadintel_customer_v2_state';
const RESEARCH_META_KEY='leadintel_customer_v2_research_meta_v1';
const FIRECRAWL_PROXY='https://apollo-proxy.edgars-7e7.workers.dev';
const LEADINTEL_API='https://leadintel-api.edgars-7e7.workers.dev';
const MAX_COMPANY_RESEARCH_QUERIES=3;
const MAX_RESULTS_PER_QUERY=4;
const COMPANY_RESEARCH_REQUEST_TIMEOUT_MS=25000;
const COMPANY_RESEARCH_RUN_TIMEOUT_MS=60000;
const COMPANY_RESEARCH_SAVE_TIMEOUT_MS=10000;
const RELEASE='20261018-research-lifecycle-v1';
let activeProgress=null;
let running=false;
let profileAdvice=null,profileAdviceUndo=null,profileAdviceBusy=false;

const engine=()=>window.LeadIntelCompanyResearch;
const $=id=>document.getElementById(id);
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function readJson(key,fallback={}){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:fallback;}catch{return fallback;}}
function readState(){return readJson(MAIN_STORAGE_KEY,{});}
function writeState(value){localStorage.setItem(MAIN_STORAGE_KEY,JSON.stringify(value));}
function readMeta(){return readJson(RESEARCH_META_KEY,{});}
function writeMeta(value){localStorage.setItem(RESEARCH_META_KEY,JSON.stringify(value));}
// Async provider responses must belong to the same account and input evidence.
// Unrelated live settings may still change; commits merge into the latest state.
function captureResearchContext(state){return {
  account:localStorage.getItem('leadintel_account_context_v1'),
  workspaceId:window.LeadIntelServerBridge?.workspace?.id||'',
  inputs:researchInputs(state)
};}
function researchInputs(state){return JSON.stringify([state.website,state.targetMarkets||[],state.additionalLinks||[],state.documents||[],state.scrapedSources||[],state.answers||{},state.profile||null,Boolean(state.approved)]);}
function researchContextCurrent(context,state=readState()){
  return (!window.LeadIntelAccountCache||window.LeadIntelAccountCache.current())&&
    context.account===localStorage.getItem('leadintel_account_context_v1')&&
    context.workspaceId===(window.LeadIntelServerBridge?.workspace?.id||'')&&
    context.inputs===researchInputs(state);
}
function assertResearchContext(context,state){if(!researchContextCurrent(context,state)){const keys=['website','target markets','additional links','documents','source evidence','answers','profile','profile approval'];const before=JSON.parse(context.inputs),after=JSON.parse(researchInputs(state));const changed=keys.filter((_,index)=>JSON.stringify(before[index])!==JSON.stringify(after[index]));throw new Error(`Workspace changed during research${changed.length?': '+changed.join(', '):' (account or workspace identity)'}. Your edits were preserved; rerun when ready.`);}}

function normalizeUrl(value){return engine()?.safeUrl(value)||'';}
function selectedMarkets(state){return Array.isArray(state?.targetMarkets)?state.targetMarkets.map(value=>String(value||'').trim()).filter(Boolean):[];}
function companyResearchReady(state=readState()){return Boolean(normalizeUrl(state.website)&&selectedMarkets(state).length);}
function injectCss(){if(document.querySelector('link[data-leadintel-asset="company-research-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=`company-research.css?v=${RELEASE}`;link.dataset.leadintelAsset='company-research-css';document.head.appendChild(link);}
function toast(message){const node=$('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),3000);}

function ensureResearchUi(){
  injectCss();
  const button=$('to-questionnaire');if(button){button.innerHTML='Continue to Profile <span>→</span>';}
  const step1=document.getElementById('step-1');
  if(step1&&!document.getElementById('company-research-progress')){
    const actions=step1.querySelector('.step-actions');
    actions?.insertAdjacentHTML('beforebegin','<div class="company-research-progress" id="company-research-progress" hidden><div class="company-research-spinner" aria-hidden="true"></div><div><strong id="company-research-title">Preparing company research…</strong><small id="company-research-detail">LeadIntel will use public evidence and your selected market.</small></div></div>');
  }
  const step2=document.getElementById('step-2');const hero=step2?.querySelector('.hero-copy');
  if(hero){
    const heading=hero.querySelector('h1');const paragraph=hero.querySelector('p');
    if(heading)heading.textContent='Build your Commercial Intelligence Brief.';
    if(paragraph)paragraph.textContent='Review the commercial decisions that power LeadIntel targeting, buying signals and campaign content. Accept, edit or replace every draft; unsupported fields remain open for your input.';
    if(!document.getElementById('research-summary'))hero.insertAdjacentHTML('afterend','<div class="research-summary" id="research-summary"><div class="research-summary-main"><div class="research-summary-icon">✦</div><div><strong>Research has not run yet.</strong><small>Add the website and target market in Setup, then run company research.</small></div></div><div class="research-summary-actions"><span class="research-mode">Evidence first</span><button class="research-rerun research-primary" id="rerun-company-research" type="button">Start company research <span aria-hidden="true">→</span></button></div></div>');
  }
  document.querySelectorAll('[data-question]').forEach(textarea=>{
    const card=textarea.closest('.question-card');if(!card||card.querySelector('.research-field-meta'))return;
    card.insertAdjacentHTML('beforeend',`<div class="research-field-meta" data-research-meta="${esc(textarea.dataset.question)}"></div>`);
    textarea.addEventListener('input',()=>markUserInput(textarea.dataset.question,textarea.value));
  });
  renderResearchReview();
}

function setProgress(title,detail,{done=false}={}){
  activeProgress=done?null:{title,detail};
  renderResearchReview();
  const box=$('company-research-progress');if(!box)return;box.hidden=false;box.classList.toggle('done',done);
  if($('company-research-title'))$('company-research-title').textContent=title;
  if($('company-research-detail'))$('company-research-detail').textContent=detail;
}
function setResearchButtonBusy(busy){const button=$('rerun-company-research');if(!button)return;button.disabled=busy;button.textContent=busy?'Researching company…':'Rerun company research';}
function sourceMap(state){
  const map=new Map();(state.scrapedSources||[]).forEach((source,index)=>{const id=source.id||`S${index+1}`;map.set(id,{...source,id});});
  engine().normalizeDocumentIds(state.documents).filter(doc=>String(doc?.text||'').trim()).forEach(doc=>map.set(doc.id,{id:doc.id,type:'document',title:doc.name||`Document ${doc.id}`,text:doc.text}));
  return map;
}
function metaForCurrentState(){const state=readState(),meta=readMeta();if(!meta?.website||normalizeUrl(meta.website)!==normalizeUrl(state.website))return {};return meta;}
function modeLabel(meta){if(meta.mode==='ai')return `${meta.provider||'AI'}${meta.model?` · ${meta.model}`:''}`;return 'Evidence draft';}
function repairResearchHandoff(state,meta){
  if(!meta.generatedAt)return false;
  const recovered=engine()?.recoverDraftAnswers?.(state.answers||{},meta.fields||{});if(!recovered)return false;
  const changed=engine().QUESTION_IDS.some(id=>String(recovered[id]||'').trim()!==String(state.answers?.[id]||'').trim());
  if(!changed)return false;
  state.answers=recovered;writeState(state);
  window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website:state.website,recovered:true}}));
  return true;
}
// Legacy saved failures contain only a reason; classify conservatively for recovery UI.
function synthesisRecovery(reason=''){
  const text=String(reason);
  if(/timed? out|timeout|stopped after \d+ seconds/i.test(text))return {title:'Research saved. AI profile preparation timed out.',settings:false};
  if(/no active AI provider|not configured|invalid.*(?:key|credential)|(?:key|credential).*invalid|unauthori[sz]ed|authentication|credit_balance_exhausted|insufficient_quota|credit balance|billing/i.test(text))return {title:'Research saved. AI connection needs attention.',settings:true};
  if(/sign in|signed out/i.test(text))return {title:'Research saved. Sign in to prepare your AI profile.',settings:false};
  return {title:'Research saved. AI profile preparation did not complete.',settings:false};
}
function researchReviewDetails(state,meta,map){
  const areaLabels={company:'Company identity',offers:'Products & services',proof:'Projects & references',delivery:'Delivery',contact:'Contact information'};
  const coverage=meta.quality?.coverage||{};
  const missing=Array.isArray(coverage.missing)?coverage.missing:Object.keys(areaLabels).filter(id=>Array.isArray(coverage.categories)&&!coverage.categories.includes(id));
  const gaps=missing.filter(id=>areaLabels[id]).map(id=>areaLabels[id]);
  const gapNote=gaps.length?`<small class="research-coverage partial">Missing source areas: ${esc(gaps.join(' · '))}. These describe source coverage, not completed profile answers.</small>`:'';
  const fields=Array.from(document.querySelectorAll('[data-question]')).filter(field=>!String(state.answers?.[field.dataset.question]||field.value||'').trim());
  const fieldLinks=fields.length?`<div class="research-missing-fields"><small>Complete these profile fields:</small>${fields.map(field=>`<button type="button" class="research-field-link" data-research-focus="${esc(field.dataset.question)}">${esc(field.closest('.question-card')?.querySelector('h3')?.textContent||field.dataset.question.replaceAll('_',' '))}</button>`).join('')}</div>`:'';
  const sources=[...map.values()];
  const evidence=`<details class="research-saved-evidence"><summary>Review saved sources (${sources.length})</summary><ul>${sources.map(source=>{
    const url=normalizeUrl(source.url);const label=esc(source.title||source.url||'Uploaded document');
    return `<li>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`:`<span>${label}</span>`}${source.type==='document'?'<small>Uploaded document</small>':`<small>${esc(source.role==='primary'?'Company source':'Supporting source')}${source.pageCategory&&areaLabels[source.pageCategory]?` · ${esc(areaLabels[source.pageCategory])}`:''}</small>`}${source.text?`<p class="research-saved-extract">${esc(String(source.text).slice(0,400))}${String(source.text).length>400?'…':''}</p>`:''}</li>`;
  }).join('')||'<li>No readable saved sources. Collect sources again to refresh the evidence.</li>'}</ul></details>`;
  const saveNote=meta.persistence==='local-only'?'<small class="research-coverage partial">Research is saved in this browser. Workspace sync did not complete; resolve the save issue before continuing on another device.</small>':'';
  const failureNote=meta.lastFailure?`<small class="research-coverage partial">Last refresh did not complete: ${esc(meta.lastFailure)} Previous evidence and profile answers were retained.</small>`:'';
  const execution=meta.lastFailure?meta.lastExecution:meta.execution;const receipts=Array.isArray(execution?.receipts)?execution.receipts.slice(0,40):[];
  const executions=receipts.length?`<details class="research-execution-receipts"><summary>Research execution (${receipts.length} requests · ${esc(execution.status)})</summary><ul>${receipts.map(row=>`<li>${esc(row.operation)} · ${esc(row.provider||'Provider not identified')} · ${esc(row.status)} · ${Number(row.resultCount)||0} results${row.query?`<small>${esc(String(row.query).slice(0,500))}</small>`:''}${Array.isArray(row.trace)?row.trace.map(attempt=>`<small>${esc(attempt.provider)} ${esc(attempt.operation)}: ${esc(attempt.status)}</small>`).join(''):''}</li>`).join('')}</ul><small>These are executed request outcomes. Configuration alone does not prove a provider ran.</small></details>`:'';
  return saveNote+failureNote+gapNote+fieldLinks+evidence+executions;
}
function renderResearchReview(){
  const state=readState();const meta=metaForCurrentState();if(!running)repairResearchHandoff(state,meta);const map=sourceMap(state);const summary=$('research-summary');
  if(summary){
    if(summary.dataset)summary.dataset.researchState=running?'running':meta.generatedAt?'complete':meta.failureAt?'failed':'ready';
    summary.classList.remove('research-summary-failed');
    if(running){
      summary.innerHTML=`<div class="research-summary-main"><div class="company-research-spinner" aria-hidden="true"></div><div><strong>${esc(activeProgress?.title||'Researching company…')}</strong><small>${esc(activeProgress?.detail||'Preparing your company evidence.')}</small></div></div><div class="research-summary-actions"><span class="research-mode">In progress</span><button class="research-rerun research-primary" id="rerun-company-research" type="button" disabled>Researching company…</button></div>`;
    }else if(meta.generatedAt){
      const aiAdvice=Object.values(meta.fields||{}).some(row=>row.draftMode==='ai-advised'&&row.synthesisReceipt?.status==='succeeded');
      const aiAvailable=meta.mode==='ai'||aiAdvice;
      const recovery=synthesisRecovery(meta.reason);
      const coverage=meta.quality?.coverage||{};const covered=Array.isArray(coverage.categories)?coverage.categories.length:0;const total=Number(coverage.total)||5;
      const coverageNote=`Source coverage: ${covered} of ${total} areas. Review the evidence and profile answers before approval.`;
      const followup=aiAvailable?'':`<small>Your ${Number(meta.sourceCount)||0} sources are saved. Retry using saved evidence without collecting sources again, or complete the profile yourself.</small><div class="research-summary-followup"><button class="research-rerun research-primary" id="synthesize-company-research" type="button">Retry AI profile preparation</button>${recovery.settings?'<button class="research-rerun" id="open-ai-settings-from-research" type="button">Open AI settings</button>':''}</div>`;
      summary.innerHTML=`<div class="research-summary-main"><div class="research-summary-icon" aria-hidden="true">✦</div><div><strong>${aiAdvice?'Analytical profile drafts ready for review':aiAvailable?'Research and AI profile preparation complete':recovery.title}</strong>${aiAvailable?`<small>${esc(aiAdvice?'AI-assisted commercial recommendations':modeLabel(meta))} · ${Number(meta.sourceCount)||0} sources saved</small>`:''}<small class="research-coverage ${covered===total?'complete':'partial'}">${esc(coverageNote)}</small>${followup}${researchReviewDetails(state,meta,map)}<details class="research-more-options"><summary>More research options</summary>${!aiAvailable?`<small>Last AI result: ${esc(meta.reason||'No evidence-backed profile fields were returned.')}</small>`:''}${meta.failures?`<small>${Number(meta.failures)} source/search requests were unavailable.</small>`:''}<small>Refresh collects sources again. Use this when your website or company information has changed.</small><button class="research-rerun" id="rerun-company-research" type="button">Refresh company research</button></details></div></div><div class="research-summary-actions"><span class="research-mode">${state.approved?'Profile approved':'Profile needs review'}</span></div>`;
    } else if(meta.failureAt){
      summary.classList.add('research-summary-failed');
      summary.innerHTML='<div class="research-summary-main"><div class="research-summary-icon">!</div><div><strong>Research could not complete.</strong><small>'+esc(meta.error||'The company research request did not finish.')+'</small><small class="research-retry-note">Your website and target market were preserved. Try again when ready.</small></div></div><div class="research-summary-actions"><span class="research-mode">Retry available</span><button class="research-rerun research-primary" id="rerun-company-research" type="button">Try research again <span aria-hidden="true">→</span></button></div>';
    } else {
      const hasWebsite=Boolean(normalizeUrl(state.website));const hasMarkets=selectedMarkets(state).length>0;const ready=hasWebsite&&hasMarkets;
      let title='Setup complete — ready for company research',detail='LeadIntel will analyse your website and selected market. Usually takes up to 1 minute.',badge='Ready to research',label='Start company research <span aria-hidden="true">→</span>';
      if(!hasWebsite){title='Add your company website';detail=hasMarkets?'Your target market is saved. Add and activate your website to prepare company research.':'Add and activate your website, then select at least one target market.';badge='Website required';label='Add website';}
      else if(!hasMarkets){title='Select a target market';detail='Your website is saved. Select at least one country, region or market to prepare company research.';badge='Market required';label='Select market';}
      const step1Action=ready?'':' data-go-step1="true"';const primaryClass=ready?' research-primary':'';
      summary.innerHTML='<div class="research-summary-main"><div class="research-summary-icon">✦</div><div><strong>'+title+'</strong><small>'+detail+'</small></div></div><div class="research-summary-actions"><span class="research-mode">'+badge+'</span><button class="research-rerun'+primaryClass+'" id="rerun-company-research" type="button"'+step1Action+'>'+label+'</button></div>';
    }
    summary.querySelectorAll?.('[data-research-focus]').forEach(button=>button.addEventListener('click',()=>{
      const field=Array.from(document.querySelectorAll('[data-question]')).find(node=>node.dataset.question===button.dataset.researchFocus);
      field?.scrollIntoView?.({behavior:'smooth',block:'center'});field?.focus();
    }));
    if(meta.generatedAt&&window.LeadIntelCommercialProfileAdviser){
      const review=document.createElement('button');review.type='button';review.className='research-rerun research-primary';review.id='review-profile-advice';review.textContent='Review all 12 answers';review.disabled=running;review.addEventListener('click',reviewProfileAdvice);summary.appendChild(review);
    }
    const synthesis=summary.querySelector('#synthesize-company-research');
    synthesis?.addEventListener('click',()=>runAiSynthesis());
    const openSettings=summary.querySelector('#open-ai-settings-from-research');
    openSettings?.addEventListener('click',()=>document.getElementById('open-settings')?.click());
    const action=summary.querySelector('#rerun-company-research');
    action?.addEventListener('click',()=>{
      if(action.dataset.goStep1==='true'){document.getElementById('back-to-sources')?.click();return;}
      void runCompanyResearch({rerun:Boolean(meta.generatedAt||meta.failureAt)});
    });
  }
  document.querySelectorAll('[data-question]').forEach(textarea=>{
    const id=textarea.dataset.question;const target=document.querySelector(`[data-research-meta="${id}"]`);if(!target)return;
    const persisted=String(state.answers?.[id]||'').trim();
    if(!String(textarea.value||'').trim()&&persisted&&document.activeElement!==textarea)textarea.value=persisted;
    const value=String(textarea.value||'').trim();const row=engine()?.reconcileResearchField?.(value,meta.fields?.[id]||{})||meta.fields?.[id]||{};
    const draftOrigins=['research','evidence_draft','hypothesis_draft'];const isDraft=draftOrigins.includes(row.origin);
    const card=textarea.closest('.question-card');card?.classList.toggle('research-populated',Boolean(value&&isDraft));
    let origin='Needs your input',originClass='needs';
    if(value&&row.origin==='hypothesis_draft'){origin='Commercial recommendation';originClass='hypothesis';}
    else if(value&&isDraft){origin='Evidence-backed draft';originClass='';}
    else if(value){origin='Your input';originClass='user';}
    const confidence=value&&row.confidence?`<span class="research-confidence ${esc(row.confidence)}">${esc(row.confidence)} confidence</span>`:'';
    const reviewed=row.reviewed&&!isDraft?'<span class="research-reviewed">Saved ✓</span>':'';
    const sourceIds=Array.isArray(row.sourceIds)?row.sourceIds:[];const sources=sourceIds.map(id=>map.get(id)).filter(Boolean).slice(0,3);
    const links=sources.length?`<div class="research-source-links">${sources.map(source=>source.type==='document'||!normalizeUrl(source.url)?`<span class="research-source-doc">${esc(source.title)}</span>`:`<a href="${esc(normalizeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${esc(source.title||source.url)}</a>`).join('')}</div>`:'';
    const rationale=row.rationale?`<div class="research-rationale">${esc(row.rationale)}</div>`:'';
    const reviewAction=engine()?.reviewActionState?.(row)||{visible:isDraft,label:row.reviewed?'Accepted ✓':'Accept',disabled:Boolean(row.reviewed)};
    const acceptAction=reviewAction.visible?`<button type="button" data-research-accept="${esc(id)}" ${reviewAction.disabled?'disabled':''}>${esc(reviewAction.label)}</button>`:'';
    const actions=value?`<div class="research-field-actions">${acceptAction}<button type="button" data-research-clear="${esc(id)}">Clear</button></div>`:'';
    target.innerHTML=`<div class="research-meta-top"><span class="research-origin ${originClass}">${origin}</span>${confidence}${reviewed}</div>${rationale}${links}${actions}`;
  });
}
function markUserInput(id,value){
  const state=readState();const meta=metaForCurrentState();if(!meta.generatedAt)return;
  meta.fields=meta.fields||{};meta.fields[id]={origin:String(value||'').trim()?'user':'needs-input',confidence:'',sourceIds:[],rationale:String(value||'').trim()?'Customer edited this field.':'Customer input recommended.',reviewed:Boolean(String(value||'').trim())};writeMeta(meta);renderResearchReview();
}
// Accepting a research draft must also mark the answer as accepted in the main workspace state:
// approval (step2-brief-schema confirmationMissing) and page checks (page-quality-ui) read answerStatus,
// not research metadata. Without this the Profile can never be approved after accepting drafts.
function acceptAnswerStatus(id){
  const state=readState();if(!state||typeof state!=='object')return;
  if(!String(state.answers?.[id]??'').trim())return;
  const current=state.answerStatus?.[id];if(current==='user'||current==='accepted')return;
  state.answerStatus={...(state.answerStatus||{}),[id]:'accepted'};writeState(state);
  window.dispatchEvent?.(new CustomEvent('leadintel:company-research-updated',{detail:{website:state.website,acceptedAnswer:id}}));
}
function handleReviewAction(event){
  const accept=event.target.closest('[data-research-accept]');const clear=event.target.closest('[data-research-clear]');if(!accept&&!clear)return;
  const id=(accept||clear).dataset.researchAccept||(accept||clear).dataset.researchClear;const textarea=document.querySelector(`[data-question="${id}"]`);const meta=metaForCurrentState();meta.fields=meta.fields||{};
  if(accept){meta.fields[id]={...(meta.fields[id]||{}),reviewed:true};writeMeta(meta);acceptAnswerStatus(id);renderResearchReview();return;}
  if(clear&&textarea){textarea.value='';textarea.dispatchEvent(new Event('input',{bubbles:true}));meta.fields[id]={origin:'needs-input',confidence:'',sourceIds:[],rationale:'Cleared by customer; add input or rerun research.',reviewed:true};writeMeta(meta);renderResearchReview();}
}

function requestSignal(parentSignal,timeoutMs=COMPANY_RESEARCH_REQUEST_TIMEOUT_MS){
  const controller=new AbortController();
  const abort=()=>controller.abort();
  const timer=setTimeout(abort,Math.max(1,Number(timeoutMs)||COMPANY_RESEARCH_REQUEST_TIMEOUT_MS));
  if(parentSignal){if(parentSignal.aborted)controller.abort();else parentSignal.addEventListener('abort',abort,{once:true});}
  return {signal:controller.signal,dispose(){clearTimeout(timer);parentSignal?.removeEventListener('abort',abort);}};
}
function requestError(error,label){return error?.name==='AbortError'?new Error(label+' timed out'):error;}
function executionTrace(payload){
  return (Array.isArray(payload?.researchTrace)?payload.researchTrace:[]).slice(0,8).filter(row=>['firecrawl','direct','scrapling'].includes(row?.provider)&&['search','extract'].includes(row?.operation)&&['succeeded','failed'].includes(row?.status)).map(row=>({provider:row.provider,operation:row.operation,status:row.status,results:Math.max(0,Math.min(100,Number(row.results)||0)),...(Number.isInteger(row.httpStatus)&&row.httpStatus>=100&&row.httpStatus<=599?{httpStatus:row.httpStatus}:{})}));
}
function executionProvider(payload,data){
  const trace=Array.isArray(payload?.researchTrace)?payload.researchTrace:[];
  const provider=trace.filter(row=>row?.status==='succeeded').at(-1)?.provider||data?.metadata?.source||'';
  return ['firecrawl','direct','direct-fallback','direct-pdf','scrapling'].includes(provider)?provider:'firecrawl-route';
}
async function scrapeSource(url,type,pageCategory='',parentSignal=null){
  const request=requestSignal(parentSignal),operation=window.LeadIntelReliabilityTrace?.begin('profile_research');operation?.checkpoint('request','pending');
  try{
    const response=await settleBeforeAbort(fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:'POST',headers:{'Content-Type':'application/json',...(operation?.id?{'X-LeadIntel-Operation-Id':operation.id}:{})},body:JSON.stringify({url,formats:['markdown','links'],onlyMainContent:true,timeout:30000}),signal:request.signal}),request.signal);
    const payload=await settleBeforeAbort(response.json().catch(()=>({})),request.signal);if(!response.ok)throw new Error(payload.error||`Source returned ${response.status}`);
    const data=payload.data||payload;const text=String(data.markdown||data.content||'').slice(0,30000);if(!text.trim())throw new Error('No readable page content returned');
    const resolvedUrl=normalizeUrl(data.metadata?.url||data.metadata?.sourceURL||data.url||url);
    if(!resolvedUrl||new URL(resolvedUrl).hostname.replace(/^www\./,'')!==new URL(url).hostname.replace(/^www\./,''))throw new Error('Source redirected outside the requested domain; identity review required.');
    const operationId=response.headers?.get?.('X-LeadIntel-Operation-Id')||operation?.id||'';operation?.checkpoint('response','pass');operation?.finish('pass');
    return {type,url:resolvedUrl,requestedUrl:url,operationId:/^[A-Za-z0-9._:-]{8,80}$/.test(operationId)?operationId:'',executionProvider:executionProvider(payload,data),executionTrace:executionTrace(payload),title:data.metadata?.title||data.title||new URL(url).hostname,text,links:data.links||[],status:'ready',pageCategory};
  }catch(error){operation?.finish(request.signal.aborted?'canceled':'fail');throw requestError(error,'Company source request');}
  finally{request.dispose();}
}
async function searchPublic(queryMeta,parentSignal=null){
  const request=requestSignal(parentSignal),operation=window.LeadIntelReliabilityTrace?.begin('profile_research');operation?.checkpoint('request','pending');
  try{
    const response=await settleBeforeAbort(fetch(`${FIRECRAWL_PROXY}/firecrawl-search`,{method:'POST',headers:{'Content-Type':'application/json',...(operation?.id?{'X-LeadIntel-Operation-Id':operation.id}:{})},body:JSON.stringify({query:queryMeta.query,limit:MAX_RESULTS_PER_QUERY,scrapeOptions:{formats:['markdown']}}),signal:request.signal}),request.signal);
    const payload=await settleBeforeAbort(response.json().catch(()=>({})),request.signal);if(!response.ok)throw new Error(payload.error||`Search returned ${response.status}`);const rows=engine().normalizeSearchResults(payload,queryMeta);rows.executionProvider=executionProvider(payload,payload.data);rows.executionTrace=executionTrace(payload);const operationId=response.headers?.get?.('X-LeadIntel-Operation-Id')||operation?.id||'';rows.operationId=/^[A-Za-z0-9._:-]{8,80}$/.test(operationId)?operationId:'';operation?.checkpoint('response','pass');operation?.finish('pass');return rows;
  }catch(error){operation?.finish(request.signal.aborted?'canceled':'fail');throw requestError(error,'Company search request');}
  finally{request.dispose();}
}
async function saveWorkspaceBestEffort(){
  const save=window.LeadIntelServerBridge?.saveNow;
  if(typeof save!=='function')return {saved:false};
  let timer;
  try{return await Promise.race([Promise.resolve().then(()=>save.call(window.LeadIntelServerBridge)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Workspace save timed out')),COMPANY_RESEARCH_SAVE_TIMEOUT_MS);})]);}
  catch{return {saved:false};}
  finally{clearTimeout(timer);}
}
async function waitForServerBridge(timeout=1800){
  if(window.LeadIntelServerBridge&&window.LeadIntelServerBridge.session!==null)return window.LeadIntelServerBridge;
  return new Promise(resolve=>{let settled=false;const finish=()=>{if(settled)return;settled=true;window.removeEventListener('leadintel:server-ready',finish);resolve(window.LeadIntelServerBridge||null);};window.addEventListener('leadintel:server-ready',finish,{once:true});setTimeout(finish,timeout);});
}
function settleBeforeAbort(operation,signal){
  if(!signal)return operation;
  return new Promise((resolve,reject)=>{
    const abort=()=>{const error=new Error('Request timed out');error.name='AbortError';reject(error);};
    Promise.resolve(operation).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
    if(signal.aborted){abort();return;}
    signal.addEventListener('abort',abort,{once:true});
  });
}
async function aiDraftFor({website,targetMarkets,sources,documents,uiLanguage,answers={}},parentSignal=null){
  const context=captureResearchContext(readState());
  const bridge=await waitForServerBridge();assertResearchContext(context,readState());if(parentSignal?.aborted)throw new Error('Research was stopped.');const workspace=bridge?.workspace;if(!bridge?.session?.authenticated||!workspace?.id)return {draft:null,mode:'evidence',reason:'Sign in to use workspace AI enrichment.',receipt:{operation:'synthesis',provider:'',status:'not_run',resultCount:0}};
  sources=(Array.isArray(sources)?sources:[]).slice(0,12);documents=engine().normalizeDocumentIds(documents).filter(doc=>String(doc?.text||'').trim()).slice(0,5);
  const prompt=engine().buildAiPrompt({website,targetMarkets,sources,documents,uiLanguage,answers});const receipt={operation:'synthesis',provider:'',status:'failed',resultCount:0};const operation=window.LeadIntelReliabilityTrace?.begin('profile_synthesis');operation?.checkpoint('request','pending');
  try{
    const response=await settleBeforeAbort(fetch(`${LEADINTEL_API}/api/ai/generate?workspace_id=${encodeURIComponent(workspace.id)}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Accept':'application/json',...(operation?.id?{'X-LeadIntel-Operation-Id':operation.id}:{})},body:JSON.stringify({task:'profile-synthesis',system:prompt.system,prompt:prompt.prompt,max_output_tokens:3200}),signal:parentSignal}),parentSignal);
    const payload=await settleBeforeAbort(response.json().catch(()=>({})),parentSignal);
    receipt.provider=['openai','anthropic','gemini'].includes(payload.provider)?payload.provider:'';
    const operationId=response.headers?.get?.('X-LeadIntel-Operation-Id')||operation?.id||'';receipt.operationId=/^[A-Za-z0-9._:-]{8,80}$/.test(operationId)?operationId:'';operation?.checkpoint('response',response.ok?'pass':'fail');
    if(!response.ok){receipt.status=response.status===409?'not_run':'failed';return {draft:null,mode:'evidence',receipt,reason:response.status===409?'No active AI provider configured.':payload.error||`AI unavailable (${response.status})`};}
    const docIds=documents.map(doc=>doc.id);const validIds=[...sources.map(source=>source.id),...docIds];const draft=engine().parseAiDraft(payload.text,validIds,uiLanguage);
    receipt.resultCount=Object.values(draft).filter(row=>String(row?.value||'').trim()).length;receipt.status=receipt.resultCount?'succeeded':'empty';
    if(!receipt.resultCount)return {draft:null,mode:'evidence',receipt,reason:'AI returned no additional evidence-backed fields.'};
    return {draft,mode:'ai',receipt,provider:payload.provider==='gemini'?'Google Gemini':payload.provider==='anthropic'?'Anthropic':payload.provider==='openai'?'OpenAI':'',model:payload.model||''};
  }catch(error){receipt.status=parentSignal?.aborted?'canceled':'failed';return {draft:null,mode:'evidence',receipt,reason:parentSignal?.aborted?'AI synthesis stopped after 60 seconds.':error.message||'AI enrichment unavailable.'};}
  finally{operation?.finish(receipt.status==='succeeded'?'pass':receipt.status==='canceled'?'canceled':receipt.status==='empty'?'partial':'fail');}
}
function combineDrafts(fallback,ai){
  const result={};for(const id of engine().QUESTION_IDS){const aiRow=ai?.[id];result[id]=aiRow&&String(aiRow.value||'').trim()?aiRow:fallback[id];}return result;
}


function profileAdviceInputs(state=readState()){
  const website=engine()?.safeUrl(state.website),domain=website?new URL(website).hostname.replace(/^www\./,''):'';
  const all=[...sourceMap(state).values()].filter(source=>source.type!=='document'&&String(source.text||'').trim());
  return {website,answers:state.answers||{},targetMarkets:selectedMarkets(state),sources:all.filter(source=>domain&&engine()?.safeUrl(source.url)&&new URL(source.url).hostname.replace(/^www\./,'')===domain),documents:state.documents||[],uiLanguage:'en'};
}
function adviceOwner(){return JSON.stringify([localStorage.getItem('leadintel_account_context_v1'),window.LeadIntelServerBridge?.workspace?.id,window.LeadIntelServerBridge?.session?.user?.id]);}
function currentAdvice(){return profileAdvice&&profileAdvice.owner===adviceOwner()&&researchContextCurrent(profileAdvice.context);}
function reviewProfileAdvice(){
  const state=readState(),input=profileAdviceInputs(state),adviser=window.LeadIntelCommercialProfileAdviser;
  if(!input.sources.length&&!input.documents.some(document=>String(document.text||'').trim())){toast('Saved company evidence is needed before preparing profile suggestions.');return false;}
  const advice=adviser.buildAdvice(input,window.LeadIntelCompanyBrain);
  profileAdviceUndo=metaForCurrentState().adviceUndo||profileAdviceUndo;
  profileAdvice={...advice,owner:adviceOwner(),context:captureResearchContext(state),input};renderProfileAdvice();
  document.getElementById('profile-advice-review')?.scrollIntoView?.({behavior:'smooth',block:'start'});return true;
}
function renderProfileAdvice(){
  if(!profileAdvice||profileAdvice.owner!==adviceOwner())return;
  let panel=document.getElementById('profile-advice-review');if(!panel){panel=document.createElement('section');panel.id='profile-advice-review';panel.className='profile-advice-review panel';document.getElementById('research-summary')?.after(panel);}
  if(!document.querySelector('link[data-profile-adviser-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./profile-adviser.css?v=20261101-v1';link.dataset.profileAdviserCss='1';document.head.appendChild(link);}
  const adviser=window.LeadIntelCommercialProfileAdviser,state=readState();
  const title=id=>document.querySelector(`[data-question="${id}"]`)?.closest('.question-card')?.querySelector('h3')?.textContent||id.replaceAll('_',' ');
  panel.innerHTML=`<div class="profile-advice-heading"><div><span class="eyebrow">Commercial profile adviser</span><h2>Make all 12 answers work together.</h2><p>Facts stay linked to evidence. Commercial recommendations need your review. Your current answers stay in place until you choose a suggestion.</p></div><button type="button" class="text-btn" data-profile-advice-close>Close</button></div><ul class="profile-advice-insights">${(profileAdvice.insights||[]).map(text=>`<li>${esc(text)}</li>`).join('')}</ul><div class="profile-advice-actions"><button type="button" class="primary-btn" data-profile-advice-fill ${profileAdviceBusy?'disabled':''}>Fill empty and unreviewed fields</button><button type="button" class="secondary-btn" data-profile-advice-ai ${profileAdviceBusy?'disabled':''}>${profileAdviceBusy?'Refining suggestions…':'Refine suggestions with AI'}</button><button type="button" class="secondary-btn" data-profile-advice-undo ${!profileAdviceUndo||profileAdviceBusy?'disabled':''}>Undo last change</button></div><p role="status" data-profile-advice-status>${esc(profileAdvice.notice||'Review recommendations for existing answers individually. Nothing is auto-approved.')}</p><div class="profile-advice-grid">${adviser.FIELDS.map((id,i)=>{const row=profileAdvice.fields[id]||{},current=String(state.answers?.[id]||''),issues=adviser.issuesFor(id,current,profileAdvice);return `<article class="profile-advice-card"><span class="eyebrow">${String(i+1).padStart(2,'0')} · ${esc(title(id))}</span>${issues.length?`<ul class="profile-advice-issues">${issues.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:''}<h3>Current answer</h3><p>${esc(current||'Empty')}</p><h3>${row.draftType==='hypothesis'?'Commercial recommendation':'Evidence-based draft'}</h3><p class="profile-advice-value">${esc(row.value||'Needs verified company input')}</p><small>${esc(row.rationale||'Review against the saved company evidence.')}</small>${row.value?`<button type="button" class="secondary-btn" data-profile-advice-use="${esc(id)}" ${profileAdviceBusy||current.trim()===String(row.value).trim()?'disabled':''}>Use suggestion</button>`:''}</article>`;}).join('')}</div>`;
  panel.querySelector('[data-profile-advice-close]')?.addEventListener('click',()=>{panel.remove();profileAdvice=null;});
  panel.querySelector('[data-profile-advice-fill]')?.addEventListener('click',()=>applyProfileAdvice());
  panel.querySelector('[data-profile-advice-ai]')?.addEventListener('click',refineProfileAdvice);
  panel.querySelector('[data-profile-advice-undo]')?.addEventListener('click',undoProfileAdvice);
  panel.querySelectorAll('[data-profile-advice-use]').forEach(button=>button.addEventListener('click',()=>applyProfileAdvice([button.dataset.profileAdviceUse])));
}
async function applyProfileAdvice(ids=null){
  if(profileAdviceBusy||!currentAdvice()){toast('The profile changed. Review all 12 answers again before applying suggestions.');return false;}
  const state=readState(),meta=metaForCurrentState(),adviser=window.LeadIntelCommercialProfileAdviser;
  const selected=(ids||adviser.FIELDS.filter(id=>!String(state.answers?.[id]||'').trim()||['research','evidence_draft','hypothesis_draft'].includes(meta.fields?.[id]?.origin)&&!meta.fields[id].reviewed&&String(state.answers[id]).trim()===String(meta.fields[id].draftValue||'').trim())).filter(id=>adviser.FIELDS.includes(id)&&String(profileAdvice.fields[id]?.value||'').trim()&&String(profileAdvice.fields[id].value).trim()!==String(state.answers?.[id]||'').trim());
  if(!selected.length){profileAdvice.notice='No empty or unreviewed fields need changing. Review existing answers individually.';renderProfileAdvice();return false;}
  const undo={owner:adviceOwner(),website:state.website,changes:{}};meta.fields={...(meta.fields||{})};state.answers={...(state.answers||{})};state.answerStatus={...(state.answerStatus||{})};
  for(const id of selected){const row=profileAdvice.fields[id];undo.changes[id]={before:state.answers[id]||'',status:state.answerStatus[id]||'missing',meta:meta.fields[id]?JSON.parse(JSON.stringify(meta.fields[id])):null,applied:row.value};state.answers[id]=row.value;state.answerStatus[id]='draft';meta.fields[id]={origin:row.draftType==='hypothesis'?'hypothesis_draft':'evidence_draft',draftValue:row.value,reviewed:false,confidence:row.confidence||'medium',sourceIds:row.sourceIds||[],rationale:row.rationale||'',draftMode:profileAdvice.receipt?.status==='succeeded'?'ai-advised':'analytical',...(profileAdvice.receipt?{synthesisReceipt:profileAdvice.receipt}:{})};}
  state.approved=false;state.targetingConfirmation=null;state.market={...(state.market||{}),strategyApproved:false,strategyApprovedAt:'',researchContextStale:true};
  meta.adviceUndo=undo;writeMeta(meta);writeState(state);profileAdviceUndo=undo;
  window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website:state.website,adviceApplied:selected}}));
  window.dispatchEvent(new CustomEvent('leadintel:commercial-context-changed',{detail:{fields:selected}}));
  window.dispatchEvent(new CustomEvent('leadintel:workspace-dirty',{detail:{source:'profile-advice'}}));
  profileAdvice.context=captureResearchContext(readState());profileAdvice.notice=`${selected.length} draft${selected.length===1?'':'s'} applied. Review, edit, accept or clear each answer. Previous wording is available with Undo.`;renderResearchReview();renderProfileAdvice();
  await saveWorkspaceBestEffort();return true;
}
async function undoProfileAdvice(){
  const undo=profileAdviceUndo;if(!undo||undo.owner!==adviceOwner())return false;
  const state=readState(),meta=metaForCurrentState();if(state.website!==undo.website)return false;let restored=0;
  for(const [id,row] of Object.entries(undo.changes)){if(state.answers?.[id]!==row.applied)continue;state.answers[id]=row.before;state.answerStatus[id]=row.status;meta.fields=meta.fields||{};if(row.meta)meta.fields[id]=row.meta;else delete meta.fields[id];restored++;}
  if(!restored){toast('Those fields changed after applying advice. Your newer edits were preserved.');return false;}
  state.approved=false;state.targetingConfirmation=null;state.market={...(state.market||{}),strategyApproved:false,strategyApprovedAt:''};delete meta.adviceUndo;writeMeta(meta);writeState(state);profileAdviceUndo=null;
  window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website:state.website,adviceUndone:true}}));window.dispatchEvent(new CustomEvent('leadintel:workspace-dirty',{detail:{source:'profile-advice-undo'}}));
  if(profileAdvice){profileAdvice.context=captureResearchContext(readState());profileAdvice.notice='Previous answers restored. Newer manual edits were kept.';}renderResearchReview();renderProfileAdvice();await saveWorkspaceBestEffort();return true;
}
async function refineProfileAdvice(){
  if(profileAdviceBusy||!currentAdvice())return false;const owned=profileAdvice,context=owned.context;profileAdviceBusy=true;renderProfileAdvice();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),COMPANY_RESEARCH_RUN_TIMEOUT_MS);
  try{const ai=await aiDraftFor(profileAdviceInputs(),controller.signal);if(profileAdvice!==owned||!researchContextCurrent(context))return false;
    if(ai.mode==='ai'&&ai.draft){owned.fields=combineDrafts(owned.fields,ai.draft);owned.receipt={...ai.receipt,completedAt:new Date().toISOString()};owned.notice='AI refined these proposals using the saved evidence and current answers. No answers were replaced or approved.';owned.provider=ai.provider;}
    else owned.notice='AI refinement was unavailable. The analytical suggestions remain available; your current answers are unchanged. '+(ai.reason||'');
    return ai.mode==='ai';
  }catch(error){if(profileAdvice===owned)owned.notice='AI refinement could not complete. Analytical suggestions and your current answers were preserved.';return false;
  }finally{clearTimeout(timer);profileAdviceBusy=false;if(profileAdvice===owned)renderProfileAdvice();}
}
window.LeadIntelProfileAdvice={review:reviewProfileAdvice,apply:applyProfileAdvice,undo:undoProfileAdvice,refine:refineProfileAdvice};

async function runAiSynthesis(){
  if(running)return false;
  const researchEngine=engine();if(!researchEngine){toast('Research engine is still loading. Try again.');return false;}
  const state=readState();const context=captureResearchContext(state);const meta=metaForCurrentState();const website=normalizeUrl(state.website);
  if(!website||!meta.generatedAt){toast('Run company research before synthesizing evidence.');return false;}
  const savedSources=[...sourceMap(state).values()].filter(source=>source.type!=='document'&&String(source.text||'').trim());
  const primarySources=savedSources.filter(source=>source.role==='primary');const sources=primarySources.length?primarySources:savedSources;
  if(!sources.length){toast('Saved evidence is missing. Refresh company research before trying AI synthesis.');return false;}
  running=true;const button=$('synthesize-company-research');if(button){button.disabled=true;button.textContent='Preparing AI profile…';}
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),COMPANY_RESEARCH_RUN_TIMEOUT_MS);
  try{
    setProgress('Synthesizing saved evidence…',`Interpreting ${sources.length} primary company sources for commercial fit, buyers and buying triggers.`);
    const ai=await aiDraftFor({website,targetMarkets:selectedMarkets(state),sources,documents:state.documents||[],uiLanguage:'en',answers:state.answers||{}},controller.signal);
    const latest=readState();assertResearchContext(context,latest);const latestMeta=metaForCurrentState();
    const receipts=[...(latestMeta.execution?.receipts||[]).filter(row=>row.operation!=='synthesis').slice(0,39),...(ai.receipt?[{...ai.receipt,id:'AI'}]:[])];latestMeta.execution={version:1,status:receipts.some(row=>['failed','canceled','not_run'].includes(row.status))?'partial':'complete',receipts};
    if(normalizeUrl(latest.website)!==website||normalizeUrl(latestMeta.website)!==website)throw new Error('Workspace changed during AI synthesis. Your edits were preserved; try again when ready.');
    if(ai.mode!=='ai'||!ai.draft){
      writeMeta({...latestMeta,mode:'evidence',provider:'',model:'',reason:ai.reason||'AI returned no additional evidence-backed fields.'});
      window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website,synthesisFailed:true}}));
      renderResearchReview();toast(`AI synthesis did not complete: ${ai.reason||'no additional evidence-backed fields were returned.'}`);return false;
    }
    const fallback=researchEngine.buildEvidenceDraft({website,answers:latest.answers||{},sources,targetMarkets:selectedMarkets(latest),uiLanguage:'en'});
    const draft=researchEngine.capDraftConfidence(combineDrafts(fallback,ai.draft),latestMeta.quality?.coverage||{});
    const merged=researchEngine.mergeDraft(latest.answers||{},draft,latestMeta.fields||{});
    const next={...latest,documents:researchEngine.normalizeDocumentIds(latest.documents),answers:merged.answers,answerStatus:{...(latest.answerStatus||{})},profile:null,approved:false,market:{}};
    for(const [id,row] of Object.entries(merged.meta))next.answerStatus[id]=row.origin==='user'?'user':row.reviewed?'accepted':merged.answers[id]?'draft':'missing';
    writeState(next);
    const fields={};for(const id of researchEngine.QUESTION_IDS){const row=merged.meta[id]||{};fields[id]={...row,reviewed:Boolean(row.reviewed||row.origin==='user'),draftMode:'ai'};}
    writeMeta({...latestMeta,generatedAt:new Date().toISOString(),mode:'ai',provider:ai.provider||'',model:ai.model||'',reason:'',fields});
    window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website,synthesized:true}}));
    window.dispatchEvent(new CustomEvent('leadintel:workspace-dirty',{detail:{source:'company-research-synthesis'}}));
    setProgress('AI synthesis complete','Your commercial brief now includes an AI synthesis grounded in the saved company evidence.',{done:true});
    renderResearchReview();const savedContext=captureResearchContext(readState());const saved=await saveWorkspaceBestEffort();if(!researchContextCurrent(savedContext))return false;writeMeta({...readMeta(),persistence:saved?.saved===false?'local-only':'synced'});if(saved?.saved===false){toast('AI profile is saved in this browser; workspace sync did not complete.');return false;}toast('AI synthesis complete. Review the updated commercial brief.');return true;
  }catch(error){
    const reason=controller.signal.aborted?'AI synthesis stopped after 60 seconds.':(error.message||'AI synthesis is temporarily unavailable.');
    const latestMeta=metaForCurrentState();if(researchContextCurrent(context)&&normalizeUrl(latestMeta.website)===website){writeMeta({...latestMeta,mode:'evidence',provider:'',model:'',reason});window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website,synthesisFailed:true}}));renderResearchReview();}
    toast(reason);return false;
  }finally{clearTimeout(timer);running=false;activeProgress=null;renderResearchReview();}
}


// Accepted answers keep the exact extract they cited, even when refreshed URLs change.
function retainAcceptedEvidence(sources,state,previousFields,merged){
  const retained=sources.map(source=>({...source}));const old=sourceMap(state);const remapped=new Map();
  for(const [id,row] of Object.entries(merged.meta)){
    const previous=previousFields[id];if(!previous||!String(state.answers?.[id]||'').trim()||merged.answers[id]!==String(state.answers[id]).replace(/\s+/g,' ').trim()||(!previous.reviewed&&previous.origin!=='user'))continue;
    row.sourceIds=(row.sourceIds||[]).map(sourceId=>{
      const source=old.get(sourceId);if(source?.type==='document')return sourceId;
      if(remapped.has(sourceId))return remapped.get(sourceId);
      if(!source)return '';
      let match=retained.find(candidate=>candidate.url===source.url&&candidate.text===source.text);
      if(!match){match={...source,id:`S${retained.length+1}`,role:'supporting'};retained.push(match);}
      remapped.set(sourceId,match.id);return match.id;
    }).filter(Boolean);
  }
  const cited=new Set(Object.values(merged.meta).flatMap(row=>row.sourceIds||[]));const websiteSource=sources.find(source=>source.type==='website'&&source.role==='primary');if(websiteSource)cited.add(websiteSource.id);
  const required=retained.filter(source=>cited.has(source.id));
  let characters=required.reduce((total,source)=>total+String(source.text||'').length,0);const maxChars=engine().RESEARCH_LIMITS.standard.maxChars;
  if(required.length>engine().MAX_SOURCES||characters>maxChars)throw new Error('Refresh needs more retained citation evidence than the research limit. Previous evidence was preserved; review existing citations before refreshing.');
  const keep=new Set(required.map(source=>source.id));
  for(const source of retained){if(keep.size>=engine().MAX_SOURCES)break;if(keep.has(source.id))continue;const length=String(source.text||'').length;if(characters+length>maxChars)continue;keep.add(source.id);characters+=length;}
  return retained.filter(source=>keep.has(source.id));
}

async function runCompanyResearch({rerun=false}={}){
  if(running)return;const researchEngine=engine();if(!researchEngine){toast('Research engine is still loading. Try again.');return;}
  const state=readState();let context=captureResearchContext(state);const researchLanguage='en';const website=normalizeUrl($('company-website')?.value||state.website);const markets=selectedMarkets(state);const additionalLinks=String($('additional-links')?.value??(Array.isArray(state.additionalLinks)?state.additionalLinks.join('\n'):'')).split(/\n/).map(normalizeUrl).filter(Boolean).slice(0,8);
  const error=$('step1-error');if(website!==normalizeUrl(state.website)||(window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive&&!window.LeadIntelWebsiteActivation.isCurrentWebsiteActive(state.website))){const message='Activate the company website in Setup before researching it.';if(error)error.textContent=message;toast(message);return;}if(!website){if(error)error.textContent='Enter a valid company website.';return;}if(!markets.length){if(error)error.textContent='Choose at least one target market.';return;}if(error)error.textContent='';
  running=true;setResearchButtonBusy(true);const rerunButton=$('rerun-company-research');if(rerunButton)rerunButton.disabled=true;
  const runController=new AbortController();const runTimer=setTimeout(()=>runController.abort(),COMPANY_RESEARCH_RUN_TIMEOUT_MS);const taskId=`company-research:${Date.now()}`;const taskCentre=window.LeadIntelTaskCentre;
  taskCentre?.start({id:taskId,type:'company-research',title:'Company research',stage:'Scanning company sources',total:4,completed:0,canCancel:true,canRetry:true});
  let canceled=false;taskCentre?.registerActions(taskId,{cancel:()=>{canceled=true;runController.abort();},retry:()=>runCompanyResearch({rerun:true})});
  let failures=0;const receipts=[];
  const execution=()=>({version:1,status:receipts.some(row=>['failed','canceled','not_run'].includes(row.status))?'partial':'complete',receipts:receipts.map(row=>({...row}))});
  const perform=async(operation,details,run)=>{
    assertResearchContext(context,readState());if(runController.signal.aborted)throw new Error('Research was stopped.');
    const receipt={id:`R${receipts.length+1}`,operation,provider:'firecrawl-route',...details,status:'running',resultCount:0};receipts.push(receipt);
    try{if(runController.signal.aborted)throw new Error('Research was stopped.');const value=await run();receipt.provider=value?.executionProvider||'firecrawl-route';receipt.trace=value?.executionTrace||[];receipt.operationId=value?.operationId||'';receipt.resultCount=Array.isArray(value)?value.length:1;receipt.status=receipt.resultCount?'succeeded':'empty';return value;}
    catch(error){receipt.status=runController.signal.aborted?'canceled':'failed';throw error;}
  };
  try{
    setProgress('Scanning company sources…','Reading the main website and any optional links you supplied.');
    taskCentre?.update(taskId,{stage:'Scanning company sources',completed:0});
    const sourceRequests=[{url:website,type:'website',pageCategory:'company'},...additionalLinks.map(url=>({url,type:'link',pageCategory:''}))];const official=[];
    const settled=await Promise.allSettled(sourceRequests.map(source=>perform('extract',{url:source.url},()=>scrapeSource(source.url,source.type,source.pageCategory,runController.signal))));
    settled.forEach(result=>{if(result.status==='fulfilled')official.push(result.value);else failures++;});
    const companyName=researchEngine.deriveCompanyName(official,website);
    setProgress('Discovering authoritative company pages…','Finding service, project reference, technical, delivery and contact pages on the verified domain.');
    taskCentre?.update(taskId,{stage:'Discovering authoritative pages',completed:1,resultCount:official.length});
    const authoritativeRows=official.flatMap(page=>window.LeadIntelFirstPartyResearch.selectInternalLinks(page,website,'company',5).map(url=>({url,title:url})));const authoritativeQueries=researchEngine.buildAuthoritativePageQueries({website,companyName,offer:state.answers?.priority_offers,sources:official});
    const authoritativeSearchSettled=await Promise.allSettled(authoritativeQueries.map(query=>perform('search',{query:query.query.slice(0,500)},()=>searchPublic(query,runController.signal))));
    authoritativeSearchSettled.forEach(result=>{if(result.status==='fulfilled')authoritativeRows.push(...result.value);else failures++;});
    const existingUrls=new Set(official.map(source=>researchEngine.safeUrl(source.url)));const authoritativeCandidates=researchEngine.selectAuthoritativePageCandidates(authoritativeRows,website,8).filter(source=>!existingUrls.has(researchEngine.safeUrl(source.url)));
    const authoritativeSettled=await Promise.allSettled(authoritativeCandidates.map(source=>perform('extract',{url:source.url},()=>scrapeSource(source.url,'link',source.pageCategory,runController.signal))));
    authoritativeSettled.forEach(result=>{if(result.status==='fulfilled')official.push(result.value);else failures++;});
    const queries=researchEngine.buildResearchQueries({website,companyName,targetMarkets:markets},MAX_COMPANY_RESEARCH_QUERIES);
    setProgress('Searching related public sources…',`Running ${queries.length} bounded company searches for evidence, news, partners and market context.`);
    taskCentre?.update(taskId,{stage:'Searching related public sources',completed:2,resultCount:official.length});
    const publicRows=[];
    const publicSettled=await Promise.allSettled(queries.map(query=>perform('search',{query:query.query.slice(0,500)},()=>searchPublic(query,runController.signal))));
    publicSettled.forEach(result=>{if(result.status==='fulfilled')publicRows.push(...result.value);else failures++;});
    const rawSources=researchEngine.mergeSources(official,publicRows,researchEngine.RESEARCH_LIMITS.standard.maxPages);
    const research=researchEngine.filterResearchSources(rawSources,website,{depth:'standard'});
    const sources=[...research.primary,...research.supporting];
    let quality=researchEngine.evaluateResearchQuality({website,primary:research.primary,supporting:research.supporting,failures});
    if(!quality.publishable)throw new Error(`Research quality check failed: ${quality.issues.join(' ')}`);
    setProgress('Building evidence-backed context…',`${research.primary.length} primary and ${research.supporting.length} supporting sources passed the quality check.`);
    taskCentre?.update(taskId,{stage:'Building evidence-backed context',completed:3,resultCount:sources.length});
    // Persist verified evidence before the independent, potentially slow AI stage.
    const checkpoint=readState();assertResearchContext(context,checkpoint);
    if(canceled)throw new Error('Company research canceled.');
    // A refresh must retain the previous evidence/profile until its replacement is ready.
    if(!checkpoint.scrapedSources?.length){
      checkpoint.scrapedSources=sources.map(source=>({...source,status:'ready'}));writeState(checkpoint);
      writeMeta({website,generatedAt:new Date().toISOString(),mode:'evidence',sourceCount:sources.length,quality,failures,execution:execution(),reason:'AI profile preparation has not completed.',fields:{}});
    }
    context=captureResearchContext(readState());
    const fallback=researchEngine.buildEvidenceDraft({website,answers:state.answers||{},sources:research.primary,targetMarkets:markets,uiLanguage:researchLanguage});const ai=await aiDraftFor({website,targetMarkets:markets,sources:research.primary,documents:state.documents||[],uiLanguage:researchLanguage,answers:state.answers||{}},runController.signal);const draft=researchEngine.capDraftConfidence(combineDrafts(fallback,ai.draft),quality.coverage);const merged=researchEngine.mergeDraft(state.answers||{},draft,readMeta().fields||{});
    const latest=readState();assertResearchContext(context,latest);
    if(ai.receipt)receipts.push({...ai.receipt,id:`R${receipts.length+1}`});
    if(canceled)throw new Error('Company research canceled.');
    if(state.profile&&ai.mode!=='ai')throw new Error(`AI refresh did not complete: ${ai.reason||'No usable AI fields returned.'}`);
    const retained=retainAcceptedEvidence(sources,state,readMeta().fields||{},merged);
    quality=researchEngine.evaluateResearchQuality({website,primary:retained.filter(source=>source.role==='primary'),supporting:retained.filter(source=>source.role!=='primary'),failures});
    if(!quality.publishable)throw new Error('Retained research no longer meets the website evidence gate; previous evidence was preserved.');
    for(const [id,row] of Object.entries(merged.meta)){if(!row.reviewed)merged.meta[id]=researchEngine.capDraftConfidence({[id]:row},quality.coverage)[id];}
    const next={...latest};next.documents=researchEngine.normalizeDocumentIds(latest.documents);next.uiLanguage='en';next.website=website;next.targetMarkets=markets;next.additionalLinks=additionalLinks;next.answers=merged.answers;
    next.scrapedSources=retained.map(source=>({id:source.id,type:source.type==='public'?'link':source.type,url:source.url,title:source.title,text:source.text,extracted:source.extracted,status:'ready',role:source.role||'supporting',pageCategory:source.pageCategory||researchEngine.classifyPageCategory(source,website)}));
    next.answerStatus={...(state.answerStatus||{})};for(const [id,row] of Object.entries(merged.meta)){next.answerStatus[id]=row.origin==='user'?'user':row.reviewed?'accepted':merged.answers[id]?'draft':'missing';}
    next.profile=null;next.approved=false;next.market={};next.step=2;writeState(next);
    const fields={};for(const id of researchEngine.QUESTION_IDS){const row=merged.meta[id]||{};fields[id]={...row,reviewed:Boolean(row.reviewed||row.origin==='user'),draftMode:ai.mode};}
    writeMeta({website,generatedAt:new Date().toISOString(),contentLanguage:researchLanguage,mode:ai.mode,provider:ai.provider||'',model:ai.model||'',sourceCount:retained.length,primarySourceCount:retained.filter(source=>source.role==='primary').length,supportingSourceCount:retained.filter(source=>source.role!=='primary').length,excludedSourceCount:research.excluded.length,characters:retained.reduce((total,source)=>total+String(source.text||'').length,0),limits:research.limits,quality,failures,execution:execution(),reason:ai.reason||'',fields});
    window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website}}));
    window.dispatchEvent(new CustomEvent('leadintel:workspace-dirty',{detail:{source:'company-research'}}));
    const completionStage=ai.mode==='ai'?'Research and AI synthesis complete':'Evidence collected; AI synthesis unavailable';
    const completionDetail=ai.mode==='ai'?'Opening your evidence-backed commercial brief for review.':`${sources.length} sources saved. ${ai.reason||'Activate an AI provider to synthesize the saved evidence.'}`;
    setProgress(completionStage,completionDetail,{done:true});
    const savedContext=captureResearchContext(readState());const saved=await saveWorkspaceBestEffort();
    if(!researchContextCurrent(savedContext))return;
    writeMeta({...readMeta(),persistence:saved?.saved===false?'local-only':'synced'});
    if(saved?.saved===false)taskCentre?.fail(taskId,'Research is saved in this browser; workspace sync did not complete.',{canRetry:false});else taskCentre?.complete(taskId,{stage:completionStage,resultCount:sources.length});
    renderResearchReview();
  }catch(error){
    const message=canceled?'Company research canceled.':runController.signal.aborted?'Company research stopped after 60 seconds.':(error.message||'Public research is temporarily unavailable.');
    setProgress('Research could not complete',message);toast('Company research stopped safely. Your existing workspace data is safe.');
    if(taskCentre?.get(taskId)?.status!=='canceled')taskCentre?.fail(taskId,message,{canRetry:true});
    const latest=readState();
    if(researchContextCurrent(context,latest)&&normalizeUrl(latest.website||'')===website){
      const now=new Date().toISOString();const existing=readMeta();const previous=normalizeUrl(existing.website)===website?existing:{};
      writeMeta(previous.generatedAt?{...previous,lastFailureAt:now,lastFailure:message,lastExecution:execution()}:{...previous,website,failureAt:now,error:message,generatedAt:'',mode:'failed',execution:execution(),fields:previous.fields||{}});
      if(!canceled&&!previous.generatedAt){latest.website=website;latest.targetMarkets=markets;latest.additionalLinks=additionalLinks;latest.step=2;writeState(latest);}window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website}}));
    }
  }
  finally{clearTimeout(runTimer);running=false;activeProgress=null;renderResearchReview();}
}

function needsInitialCompanyResearch(){
  const state=readState(),meta=metaForCurrentState();
  return !state.profile&&companyResearchReady(state)&&Boolean(window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive?.(state.website))&&!meta.generatedAt&&!meta.failureAt;
}
function prepareProfileAnswers(event){
  // Only the explicit Continue button may start paid research. Stage markers and sidebar items are
  // navigation, not consent (docs/project-state/2026-10-18-company-research-lifecycle.md).
  const target=event.target?.closest?.('#to-questionnaire');
  if(!target||!needsInitialCompanyResearch())return;
  event.preventDefault();event.stopImmediatePropagation();
  void runCompanyResearch();
}
function bind(){
  ensureResearchUi();
  document.addEventListener('click',prepareProfileAnswers,{capture:true});
  // Restoring Profile must never start another paid research run automatically.
  document.getElementById('step-2')?.addEventListener('click',handleReviewAction);
  window.addEventListener('leadintel:website-activated',renderResearchReview);
  window.addEventListener('leadintel:module-opened',event=>{if(Number(event.detail?.step)===2){renderResearchReview();}});
  window.addEventListener('leadintel:server-ready',()=>{renderResearchReview();});
  window.addEventListener('leadintel:workspace-changed',()=>{renderResearchReview();});
  window.addEventListener('leadintel:ai-provider-changed',()=>{
    const meta=metaForCurrentState();
    if(meta.generatedAt&&meta.mode!=='ai'&&!/\bcode:\s*credit_balance_exhausted\b/i.test(String(meta.reason||'')))writeMeta({...meta,reason:'AI provider settings changed. Retry synthesis to use the updated connection.'});
    renderResearchReview();
    window.dispatchEvent(new CustomEvent('leadintel:company-research-updated',{detail:{website:meta.website,providerSettingsChanged:true}}));
  });
  window.addEventListener('leadintel:workspace-reset',()=>{profileAdvice=null;profileAdviceUndo=null;document.getElementById('profile-advice-review')?.remove();setTimeout(renderResearchReview,0);});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
