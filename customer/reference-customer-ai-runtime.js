import './first-party-research.js?v=20260930-research-pipeline-v1';
import './reference-customer-library.js?v=20260924-reference-consensus-v1&reference-similarity=20260930-v1&reference-refresh=2';
import './reference-customer-portfolio.js?v=20260923-reference-interface-v1&reference-discovery=5&reference-similarity=20260930-v1&reference-refresh=2';
import './reference-customer-library-ui.js?v=20260927-save-only-v1&target-research=1&saving-mode=1&reference-discovery=5&reference-similarity=20260930-v1&reference-refresh=2';
import './reference-customer-delete-ui.js?v=20260923-reference-interface-v1&reference-discovery=5';
import './reference-customer-upload-mode.js?v=20260911-reference-single-owner-v1&reference-discovery=5';

const REFERENCE_AI_STATE_KEY='leadintel_customer_v2_state';
const REFERENCE_AI_FIRECRAWL='https://apollo-proxy.edgars-7e7.workers.dev';
const REFERENCE_AI_MAX=24;
const REFERENCE_AI_CONCURRENCY=4;

(function installReferenceCustomerAiRuntime(root){
  'use strict';
  if(typeof document==='undefined')return;
  const Ref=root.LeadIntelReferenceCustomers;
  const AI=root.LeadIntelReferenceCustomerAI;
  const Portfolio=root.LeadIntelReferenceCustomerPortfolio;
  if(!Ref||!AI||!Portfolio)return;
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  function readState(){try{return JSON.parse(localStorage.getItem(REFERENCE_AI_STATE_KEY)||'{}');}catch{return {};}}
  function writeState(state){
    if(Ref.persistReferenceWorkspaceState)return Ref.persistReferenceWorkspaceState(root,state,{render:true});
    localStorage.setItem(REFERENCE_AI_STATE_KEY,JSON.stringify(state));
    root.dispatchEvent(new CustomEvent('leadintel:reference-customers-updated'));
    root.LeadIntelReferenceCustomerUI?.render?.();
    try{const pending=root.LeadIntelServerBridge?.saveNow?.();if(pending&&typeof pending.then==='function')void Promise.resolve(pending).catch(()=>null);}catch{}
    return state;
  }
  function workspaceId(){
    const bridge=root.LeadIntelServerBridge;
    return bridge?.session?.authenticated&&bridge?.workspace?.id?clean(bridge.workspace.id):'';
  }
  let analysisRunning=false;
  function status(message){
    const text=clean(message);
    const refresh=document.getElementById('reference-refresh-status');if(refresh)refresh.textContent=text;
    const visible=document.querySelector?.('[data-refresh-reference-analysis]');if(visible){visible.disabled=analysisRunning;visible.setAttribute?.('aria-busy',String(analysisRunning));visible.textContent=analysisRunning?'Analyzing companies…':'Refresh company analysis';}
    const top=document.getElementById('reference-import-status');if(top)top.textContent=text;
    const local=document.getElementById('reference-action-status');if(local)local.textContent=text;
  }
  async function scrapeRow(row){
    const collected=await root.LeadIntelFirstPartyResearch.collectWebsiteEvidence({website:row.website,maxPages:5});
    const sources=root.LeadIntelFirstPartyResearch.boundedSources(collected.pages);
    return {id:row.id,companyName:row.companyName,website:row.website,text:sources.map(page=>page.text).join(' '),sources,coverage:collected.coverage,reason:row.reason,productService:row.productService};
  }
  async function mapLimit(rows,worker){
    const results=new Array(rows.length);let cursor=0;
    async function run(){while(cursor<rows.length){const index=cursor++;try{results[index]={ok:true,value:await worker(rows[index])};}catch(error){results[index]={ok:false,error};}}}
    await Promise.all(Array.from({length:Math.min(REFERENCE_AI_CONCURRENCY,rows.length)},run));return results;
  }
  async function runAiAnalysis(button){
    let state=readState();state.referenceCustomers=Ref.normalizeReferenceState(state.referenceCustomers||{});
    const ready=state.referenceCustomers.rows.filter(row=>row.status==='ready'&&row.website).slice(0,REFERENCE_AI_MAX);
    if(!ready.length)throw new Error('Upload companies with valid websites first');
    const workspace=workspaceId();if(!workspace)throw new Error('AI analysis requires a signed-in LeadIntel workspace');
    // Keep the source list before any network request. An unsaved draft must not
    // produce a successful analysis with no durable reference list behind it.
    const currentList=state.referenceCustomerPortfolio?.lists?.find(list=>list.id===state.referenceCustomerPortfolio.selectedListId);
    if(!currentList){
      const name=clean(document.getElementById('reference-list-name')?.value)||`Reference Companies · ${ready[0].companyName||ready[0].domain}`;
      state=Portfolio.saveCurrentList(state,{name,markets:state.targetMarkets||[]});
    }else if(Portfolio.hasUnsavedCurrentListDraft(state)){
      state=Portfolio.saveCurrentList(state,{name:currentList.name,markets:currentList.markets,purpose:currentList.purpose});
    }
    const listId=state.referenceCustomerPortfolio.selectedListId;
    await writeState(state);
    const saved=await root.LeadIntelServerBridge.saveNow?.({saveIntent:true});
    if(saved?.saved!==true)throw new Error('The reference list has not synced to your workspace. Check workspace sync and retry analysis.');
    button.disabled=true;status(`Scraping reference customer websites… 0/${ready.length}`);
    let completed=0;
    const scraped=await mapLimit(ready,async row=>{const result=await scrapeRow(row);completed++;status(`Scraping reference customer websites… ${completed}/${ready.length}`);return result;});
    const evidence=scraped.filter(item=>item.ok).map(item=>item.value);const failures=scraped.length-evidence.length;
    if(!evidence.length)throw new Error('No reference customer websites could be read');
    status(`Running AI analysis on ${evidence.length} reference customers…`);
    const result=await AI.requestReferenceCustomerAnalysis({workspaceId:workspace,rows:evidence,seller:{website:state.website,offers:state.profile?.priorityOffers,idealCustomer:state.profile?.idealCustomer,targetMarkets:state.targetMarkets}});
    if(!Object.keys(result.analyses||{}).length)throw new Error('AI analysis returned no supported company classifications');
    for(const row of evidence){if(result.analyses[row.id])result.analyses[row.id].evidenceCoverage=row.coverage;}
    const coherentProfile=result.segmentationMeaningful?result:Ref.buildReferenceSegments(state.referenceCustomers.rows,result.analyses);
    state=readState();
    const savedList=state.referenceCustomerPortfolio?.lists?.find(list=>list.id===listId);
    const sameRows=ready.every(row=>savedList?.reference?.rows?.some(current=>current.id===row.id&&current.website===row.website)&&state.referenceCustomers?.rows?.some(current=>current.id===row.id&&current.website===row.website));
    if(workspaceId()!==workspace||!sameRows||state.referenceCustomerPortfolio?.selectedListId!==listId)
      throw new Error('The reference list changed during analysis. The results were not applied. Open the saved list and analyze it again.');
    state.referenceCustomers=Ref.normalizeReferenceState(state.referenceCustomers||{});
    state.referenceCustomers=Ref.markReferenceDraftChanged({
      ...state.referenceCustomers,
      analyses:result.analyses,
      segments:coherentProfile.segments,
      segmentationMeaningful:Boolean(coherentProfile.meaningful||coherentProfile.segmentationMeaningful),
      analyzedAt:new Date().toISOString()
    });
    state=Portfolio.syncCurrentList(state);
    await writeState(state);
    const synced=await root.LeadIntelServerBridge.saveNow?.({saveIntent:true});
    if(synced?.saved!==true)throw new Error('Analysis finished, but the result has not synced to your workspace. Check workspace sync before continuing.');
    status(`AI analysis complete · ${Object.keys(result.analyses).length} companies classified · ${evidence.reduce((total,row)=>total+(row.coverage?.pagesRead||1),0)} website pages read${failures?` · ${failures} websites need review`:''}. Review the Customer segments before activation.`);
  }
  document.addEventListener('click',async event=>{
    const button=(event.target?.closest?.('#reference-analyze')||event.target?.closest?.('[data-refresh-reference-analysis]'));if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(analysisRunning)return;
    analysisRunning=true;button.disabled=true;status('Starting company analysis…');
    try{await runAiAnalysis(button);}catch(error){status(clean(error?.message)||'AI analysis failed');}
    finally{analysisRunning=false;button.disabled=false;const visible=document.querySelector?.('[data-refresh-reference-analysis]');if(visible){visible.disabled=false;visible.setAttribute?.('aria-busy','false');visible.textContent='Refresh company analysis';}root.LeadIntelReferenceCustomerLibraryUI?.finishAnalysis?.();}
  },true);
  root.LeadIntelReferenceCustomerAIRuntime={runAiAnalysis};
})(globalThis);
