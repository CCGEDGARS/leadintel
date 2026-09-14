const MAIN_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const OUTREACH_STORAGE_KEY="leadintel_customer_v2_outreach";
const DELIVERY_STORAGE_KEY="leadintel_customer_v2_delivery";
const DISCOVERY_META_KEY="leadintel_customer_v2_discovery_meta";
const INTELLIGENCE_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
const MAX_DOSSIER_SEARCH_QUERIES=2;
const MAX_DOSSIER_RESULTS_PER_QUERY=5;
const ASSET_VERSION="20260828-master-crm-v1";
const LANGUAGE_ASSET_VERSION="20260914-workspace-isolation-v1";
const asset=path=>`${path}?v=${ASSET_VERSION}`;
const q=id=>document.getElementById(id);
let outreach=loadOutreach();
function contentLanguage(){const main=mainState();return LeadIntelContentLanguage.resolveLanguage(window.LeadIntelLanguage?.get?.()||main.uiLanguage||'lv',navigator.languages||[]);}

function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||"{}");}catch{return {};}}
function mainState(){return readJson(MAIN_STORAGE_KEY);}
function persistMainStep(step){
  const marker=document.querySelector(`[data-step-marker="${step}"]`);
  if(marker&&!marker.classList.contains("active")){marker.dispatchEvent(new MouseEvent("click",{bubbles:true}));return;}
  const main=mainState();main.step=step;localStorage.setItem(MAIN_STORAGE_KEY,JSON.stringify(main));
}
function discoveryState(){return LeadIntelDiscovery.normalizeDiscoveryState(readJson(DISCOVERY_STORAGE_KEY));}
function saveDiscovery(value){localStorage.setItem(DISCOVERY_STORAGE_KEY,JSON.stringify(LeadIntelDiscovery.normalizeDiscoveryState(value)));}
function loadOutreach(){return LeadIntelOutreach.normalizeOutreachState(readJson(OUTREACH_STORAGE_KEY));}
function saveOutreach(){outreach=LeadIntelOutreach.normalizeOutreachState(outreach);localStorage.setItem(OUTREACH_STORAGE_KEY,JSON.stringify(outreach));}
function toast(message){const el=q("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2600);}
function pipeline(){return discoveryState().pipeline||[];}
function selectedCandidate(){const domain=outreach.selectedDomain;return pipeline().find(item=>item.domain===domain)||null;}
function currentItem(){return outreach.items.find(item=>item.domain===outreach.selectedDomain)||null;}
function upsertItem(next){const idx=outreach.items.findIndex(item=>item.domain===next.domain);if(idx>=0)outreach.items[idx]=next;else outreach.items.unshift(next);outreach.items=outreach.items.slice(0,50);saveOutreach();return next;}
function stageAtLeast(current,target){const stages=LeadIntelDiscovery.CRM_STAGES;return stages.indexOf(current)>=stages.indexOf(target);}
function updatePipelineStage(domain,targetStage){
  const discovery=discoveryState();const item=discovery.pipeline.find(x=>x.domain===domain);if(!item)return false;
  if(!stageAtLeast(item.stage,targetStage))item.stage=targetStage;
  item.updatedAt=new Date().toISOString();saveDiscovery(discovery);return true;
}
function crmBridge(){return window.LeadIntelServerBridge||null;}
function crmAuthenticated(){const b=crmBridge();return Boolean(b?.session?.authenticated&&b?.workspace);}
function crmDomain(value){return window.LeadIntelCrm?.canonicalDomain(value)||String(value||"").replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].toLowerCase();}
function crmActivityId(kind,domain,stamp){return `${kind}-${crmDomain(domain)}-${String(stamp||"")}`.replace(/[^A-Za-z0-9._:-]/g,"-").slice(0,128);}
async function durableCompany(candidate){
  if(!candidate||!crmAuthenticated())return {ok:true,localOnly:true,company:null};
  const b=crmBridge(),domain=crmDomain(candidate.domain||candidate.website);const listed=await b.listCrmCompanies({q:domain,limit:20});if(!listed.ok)return listed;
  let company=(listed.companies||[]).find(row=>crmDomain(row.normalized_domain||row.website)===domain)||null;
  if(!company){const payload=window.LeadIntelCrm?.mapLocalPipelineItemToCrm(candidate);if(!payload)return {ok:false,error:"CRM mapper unavailable"};const saved=await b.saveCrmCompany(payload);if(!saved.ok)return saved;company=saved.company;}
  return {ok:true,company};
}
async function syncCrmActivity(candidate,{activity=null,stage=""}={}){
  const resolved=await durableCompany(candidate);if(!resolved.ok||resolved.localOnly)return resolved;const b=crmBridge(),company=resolved.company;
  if(activity){const recorded=await b.recordCrmActivity(company.id,activity);if(!recorded.ok)return recorded;}
  let latest=company;if(stage){const moved=await b.addCrmToPipeline(company.id,stage);if(!moved.ok)return moved;latest=moved.company||company;}
  window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company:latest}}));return {ok:true,company:latest};
}

function injectOutreachUI(){
  if(!document.querySelector('link[data-leadintel-asset="outreach-css"]')){const link=document.createElement("link");link.rel="stylesheet";link.href=asset("outreach.css");link.dataset.leadintelAsset="outreach-css";document.head.appendChild(link);}
  const steps=document.querySelector(".steps");
  if(steps&&!steps.querySelector('[data-step-marker="6"]'))steps.insertAdjacentHTML("beforeend",'<li data-step-marker="6"><span>06</span><div><strong>Content & Scripts</strong><small>Research, content, scripts</small></div></li>');
  const pipelinePanel=document.querySelector("#step-5 .pipeline-panel");
  if(pipelinePanel&&!q("continue-to-outreach"))pipelinePanel.insertAdjacentHTML("afterend",'<div class="outreach-entry"><div><span class="eyebrow">Next step</span><strong>Turn a saved opportunity into an evidence-backed conversation.</strong></div><button class="primary-btn" id="continue-to-outreach" type="button">Open Content & Scripts →</button></div>');
  const content=document.querySelector("main.content");
  if(content&&!q("step-6"))content.insertAdjacentHTML("beforeend",`<section class="step-view" id="step-6" data-step="6">
    <div class="profile-header outreach-header"><div><span class="eyebrow">Step 6 · Content & Scripts</span><h1>Turn intelligence into conversations that earn replies.</h1><p>The Content & Outreach Studio combines company research with practical sales execution. Build the evidence dossier, choose the buyer, then create and edit the email, LinkedIn message, call opener, follow-up and objection response. Nothing is sent automatically.</p></div><div class="profile-header-actions"><span class="profile-status" id="outreach-status">Ready</span><button class="secondary-btn small" id="back-to-discovery" type="button">← Discovery</button></div></div>
    <section class="panel dossier-selector"><div class="section-title"><span class="eyebrow">Opportunity research</span><h3>Choose a saved pipeline company</h3><p>Each dossier uses one official-site scrape and at most two targeted public searches. If the pipeline is empty, return to Discovery when you are ready to create an opportunity.</p></div><div class="dossier-select-row"><select id="outreach-company-select"></select><button class="primary-btn" id="build-opportunity-dossier" type="button">Build dossier ✦</button></div><div class="research-status" id="dossier-research-status">No saved company yet · module available.</div></section>
    <div id="dossier-workspace" hidden>
      <div class="dossier-summary-grid"><article class="dossier-card emphasis"><span>Why now</span><p id="dossier-why-now"></p></article><article class="dossier-card"><span>Recommended offer</span><strong id="dossier-offer"></strong><small id="dossier-confidence"></small></article><article class="dossier-card"><span>Buyer strategy</span><div id="dossier-buyers" class="buyer-chips"></div></article></div>
      <section class="panel dossier-panel"><div class="section-title"><span class="eyebrow">Evidence ledger</span><h3>What the recommendation is actually based on</h3><p>Official, public and inherited Discovery evidence remain distinguishable.</p></div><div id="dossier-evidence" class="dossier-evidence"></div></section>
      <section class="panel dossier-panel hypothesis-panel"><div class="section-title"><span class="eyebrow">Commercial hypotheses</span><h3>Questions to validate—not facts</h3></div><div id="dossier-hypotheses" class="hypothesis-list"></div></section>
      <section class="panel dossier-panel outreach-drafts"><div class="draft-head"><div class="section-title"><span class="eyebrow">Content & Scripts</span><h3>Create the complete conversation package</h3><p>Every output is evidence-aware, editable and human-approved. Regenerate all formats when you change buyer or tone.</p></div><div class="draft-controls"><select id="outreach-contact-select" aria-label="Decision maker"></select><select id="outreach-tone" aria-label="Outreach tone"><option value="consultative">Consultative</option><option value="direct">Direct</option><option value="brief">Brief</option></select><button class="secondary-btn small" id="regenerate-outreach" type="button">Regenerate all</button></div></div>
        <div class="script-grid">
          <article class="script-card script-card-wide"><div class="script-card-head"><div><span class="script-number">01</span><strong>Cold email</strong><small>Evidence-led first contact</small></div><button class="text-btn copy-btn" type="button" data-copy-field="email">Copy email</button></div><label class="draft-label">Subject<input id="outreach-email-subject" type="text"></label><label class="draft-label">Email body<textarea id="outreach-email-body" rows="10"></textarea></label></article>
          <article class="script-card"><div class="script-card-head"><div><span class="script-number">02</span><strong>LinkedIn message</strong><small>Short social first touch</small></div><button class="text-btn copy-btn" type="button" data-copy-field="linkedin">Copy</button></div><label class="draft-label">Message<textarea id="outreach-linkedin" rows="7"></textarea></label></article>
          <article class="script-card"><div class="script-card-head"><div><span class="script-number">03</span><strong>Call opener</strong><small>Permission-based opening</small></div><button class="text-btn copy-btn" type="button" data-copy-field="call">Copy</button></div><label class="draft-label">Opening script<textarea id="outreach-call-opener" rows="7"></textarea></label></article>
          <article class="script-card"><div class="script-card-head"><div><span class="script-number">04</span><strong>Follow-up email</strong><small>Close the loop without pressure</small></div><button class="text-btn copy-btn" type="button" data-copy-field="followup">Copy</button></div><label class="draft-label">Follow-up<textarea id="outreach-follow-up" rows="7"></textarea></label></article>
          <article class="script-card"><div class="script-card-head"><div><span class="script-number">05</span><strong>Objection / reply script</strong><small>Handle “not now” or “not relevant”</small></div><button class="text-btn copy-btn" type="button" data-copy-field="objection">Copy</button></div><label class="draft-label">Response<textarea id="outreach-objection-reply" rows="7"></textarea></label></article>
        </div>
        <div class="outreach-approval"><div><span class="eyebrow">Approval gate</span><strong id="outreach-approval-label">Draft not approved</strong><small>Approval moves the opportunity to Ready for Outreach. Sending remains a separate explicit action in Delivery & Learning.</small></div><div class="outreach-approval-actions"><button class="secondary-btn" id="mark-contacted" type="button" disabled>Mark contacted</button><button class="primary-btn" id="approve-outreach" type="button">Approve content package</button></div></div>
      </section>
    </div>
  </section>`);
}
function showStep(step){persistMainStep(step);document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===step));document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===step);el.classList.toggle("complete",n<step);});window.scrollTo({top:0,behavior:"smooth"});}
function showOutreachStep(){ensureSelection();renderAll();showStep(6);}
function backToDiscovery(){try{const meta=readJson(DISCOVERY_META_KEY);localStorage.setItem(DISCOVERY_META_KEY,JSON.stringify({...meta,visibleStep:5}));}catch{}showStep(5);}
function ensureSelection(){const list=pipeline();if(!list.length){outreach.selectedDomain="";saveOutreach();return;}if(!list.some(x=>x.domain===outreach.selectedDomain))outreach.selectedDomain=list[0].domain;saveOutreach();}

async function officialScrape(candidate){
  const response=await fetch(`${INTELLIGENCE_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:candidate.website,formats:["markdown"],onlyMainContent:true,timeout:30000})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Official site returned ${response.status}`);
  return LeadIntelOutreach.normalizeDossierResearchResults(payload,{domain:candidate.domain,sourceType:"official",url:candidate.website});
}
async function dossierSearch(meta){
  const response=await fetch(`${INTELLIGENCE_PROXY}/firecrawl-search`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:meta.query,limit:MAX_DOSSIER_RESULTS_PER_QUERY,scrapeOptions:{formats:["markdown"]}})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Dossier search returned ${response.status}`);
  return LeadIntelOutreach.normalizeDossierResearchResults(payload,{domain:meta.domain,sourceType:"search"});
}
async function buildDossier(){
  const candidate=selectedCandidate();if(!candidate){toast("Choose a saved pipeline company");return;}
  const main=mainState();let item=currentItem()||{domain:candidate.domain,company:candidate.company,drafts:{tone:"consultative",emailSubject:"",emailBody:"",linkedinMessage:"",callOpener:"",followUp:"",objectionReply:""},approved:false};
  item={...item,company:candidate.company,researchStatus:"running",approved:false,approvedAt:"",contactedAt:""};upsertItem(item);renderAll();
  const research=[];let failures=0;try{research.push(...await officialScrape(candidate));}catch{failures++;}
  const queries=LeadIntelOutreach.buildDossierSearchQueries(candidate,main.profile||{},main.market||{},MAX_DOSSIER_SEARCH_QUERIES);for(const meta of queries){try{research.push(...await dossierSearch(meta));}catch{failures++;}}
  const language=contentLanguage();const dossier=LeadIntelOutreach.buildOpportunityDossier(candidate,main.profile||{},main.market||{},research,language);const contact=candidate.people?.[0]||null;const tone=item.drafts?.tone||"consultative";
  item={...item,dossier,researchStatus:research.length?(failures?"partial":"complete"):"error",researchAt:new Date().toISOString(),selectedPersonId:contact?.id||"",drafts:LeadIntelOutreach.buildOutreachDrafts(dossier,contact,main.profile||{},tone,language),contentLanguage:language,approved:false,approvedAt:""};upsertItem(item);
  const crm=await syncCrmActivity(candidate,{activity:{id:crmActivityId("dossier-built",candidate.domain,item.researchAt),type:"dossier.built",summary:"Opportunity dossier built",occurred_at:item.researchAt,metadata:{evidence_count:dossier.evidence?.length||0,research_status:item.researchStatus}}});renderAll();
  const baseMessage=research.length?`Dossier built from ${dossier.evidence.length} evidence source${dossier.evidence.length===1?"":"s"}${failures?" · some research unavailable":""}`:"Dossier kept conservative because public research was unavailable";toast(!crm.ok?`${baseMessage} · CRM sync unavailable`:baseMessage);
}
function selectedContact(item){if(!item?.dossier?.people?.length)return null;return item.dossier.people.find(p=>p.id===item.selectedPersonId)||item.dossier.people[0];}
function regenerateDrafts(){const item=currentItem();if(!item?.dossier)return;if(item.approved){toast("Approved package is locked. Rebuild the dossier to create a new draft.");return;}item.selectedPersonId=q("outreach-contact-select").value;item.drafts=LeadIntelOutreach.buildOutreachDrafts(item.dossier,selectedContact(item),mainState().profile||{},q("outreach-tone").value,contentLanguage());item.contentLanguage=contentLanguage();upsertItem(item);renderDossier();}
function readDraftEdits(){const item=currentItem();if(!item)return null;item.drafts={tone:q("outreach-tone").value,emailSubject:q("outreach-email-subject").value.trim(),emailBody:q("outreach-email-body").value,linkedinMessage:q("outreach-linkedin").value,callOpener:q("outreach-call-opener").value,followUp:q("outreach-follow-up").value,objectionReply:q("outreach-objection-reply").value};upsertItem(item);return item;}
async function approveOutreach(){let item=readDraftEdits();if(!item?.dossier){toast("Build the dossier first");return;}item=LeadIntelOutreach.approveOutreachItem(item,item.drafts,new Date().toISOString());upsertItem(item);if(!item.approved){toast(item.error);renderDossier();return;}updatePipelineStage(item.domain,"Ready for Outreach");const candidate=selectedCandidate()||{domain:item.domain,company:item.company,stage:"Ready for Outreach"};const crm=await syncCrmActivity(candidate,{activity:{id:crmActivityId("content-approved",item.domain,item.approvedAt),type:"content.approved",summary:"Outreach content package approved",occurred_at:item.approvedAt,metadata:{tone:item.drafts?.tone||"",selected_person_id:item.selectedPersonId||""}},stage:"Ready for Outreach"});renderDossier();toast(crm.ok?"Content package approved · Pipeline is Ready for Outreach":"Content approved locally · CRM sync unavailable");}
async function markContacted(){const item=currentItem();if(!item?.approved){toast("Approve the content package first");return;}updatePipelineStage(item.domain,"Contacted");item.contactedAt=new Date().toISOString();upsertItem(item);const candidate=selectedCandidate()||{domain:item.domain,company:item.company,stage:"Contacted"};const crm=await syncCrmActivity(candidate,{stage:"Contacted"});renderDossier();toast(crm.ok?"Opportunity marked Contacted":"Contacted locally · CRM sync unavailable");}
async function copyField(type){
  const item=readDraftEdits();if(!item)return;
  const values={email:`${item.drafts.emailSubject}\n\n${item.drafts.emailBody}`,linkedin:item.drafts.linkedinMessage,call:item.drafts.callOpener,followup:item.drafts.followUp,objection:item.drafts.objectionReply};
  const labels={email:"Email",linkedin:"LinkedIn message",call:"Call opener",followup:"Follow-up",objection:"Objection reply"};
  try{await navigator.clipboard.writeText(values[type]||"");toast(`${labels[type]||"Script"} copied`);}catch{toast("Copy was blocked by the browser");}
}

function renderSelector(){const list=pipeline();const select=q("outreach-company-select");if(!select)return;select.innerHTML=list.length?list.map(item=>`<option value="${esc(item.domain)}" ${item.domain===outreach.selectedDomain?"selected":""}>${esc(item.company)} · ${esc(item.stage)} · ${item.score?.total||0}/100</option>`).join(""):'<option value="">No saved companies yet</option>';const gate=q("continue-to-outreach");if(gate){gate.disabled=!list.length;gate.textContent=list.length?"Open Content & Scripts →":"Save an opportunity first";}q("build-opportunity-dossier").disabled=!list.length;}
function renderDossier(){const item=currentItem();const workspace=q("dossier-workspace");if(!workspace)return;if(!item?.dossier){workspace.hidden=true;q("dossier-research-status").textContent=item?.researchStatus==="running"?"Researching official and public sources…":pipeline().length?"Choose a saved company and build its dossier.":"No saved company yet. Use Discovery to create a pipeline opportunity when ready.";q("outreach-status").textContent=pipeline().length?"Ready":"Waiting for opportunity";return;}workspace.hidden=false;const d=item.dossier;q("dossier-research-status").textContent=item.researchStatus==="partial"?`Dossier built · ${d.evidence.length} sources · some research unavailable`:item.researchStatus==="error"?"Dossier built conservatively from existing evidence; deep research was unavailable.":`Dossier ready · ${d.evidence.length} evidence sources`;
  q("dossier-why-now").textContent=d.whyNow;q("dossier-offer").textContent=d.recommendedOffer||"Not yet defined";q("dossier-confidence").textContent=`Discovery confidence: ${d.confidence||"Low"}`;
  q("dossier-buyers").innerHTML=d.buyerRoles?.length?d.buyerRoles.map(role=>`<span>${esc(role)}</span>`).join(""):'<span>Not yet defined</span>';
  q("dossier-evidence").innerHTML=d.evidence?.length?d.evidence.map(e=>`<a href="${esc(e.url)}" target="_blank" rel="noopener"><span class="evidence-type ${esc(e.sourceType).toLowerCase()}">${esc(e.sourceType)}</span><strong>${esc(e.title||e.url)}</strong><small>${esc(e.description||e.text).slice(0,230)}</small>${e.date?`<em>${esc(e.date)}</em>`:""}</a>`).join(""):'<div class="market-empty">No additional evidence was available. LeadIntel did not invent replacement facts.</div>';
  q("dossier-hypotheses").innerHTML=d.hypotheses?.length?d.hypotheses.map(h=>`<div>${esc(h)}</div>`).join(""):'<div>No commercial hypothesis added without evidence.</div>';
  const contact=q("outreach-contact-select");contact.innerHTML=d.people?.length?d.people.map(p=>`<option value="${esc(p.id)}" ${p.id===item.selectedPersonId?"selected":""}>${esc(p.name)} · ${esc(p.title)}</option>`).join(""):`<option value="">Role-based outreach · no named contact</option>`;
  q("outreach-tone").value=item.drafts?.tone||"consultative";q("outreach-email-subject").value=item.drafts?.emailSubject||"";q("outreach-email-body").value=item.drafts?.emailBody||"";q("outreach-linkedin").value=item.drafts?.linkedinMessage||"";q("outreach-call-opener").value=item.drafts?.callOpener||"";q("outreach-follow-up").value=item.drafts?.followUp||"";q("outreach-objection-reply").value=item.drafts?.objectionReply||"";
  [q("outreach-contact-select"),q("outreach-tone"),q("outreach-email-subject"),q("outreach-email-body"),q("outreach-linkedin"),q("outreach-call-opener"),q("outreach-follow-up"),q("outreach-objection-reply"),q("regenerate-outreach")].forEach(el=>{if(el)el.disabled=Boolean(item.approved);});
  q("approve-outreach").disabled=Boolean(item.approved);q("approve-outreach").textContent=item.approved?"Approved ✓":"Approve content package";q("mark-contacted").disabled=!item.approved||Boolean(item.contactedAt);q("mark-contacted").textContent=item.contactedAt?"Contacted ✓":"Mark contacted";
  q("outreach-approval-label").textContent=item.contactedAt?`Contacted · ${new Date(item.contactedAt).toLocaleString()}`:item.approved?`Approved · ${new Date(item.approvedAt).toLocaleString()}`:"Draft not approved";q("outreach-status").textContent=item.contactedAt?"Contacted":item.approved?"Approved":"Draft";q("outreach-status").classList.toggle("approved",Boolean(item.approved));
}
function localizeVisibleItem(){const item=currentItem();if(!item||item.approved)return;const main=mainState();const localized=LeadIntelOutreach.localizeGeneratedItem(item,selectedCandidate()||item.dossier,main.profile||{},main.market||{},contentLanguage());if(localized!==item)upsertItem(localized);}
function renderAll(){ensureSelection();localizeVisibleItem();renderSelector();renderDossier();}
function bindOutreach(){
  q("continue-to-outreach")?.addEventListener("click",showOutreachStep);q("back-to-discovery")?.addEventListener("click",backToDiscovery);q("outreach-company-select")?.addEventListener("change",e=>{outreach.selectedDomain=e.target.value;saveOutreach();renderDossier();});q("build-opportunity-dossier")?.addEventListener("click",buildDossier);q("regenerate-outreach")?.addEventListener("click",regenerateDrafts);q("approve-outreach")?.addEventListener("click",approveOutreach);q("mark-contacted")?.addEventListener("click",markContacted);q("dossier-workspace")?.addEventListener("click",e=>{const btn=e.target.closest("[data-copy-field]");if(btn)copyField(btn.dataset.copyField);});q("reset-workspace")?.addEventListener("click",()=>setTimeout(()=>{if(!localStorage.getItem(MAIN_STORAGE_KEY))localStorage.removeItem(OUTREACH_STORAGE_KEY);},0));
  window.addEventListener("leadintel:module-opened",event=>{if(Number(event.detail?.step)!==6)return;ensureSelection();renderAll();});
  window.addEventListener("leadintel:website-activated",()=>{
    outreach=LeadIntelOutreach.normalizeOutreachState({});
    localStorage.removeItem(OUTREACH_STORAGE_KEY);
    localStorage.removeItem(DELIVERY_STORAGE_KEY);
    renderAll();
  });
  window.addEventListener("leadintel:language-changed",renderAll);
}
function loadDeliveryModules(){
  if(document.querySelector('script[data-delivery-engine]'))return;
  const engine=document.createElement("script");engine.src=`delivery-engine.js?v=${LANGUAGE_ASSET_VERSION}`;engine.dataset.deliveryEngine="true";
  engine.addEventListener("load",()=>{if(document.querySelector('script[data-delivery-ui]'))return;const ui=document.createElement("script");ui.type="module";ui.src=`delivery-ui.js?v=${LANGUAGE_ASSET_VERSION}`;ui.dataset.deliveryUi="true";document.body.appendChild(ui);});
  document.body.appendChild(engine);
}
function initOutreach(){injectOutreachUI();bindOutreach();renderAll();if(mainState().step===6)showOutreachStep();loadDeliveryModules();}
initOutreach();
import './content-variants.js?v=20260905-step1-language-v1';