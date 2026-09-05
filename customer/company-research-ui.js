import './company-research-engine.js?v=20260905-latvian-framework-synthesis-v1';

const MAIN_STORAGE_KEY='leadintel_customer_v2_state';
const RESEARCH_META_KEY='leadintel_customer_v2_research_meta_v1';
const FIRECRAWL_PROXY='https://apollo-proxy.edgars-7e7.workers.dev';
const LEADINTEL_API='https://leadintel-api.edgars-7e7.workers.dev';
const MAX_COMPANY_RESEARCH_QUERIES=3;
const MAX_RESULTS_PER_QUERY=4;
const RELEASE='20260905-latvian-framework-synthesis-v1';
let running=false;

const engine=()=>window.LeadIntelCompanyResearch;
const $=id=>document.getElementById(id);
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function readJson(key,fallback={}){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:fallback;}catch{return fallback;}}
function readState(){return readJson(MAIN_STORAGE_KEY,{});}
function writeState(value){localStorage.setItem(MAIN_STORAGE_KEY,JSON.stringify(value));}
function readMeta(){return readJson(RESEARCH_META_KEY,{});}
function writeMeta(value){localStorage.setItem(RESEARCH_META_KEY,JSON.stringify(value));}
function normalizeUrl(value){return engine()?.safeUrl(value)||'';}
function selectedMarkets(state){return Array.isArray(state?.targetMarkets)?state.targetMarkets.map(value=>String(value||'').trim()).filter(Boolean):[];}
function injectCss(){if(document.querySelector('link[data-leadintel-asset="company-research-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=`company-research.css?v=${RELEASE}`;link.dataset.leadintelAsset='company-research-css';document.head.appendChild(link);}
function toast(message){const node=$('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),3000);}

function ensureResearchUi(){
  injectCss();
  const button=$('to-questionnaire');if(button){button.innerHTML='Research company & pre-fill context <span>→</span>';}
  const step1=document.getElementById('step-1');
  if(step1&&!document.getElementById('company-research-progress')){
    const actions=step1.querySelector('.step-actions');
    actions?.insertAdjacentHTML('beforebegin','<div class="company-research-progress" id="company-research-progress" hidden><div class="company-research-spinner" aria-hidden="true"></div><div><strong id="company-research-title">Preparing company research…</strong><small id="company-research-detail">LeadIntel will use public evidence and your selected market.</small></div></div>');
  }
  const step2=document.getElementById('step-2');const hero=step2?.querySelector('.hero-copy');
  if(hero){
    const heading=hero.querySelector('h1');const paragraph=hero.querySelector('p');
    if(heading)heading.textContent='Review what LeadIntel found.';
    if(paragraph)paragraph.textContent='LeadIntel researched your company and selected markets and pre-filled only what the evidence supports. Edit anything; fields with insufficient evidence stay open for your input.';
    if(!document.getElementById('research-summary'))hero.insertAdjacentHTML('afterend','<div class="research-summary" id="research-summary"><div class="research-summary-main"><div class="research-summary-icon">✦</div><div><strong>Research has not run yet.</strong><small>Add the website and target market in Step 1, then run company research.</small></div></div><div class="research-summary-actions"><span class="research-mode">Evidence first</span><button class="research-rerun" id="rerun-company-research" type="button">Rerun company research</button></div></div>');
  }
  document.querySelectorAll('[data-question]').forEach(textarea=>{
    const card=textarea.closest('.question-card');if(!card||card.querySelector('.research-field-meta'))return;
    card.insertAdjacentHTML('beforeend',`<div class="research-field-meta" data-research-meta="${esc(textarea.dataset.question)}"></div>`);
    textarea.addEventListener('input',()=>markUserInput(textarea.dataset.question,textarea.value));
  });
  renderResearchReview();
}

function setProgress(title,detail,{done=false}={}){
  const box=$('company-research-progress');if(!box)return;box.hidden=false;box.classList.toggle('done',done);
  if($('company-research-title'))$('company-research-title').textContent=title;
  if($('company-research-detail'))$('company-research-detail').textContent=detail;
}
function setResearchButtonBusy(busy){const button=$('to-questionnaire');if(!button)return;button.disabled=busy;button.innerHTML=busy?'Researching company…':'Research company & pre-fill context <span>→</span>';}
function sourceMap(state){
  const map=new Map();(state.scrapedSources||[]).forEach((source,index)=>map.set(`S${index+1}`,{...source,id:`S${index+1}`}));
  (state.documents||[]).filter(doc=>String(doc?.text||'').trim()).forEach((doc,index)=>map.set(`D${index+1}`,{id:`D${index+1}`,type:'document',title:doc.name||`Document ${index+1}`}));
  return map;
}
function metaForCurrentState(){const state=readState(),meta=readMeta();if(!meta?.website||normalizeUrl(meta.website)!==normalizeUrl(state.website))return {};return meta;}
function modeLabel(meta){if(meta.mode==='ai')return `${meta.provider||'AI'}${meta.model?` · ${meta.model}`:''}`;return 'Evidence draft';}
function renderResearchReview(){
  const state=readState();const meta=metaForCurrentState();const map=sourceMap(state);const summary=$('research-summary');
  if(summary){
    if(meta.generatedAt){
      const aiNote=meta.mode==='ai'?`AI enrichment active · ${esc(modeLabel(meta))}`:'Evidence-only draft · connect an AI provider in Settings for deeper synthesis.';
      summary.innerHTML=`<div class="research-summary-main"><div class="research-summary-icon">✦</div><div><strong>Research complete · ${Number(meta.sourceCount)||0} evidence source${Number(meta.sourceCount)===1?'':'s'}</strong><small class="${meta.mode==='ai'?'':'research-no-ai'}">${aiNote}${meta.failures?` · ${Number(meta.failures)} source/search request${Number(meta.failures)===1?'':'s'} unavailable`:''}</small></div></div><div class="research-summary-actions"><span class="research-mode">${esc(modeLabel(meta))}</span><button class="research-rerun" id="rerun-company-research" type="button">Rerun company research</button></div>`;
    }
    summary.querySelector('#rerun-company-research')?.addEventListener('click',()=>runCompanyResearch({rerun:true}));
  }
  document.querySelectorAll('[data-question]').forEach(textarea=>{
    const id=textarea.dataset.question;const target=document.querySelector(`[data-research-meta="${id}"]`);if(!target)return;
    const value=String(textarea.value||'').trim();const row=meta.fields?.[id]||{};
    const card=textarea.closest('.question-card');card?.classList.toggle('research-populated',Boolean(value&&row.origin==='research'));
    let origin='Needs your input',originClass='needs';
    if(value&&row.origin==='research'){origin=meta.mode==='ai'?'AI draft':'Evidence draft';originClass='';}
    else if(value){origin='Your input';originClass='user';}
    const confidence=value&&row.confidence?`<span class="research-confidence ${esc(row.confidence)}">${esc(row.confidence)} confidence</span>`:'';
    const reviewed=row.reviewed&&row.origin!=='research'?'<span class="research-reviewed">Saved ✓</span>':'';
    const sourceIds=Array.isArray(row.sourceIds)?row.sourceIds:[];const sources=sourceIds.map(id=>map.get(id)).filter(Boolean).slice(0,3);
    const links=sources.length?`<div class="research-source-links">${sources.map(source=>source.type==='document'?`<span class="research-source-doc">${esc(source.title)}</span>`:`<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title||source.url)}</a>`).join('')}</div>`:'';
    const rationale=row.rationale?`<div class="research-rationale">${esc(row.rationale)}</div>`:'';
    const reviewAction=engine()?.reviewActionState?.(row)||{visible:row.origin==='research',label:row.reviewed?'Accepted ✓':'Accept',disabled:Boolean(row.reviewed)};
    const acceptAction=reviewAction.visible?`<button type="button" data-research-accept="${esc(id)}" ${reviewAction.disabled?'disabled':''}>${esc(reviewAction.label)}</button>`:'';
    const actions=value?`<div class="research-field-actions">${acceptAction}<button type="button" data-research-clear="${esc(id)}">Clear</button></div>`:'';
    target.innerHTML=`<div class="research-meta-top"><span class="research-origin ${originClass}">${origin}</span>${confidence}${reviewed}</div>${rationale}${links}${actions}`;
  });
}
function markUserInput(id,value){
  const state=readState();const meta=metaForCurrentState();if(!meta.generatedAt)return;
  meta.fields=meta.fields||{};meta.fields[id]={origin:String(value||'').trim()?'user':'needs-input',confidence:'',sourceIds:[],rationale:String(value||'').trim()?'Customer edited this field.':'Customer input recommended.',reviewed:Boolean(String(value||'').trim())};writeMeta(meta);renderResearchReview();
}
function handleReviewAction(event){
  const accept=event.target.closest('[data-research-accept]');const clear=event.target.closest('[data-research-clear]');if(!accept&&!clear)return;
  const id=(accept||clear).dataset.researchAccept||(accept||clear).dataset.researchClear;const textarea=document.querySelector(`[data-question="${id}"]`);const meta=metaForCurrentState();meta.fields=meta.fields||{};
  if(accept){meta.fields[id]={...(meta.fields[id]||{}),reviewed:true};writeMeta(meta);renderResearchReview();return;}
  if(clear&&textarea){textarea.value='';textarea.dispatchEvent(new Event('input',{bubbles:true}));meta.fields[id]={origin:'needs-input',confidence:'',sourceIds:[],rationale:'Cleared by customer; add input or rerun research.',reviewed:true};writeMeta(meta);renderResearchReview();}
}

async function scrapeSource(url,type){
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,formats:['markdown'],onlyMainContent:true,timeout:30000})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Source returned ${response.status}`);
  const data=payload.data||payload;const text=String(data.markdown||data.content||'').slice(0,30000);if(!text.trim())throw new Error('No readable page content returned');
  return {type,url,title:data.metadata?.title||data.title||new URL(url).hostname,text,status:'ready'};
}
async function searchPublic(queryMeta){
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:queryMeta.query,limit:MAX_RESULTS_PER_QUERY,scrapeOptions:{formats:['markdown']}})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Search returned ${response.status}`);return engine().normalizeSearchResults(payload,queryMeta);
}
async function waitForServerBridge(timeout=1800){
  if(window.LeadIntelServerBridge?.session!==null)return window.LeadIntelServerBridge;
  return new Promise(resolve=>{let settled=false;const finish=()=>{if(settled)return;settled=true;window.removeEventListener('leadintel:server-ready',finish);resolve(window.LeadIntelServerBridge||null);};window.addEventListener('leadintel:server-ready',finish,{once:true});setTimeout(finish,timeout);});
}
async function aiDraftFor({website,targetMarkets,sources,documents,uiLanguage}){
  const bridge=await waitForServerBridge();const workspace=bridge?.workspace;if(!bridge?.session?.authenticated||!workspace?.id)return {draft:null,mode:'evidence',reason:'Sign in to use workspace AI enrichment.'};
  const prompt=engine().buildAiPrompt({website,targetMarkets,sources,documents,uiLanguage});
  try{
    const response=await fetch(`${LEADINTEL_API}/api/ai/generate?workspace_id=${encodeURIComponent(workspace.id)}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({system:prompt.system,prompt:prompt.prompt,max_output_tokens:3200})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)return {draft:null,mode:'evidence',reason:response.status===409?'No active AI provider configured.':payload.error||`AI unavailable (${response.status})`};
    const docIds=(documents||[]).filter(doc=>String(doc?.text||'').trim()).slice(0,5).map((_,index)=>`D${index+1}`);const validIds=[...sources.map(source=>source.id),...docIds];const draft=engine().parseAiDraft(payload.text,validIds);
    if(!Object.values(draft).some(row=>String(row?.value||'').trim()))return {draft:null,mode:'evidence',reason:'AI returned no additional evidence-backed fields.'};
    return {draft,mode:'ai',provider:payload.provider==='gemini'?'Google Gemini':payload.provider==='anthropic'?'Anthropic':'OpenAI',model:payload.model||''};
  }catch(error){return {draft:null,mode:'evidence',reason:error.message||'AI enrichment unavailable.'};}
}
function combineDrafts(fallback,ai){
  const result={};for(const id of engine().QUESTION_IDS){const aiRow=ai?.[id];result[id]=aiRow&&String(aiRow.value||'').trim()?aiRow:fallback[id];}return result;
}

async function runCompanyResearch({rerun=false}={}){
  if(running)return;const researchEngine=engine();if(!researchEngine){toast('Research engine is still loading. Try again.');return;}
  const state=readState();const website=normalizeUrl($('company-website')?.value||state.website);const markets=selectedMarkets(state);const additionalLinks=String($('additional-links')?.value||'').split(/\n/).map(normalizeUrl).filter(Boolean).slice(0,8);
  const error=$('step1-error');if(!website){if(error)error.textContent='Enter a valid company website.';return;}if(!markets.length){if(error)error.textContent='Choose at least one target market.';return;}if(error)error.textContent='';
  running=true;setResearchButtonBusy(true);const rerunButton=$('rerun-company-research');if(rerunButton)rerunButton.disabled=true;
  let failures=0;
  try{
    setProgress('Scanning company sources…','Reading the main website and any optional links you supplied.');
    const sourceRequests=[{url:website,type:'website'},...additionalLinks.map(url=>({url,type:'link'}))];const official=[];
    const settled=await Promise.allSettled(sourceRequests.map(source=>scrapeSource(source.url,source.type)));
    settled.forEach(result=>{if(result.status==='fulfilled')official.push(result.value);else failures++;});
    const companyName=researchEngine.deriveCompanyName(official,website);const queries=researchEngine.buildResearchQueries({website,companyName,targetMarkets:markets},MAX_COMPANY_RESEARCH_QUERIES);
    setProgress('Searching related public sources…',`Running ${queries.length} bounded company searches for evidence, news, partners and market context.`);
    const publicRows=[];
    for(const query of queries){try{publicRows.push(...await searchPublic(query));}catch{failures++;}}
    const rawSources=researchEngine.mergeSources(official,publicRows,researchEngine.RESEARCH_LIMITS.standard.maxPages);
    const research=researchEngine.filterResearchSources(rawSources,website,{depth:'standard'});
    const sources=[...research.primary,...research.supporting];
    const quality=researchEngine.evaluateResearchQuality({website,primary:research.primary,supporting:research.supporting,failures});
    if(!quality.publishable)throw new Error(`Research quality check failed: ${quality.issues.join(' ')}`);
    setProgress('Building evidence-backed context…',`${research.primary.length} primary and ${research.supporting.length} supporting sources passed the quality check.`);
    const fallback=researchEngine.buildEvidenceDraft({sources:research.primary,targetMarkets:markets});const selectedContentLanguage=String(state.uiLanguage||"lv").toLowerCase()==="en"?"en":"lv";const ai=await aiDraftFor({website,targetMarkets:markets,sources:research.primary,documents:state.documents||[],uiLanguage:selectedContentLanguage});const draft=combineDrafts(fallback,ai.draft);const merged=researchEngine.mergeDraft(state.answers||{},draft);
    const next={...state};next.website=website;next.targetMarkets=markets;next.additionalLinks=additionalLinks;next.answers=merged.answers;
    next.scrapedSources=sources.map(source=>({type:source.type==='public'?'link':source.type,url:source.url,title:source.title,text:source.text,status:'ready',role:source.role||'supporting'}));
    next.profile=null;next.approved=false;next.market={};next.step=2;writeState(next);
    const fields={};for(const id of researchEngine.QUESTION_IDS){const row=merged.meta[id]||{};fields[id]={...row,reviewed:row.origin==='user',draftMode:ai.mode};}
    writeMeta({website,generatedAt:new Date().toISOString(),mode:ai.mode,provider:ai.provider||'',model:ai.model||'',sourceCount:sources.length,primarySourceCount:research.primary.length,supportingSourceCount:research.supporting.length,excludedSourceCount:research.excluded.length,characters:research.characters,limits:research.limits,quality,failures,reason:ai.reason||'',fields});
    setProgress('Research complete','Opening your evidence-backed draft for review.',{done:true});
    await window.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
    setTimeout(()=>location.reload(),180);
  }catch(error){setProgress('Research could not complete',error.message||'Public research is temporarily unavailable.');toast('Company research could not complete. Your existing workspace data is safe.');}
  finally{running=false;setResearchButtonBusy(false);if(rerunButton)rerunButton.disabled=false;}
}

function interceptStepOne(event){event.preventDefault();event.stopImmediatePropagation();runCompanyResearch();}
function bind(){
  ensureResearchUi();
  $('to-questionnaire')?.addEventListener('click',interceptStepOne,{capture:true});
  document.getElementById('step-2')?.addEventListener('click',handleReviewAction);
  window.addEventListener('leadintel:server-ready',renderResearchReview);
  window.addEventListener('leadintel:workspace-changed',renderResearchReview);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
