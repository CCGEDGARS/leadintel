const MAIN_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const OUTREACH_STORAGE_KEY="leadintel_customer_v2_outreach";
const DELIVERY_STORAGE_KEY="leadintel_customer_v2_delivery";
  const ASSET_VERSION="20260916-brand-outreach-v5";
const SERVER_BRIDGE_ASSET="server-bridge.js?v=20260916-error-sweep-v2";
const asset=path=>`${path}?v=${ASSET_VERSION}`;
const q=id=>document.getElementById(id);
let delivery=loadDelivery();
function contentLanguage(){const main=readJson(MAIN_STORAGE_KEY);return LeadIntelContentLanguage.resolveLanguage(window.LeadIntelLanguage?.get?.()||main.uiLanguage||'lv',navigator.languages||[]);}

function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||"{}");}catch{return {};}}
function persistMainStep(step){const main=readJson(MAIN_STORAGE_KEY);main.step=Number(step)||1;localStorage.setItem(MAIN_STORAGE_KEY,JSON.stringify(main));}
function loadDelivery(){return LeadIntelDelivery.normalizeDeliveryState(readJson(DELIVERY_STORAGE_KEY));}
function saveDelivery(){delivery=LeadIntelDelivery.normalizeDeliveryState(delivery);localStorage.setItem(DELIVERY_STORAGE_KEY,JSON.stringify(delivery));}
function outreachState(){return LeadIntelOutreach.normalizeOutreachState(readJson(OUTREACH_STORAGE_KEY));}
function discoveryState(){return LeadIntelDiscovery.normalizeDiscoveryState(readJson(DISCOVERY_STORAGE_KEY));}
function saveDiscovery(value){localStorage.setItem(DISCOVERY_STORAGE_KEY,JSON.stringify(LeadIntelDiscovery.normalizeDiscoveryState(value)));}
function approvedPackages(){return outreachState().items.filter(item=>item.approved);}
function pipeline(){return discoveryState().pipeline||[];}
function currentPackage(){return approvedPackages().find(item=>item.domain===delivery.selectedDomain)||null;}
function currentRecord(){return delivery.opportunities.find(item=>item.domain===delivery.selectedDomain)||null;}
function toast(message){const el=q("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2600);}
function stageRank(stage){return LeadIntelDiscovery.CRM_STAGES.indexOf(stage);}
function updatePipelineStage(domain,target){
  const state=discoveryState();const item=state.pipeline.find(row=>row.domain===domain);if(!item)return false;
  const terminal=new Set(["Won","Lost"]);if(terminal.has(item.stage))return true;
  if(terminal.has(target)||stageRank(target)>stageRank(item.stage))item.stage=target;
  item.updatedAt=new Date().toISOString();saveDiscovery(state);return true;
}
function markOutreachContacted(domain,at){
  const state=outreachState();const item=state.items.find(row=>row.domain===domain);if(!item)return;
  item.contactedAt=item.contactedAt||at;localStorage.setItem(OUTREACH_STORAGE_KEY,JSON.stringify(state));
}
function crmBridge(){return window.LeadIntelServerBridge||null;}
function crmAuthenticated(){const b=crmBridge();return Boolean(b?.session?.authenticated&&b?.workspace);}
function crmDomain(value){return window.LeadIntelCrm?.canonicalDomain(value)||String(value||"").replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].toLowerCase();}
function crmActivityId(kind,domain,stamp){return `${kind}-${crmDomain(domain)}-${String(stamp||"")}`.replace(/[^A-Za-z0-9._:-]/g,"-").slice(0,128);}
async function durableCompany(domain){
  if(!crmAuthenticated())return {ok:true,localOnly:true,company:null};const b=crmBridge(),key=crmDomain(domain);const listed=await b.listCrmCompanies({q:key,limit:20});if(!listed.ok)return listed;
  let company=(listed.companies||[]).find(row=>crmDomain(row.normalized_domain||row.website)===key)||null;
  if(!company){const local=pipeline().find(row=>crmDomain(row.domain||row.website)===key);const payload=local&&window.LeadIntelCrm?.mapLocalPipelineItemToCrm(local);if(!payload)return {ok:false,error:"CRM company not found"};const saved=await b.saveCrmCompany(payload);if(!saved.ok)return saved;company=saved.company;}
  return {ok:true,company};
}
async function syncCrmDelivery(domain,{activity=null,stage="",markCustomer=false}={}){
  const resolved=await durableCompany(domain);if(!resolved.ok||resolved.localOnly)return resolved;const b=crmBridge(),company=resolved.company;
  if(activity){const recorded=await b.recordCrmActivity(company.id,activity);if(!recorded.ok)return recorded;}
  let latest=company;if(stage){const moved=await b.addCrmToPipeline(company.id,stage);if(!moved.ok)return moved;latest=moved.company||latest;}
  if(markCustomer){const customer=await b.markCrmCustomer(company.id);if(!customer.ok)return customer;latest=customer.company||latest;}
  window.dispatchEvent(new CustomEvent("leadintel:crm-changed",{detail:{company:latest}}));return {ok:true,company:latest};
}
async function outboundAllowed(domain){const resolved=await durableCompany(domain);if(!resolved.ok)return {ok:false,error:resolved.error||"CRM unavailable · unable to verify suppression"};if(resolved.localOnly)return {ok:true};if(resolved.company?.lifecycle_status==="suppressed")return {ok:false,error:"Suppressed companies cannot receive normal outreach"};return {ok:true,company:resolved.company};}

function injectDeliveryUI(){
  if(!document.querySelector('link[data-leadintel-asset="delivery-css"]')){const link=document.createElement("link");link.rel="stylesheet";link.href=asset("delivery.css");link.dataset.leadintelAsset="delivery-css";document.head.appendChild(link);}
  const steps=document.querySelector(".steps");
  if(steps&&!steps.querySelector('[data-step-marker="7"]'))steps.insertAdjacentHTML("beforeend",'<li data-step-marker="7"><span>07</span><div><strong>Delivery & learning</strong><small>Send, replies, outcomes</small></div></li>');
  const draftPanel=document.querySelector("#step-6 .outreach-drafts");
  if(draftPanel&&!q("continue-to-delivery"))draftPanel.insertAdjacentHTML("afterend",'<div class="delivery-entry"><div><span class="eyebrow">Next step</span><strong>Deliver approved content and teach LeadIntel what actually converts.</strong></div><button class="primary-btn" id="continue-to-delivery" type="button">Open Delivery & Learning →</button></div>');
  const content=document.querySelector("main.content");
  if(content&&!q("step-7"))content.insertAdjacentHTML("beforeend",`<section class="step-view" id="step-7" data-step="7">
    <div class="profile-header delivery-header"><div><span class="eyebrow">Step 7 · Delivery & Learning</span><h1>Close the loop between intelligence and revenue.</h1><p>This module is visible as soon as your website is set. Sending remains protected by a separate human approval gate: once a content package is approved, use Gmail or Microsoft mail, confirm the real send, record replies and outcomes, and let LeadIntel learn what converts.</p></div><div class="profile-header-actions"><span class="profile-status" id="delivery-status">Ready</span><button class="secondary-btn small" id="back-to-outreach" type="button">← Content & Scripts</button></div></div>

    <section class="panel connector-card"><div><span class="connector-badge"><i></i> Gmail Compose or Microsoft · Manual confirmation</span><h3>Controlled delivery bridge</h3><p>LeadIntel prepares delivery only from a human-approved content package. Connect Gmail or Microsoft mail to send the tailored message without leaving the workspace.</p></div><div class="warning-note"><strong>Production Gmail status loads here; Microsoft mail status appears beside it.</strong><br>Sending remains an explicit user action and LeadIntel never auto-sends.</div></section>

    <section class="panel"><div class="section-title"><span class="eyebrow">Approved opportunity</span><h3>Choose who you are contacting</h3><p>Only Step 6 content packages that passed human approval are eligible to send. If none exist yet, the controls remain safely disabled while the module stays open.</p></div><div class="delivery-control-grid"><label>Opportunity<select id="delivery-company-select"></select></label><label>Recipient email<input id="delivery-recipient" type="email" autocomplete="email" placeholder="buyer@company.com"></label><div class="delivery-buttons"><button class="secondary-btn" id="open-gmail-draft" type="button">Open Gmail draft ↗</button><button class="primary-btn" id="confirm-delivery-sent" type="button">Confirm sent ✓</button></div></div>
      <div class="delivery-state-grid"><article><span>CRM stage</span><strong id="delivery-crm-stage">Ready for Outreach</strong></article><article><span>Sent</span><strong id="delivery-sent-at">Not yet</strong></article><article><span>Latest reply</span><strong id="delivery-reply-category">—</strong></article><article><span>Outcome</span><strong id="delivery-outcome">—</strong></article></div>
    </section>

    <div class="reply-outcome-grid"><section class="panel reply-panel"><div class="section-title"><span class="eyebrow">Reply intelligence</span><h3>Record the reply</h3><p>Paste the customer response. LeadIntel classifies it conservatively and updates the pipeline automatically.</p></div><textarea id="reply-text" rows="7" placeholder="Paste the customer reply here..."></textarea><div id="reply-classification" class="reply-classification">Classification: —</div><button class="primary-btn" id="record-reply" type="button">Record reply</button></section>
      <section class="panel"><div class="section-title"><span class="eyebrow">Commercial outcome</span><h3>Advance the real sales stage</h3><p>Use outcomes only when they actually happen. Later stages never move backwards.</p></div><div class="outcome-buttons"><button class="secondary-btn" data-outcome-stage="Meeting" type="button">Meeting</button><button class="secondary-btn" data-outcome-stage="Proposal" type="button">Proposal</button><button class="secondary-btn" data-outcome-stage="Won" type="button">Won</button><button class="secondary-btn" data-outcome-stage="Lost" type="button">Lost</button></div></section></div>

    <section class="panel"><div class="section-title"><span class="eyebrow">Activity history</span><h3>What actually happened</h3></div><div id="delivery-activity" class="activity-list"></div></section>

    <section class="panel"><div class="section-title"><span class="eyebrow">Learning loop</span><h3>What LeadIntel is learning from outcomes</h3><p>Recommendations appear only after a segment has at least three sends. Until then, LeadIntel shows data without pretending a pattern is proven.</p></div><div id="learning-scorecard" class="learning-scorecard"></div><div id="learning-segments" class="learning-segments"></div><div id="learning-recommendations" class="learning-recommendations"></div><div class="learning-actions"><button class="secondary-btn small" id="export-learning-data" type="button">Export learning data</button></div></section>
  </section>`);
}
function showStep(step){document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===step));document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===step);el.classList.toggle("complete",n<step);});window.scrollTo({top:0,behavior:"smooth"});}
function ensureSelection(){const list=approvedPackages();if(!list.length){delivery.selectedDomain="";saveDelivery();return;}if(!list.some(item=>item.domain===delivery.selectedDomain))delivery.selectedDomain=list[0].domain;saveDelivery();}
function showDeliveryStep(){persistMainStep(7);ensureSelection();renderAll();showStep(7);}
function showOutreachStep(){persistMainStep(6);showStep(6);}

async function openGmailDraft(){const pkg=currentPackage();if(!pkg){toast("Select an approved opportunity");return;}const allowed=await outboundAllowed(pkg.domain);if(!allowed.ok){toast(allowed.error||"Suppressed company");return;}const url=LeadIntelDelivery.buildGmailComposeUrl(pkg,q("delivery-recipient").value);if(!url){toast("Enter a valid recipient email first");return;}window.open(url,"_blank","noopener,noreferrer");toast("Gmail draft opened · send it there, then confirm here");}
async function confirmSent(){const pkg=currentPackage();if(!pkg){toast("Select an approved opportunity");return;}const sentAt=new Date().toISOString();const result=LeadIntelDelivery.confirmSend(delivery,pkg,q("delivery-recipient").value,sentAt);if(result.error){toast(result.error);return;}delivery=result.state;saveDelivery();updatePipelineStage(pkg.domain,"Contacted");markOutreachContacted(pkg.domain,result.record.sentAt);const handed=sessionStorage.getItem("leadintel_email_crm_activity_key")||sessionStorage.getItem("leadintel_gmail_crm_activity_key")||"";const handedChannel=sessionStorage.getItem("leadintel_email_crm_channel")||"gmail";if(handed){sessionStorage.removeItem("leadintel_email_crm_activity_key");sessionStorage.removeItem("leadintel_email_crm_channel");sessionStorage.removeItem("leadintel_gmail_crm_activity_key");}const activityId=handed||crmActivityId("manual-send",pkg.domain,`${pkg.approvedAt||result.record.sentAt}-${result.record.recipientEmail}`);const channel=handed?handedChannel:"gmail-compose";const activity=LeadIntelDelivery.buildSentCrmActivity(pkg,result.record,{id:activityId,channel,api:Boolean(handed)});const crm=await syncCrmDelivery(pkg.domain,{activity,stage:"Contacted"});renderAll();toast(crm.ok?"Send confirmed · Pipeline moved to Contacted":"Send confirmed locally · CRM sync unavailable");}
function previewReply(){const text=q("reply-text")?.value||"";q("reply-classification").textContent=`Classification: ${text.trim()?LeadIntelDelivery.classifyReply(text).replaceAll("_"," "):"—"}`;}
async function recordReply(){const record=currentRecord();if(!record?.sentAt){toast("Confirm the send before recording a reply");return;}const replyAt=new Date().toISOString();const result=LeadIntelDelivery.recordReply(delivery,delivery.selectedDomain,q("reply-text").value,replyAt);if(result.error){toast(result.error);return;}delivery=result.state;saveDelivery();const target=LeadIntelDelivery.recommendedPipelineStage(result.record);updatePipelineStage(delivery.selectedDomain,target);const latest=result.record.replies?.[0];const crm=await syncCrmDelivery(delivery.selectedDomain,{activity:{id:crmActivityId("manual-reply",delivery.selectedDomain,latest?.at||replyAt),type:"email.reply_received",channel:"manual",direction:"inbound",summary:`Reply recorded · ${result.record.latestReplyCategory.replaceAll("_"," ")}`,occurred_at:latest?.at||replyAt,metadata:{category:result.record.latestReplyCategory}},stage:target});q("reply-text").value="";renderAll();toast(crm.ok?`Reply recorded · ${result.record.latestReplyCategory.replaceAll("_"," ")} · Pipeline ${target}`:`Reply recorded locally · CRM sync unavailable`);}
async function recordOutcome(stage){const record=currentRecord();if(!record?.sentAt){toast("Confirm the send before recording an outcome");return;}const outcomeAt=new Date().toISOString();const result=LeadIntelDelivery.recordOutcome(delivery,delivery.selectedDomain,stage,outcomeAt);if(result.error){toast(result.error);return;}delivery=result.state;saveDelivery();updatePipelineStage(delivery.selectedDomain,result.record.outcomeStage);const types={Meeting:"meeting.recorded",Proposal:"proposal.recorded",Won:"deal.won",Lost:"deal.lost"};const finalStage=result.record.outcomeStage;const crm=await syncCrmDelivery(delivery.selectedDomain,{activity:{id:crmActivityId(`outcome-${finalStage.toLowerCase()}`,delivery.selectedDomain,result.record.outcomeAt||outcomeAt),type:types[finalStage]||types[stage],summary:`Commercial outcome · ${finalStage}`,occurred_at:result.record.outcomeAt||outcomeAt,metadata:{stage:finalStage}},stage:finalStage,markCustomer:finalStage==="Won"});renderAll();toast(crm.ok?`${result.record.company||delivery.selectedDomain} moved to ${finalStage}`:`${result.record.company||delivery.selectedDomain} updated locally · CRM sync unavailable`);}
function exportLearningData(){const summary=LeadIntelDelivery.buildLearningSummary(delivery,approvedPackages(),pipeline(),3,contentLanguage());const payload={schema_version:1,exported_at:new Date().toISOString(),connector:delivery.connector,delivery,learning:summary};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`leadintel-learning-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("Learning data exported");}

function crmStage(){return pipeline().find(item=>item.domain===delivery.selectedDomain)?.stage||LeadIntelDelivery.recommendedPipelineStage(currentRecord());}
function renderSelector(){const list=approvedPackages();const select=q("delivery-company-select");if(!select)return;select.innerHTML=list.length?list.map(item=>`<option value="${esc(item.domain)}" ${item.domain===delivery.selectedDomain?"selected":""}>${esc(item.company)} · ${esc(item.drafts?.tone||"consultative")}</option>`).join(""):'<option value="">No approved content packages yet</option>';const gate=q("continue-to-delivery");if(gate){gate.disabled=false;gate.textContent="Open Delivery & Learning →";}const record=currentRecord();q("delivery-recipient").value=record?.recipientEmail||"";q("delivery-recipient").disabled=!list.length;q("open-gmail-draft").disabled=!list.length;q("confirm-delivery-sent").disabled=!list.length;}
function renderState(){const record=currentRecord();const packages=approvedPackages();q("delivery-crm-stage").textContent=packages.length?crmStage():"Waiting for approved package";q("delivery-sent-at").textContent=record?.sentAt?new Date(record.sentAt).toLocaleString():"Not yet";q("delivery-reply-category").textContent=record?.latestReplyCategory?record.latestReplyCategory.replaceAll("_"," "):"—";q("delivery-outcome").textContent=record?.outcomeStage||"—";q("delivery-status").textContent=record?.outcomeStage||record?.latestReplyCategory?"Active":record?.sentAt?"Contacted":packages.length?"Ready":"Waiting for package";q("reply-text").disabled=!record?.sentAt;q("record-reply").disabled=!record?.sentAt;document.querySelectorAll("[data-outcome-stage]").forEach(btn=>btn.disabled=!record?.sentAt);previewReply();}
function activityLabel(item){if(item.type==="message.sent")return "Message sent";if(item.type==="reply.received")return `Reply · ${item.category.replaceAll("_"," ")}`;if(item.type==="outcome.recorded")return `Outcome · ${item.stage}`;return item.type;}
function renderActivity(){const target=q("delivery-activity");if(!target)return;const rows=delivery.activity.filter(item=>!delivery.selectedDomain||item.domain===delivery.selectedDomain);target.innerHTML=rows.length?rows.map(item=>`<div class="activity-row"><span>${esc(item.type)}</span><strong>${esc(activityLabel(item))}</strong><small>${new Date(item.at).toLocaleString()}</small></div>`).join(""):'<div class="learning-empty">No delivery activity recorded for this opportunity yet.</div>';}
function metricCard(label,value){return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;}
function segmentCard(title,rows){return `<div class="learning-segment-card"><h4>${esc(title)}</h4>${rows.length?rows.slice(0,6).map(row=>`<div class="learning-segment-row"><strong>${esc(row.key)}</strong><span>${row.sent} sent</span><span>${row.replyRate}% reply</span><span>${row.meetingRate}% meet</span></div>`).join(""):'<div class="learning-empty">Not enough activity yet.</div>'}</div>`;}
function renderLearning(){const summary=LeadIntelDelivery.buildLearningSummary(delivery,approvedPackages(),pipeline(),3,contentLanguage());const m=summary.metrics;q("learning-scorecard").innerHTML=[metricCard("Sent",m.sent),metricCard("Replies",`${m.replied} · ${m.replyRate}%`),metricCard("Meetings",`${m.meetings} · ${m.meetingRate}%`),metricCard("Proposals",m.proposals),metricCard("Won / Lost",`${m.won} / ${m.lost}`),metricCard("Win rate",`${m.winRate}%`)].join("");q("learning-segments").innerHTML=[segmentCard("By tone",summary.byTone),segmentCard("By market",summary.byMarket),segmentCard("By offer",summary.byOffer),segmentCard("By signal",summary.bySignal)].join("");q("learning-recommendations").setAttribute('lang',contentLanguage());q("learning-recommendations").innerHTML=summary.recommendations.length?summary.recommendations.map(item=>`<div>${esc(item)}</div>`).join(""):'<div class="learning-empty">No optimization recommendation yet. A segment needs at least 3 sends before LeadIntel treats it as a usable pattern.</div>';}
function renderAll(){ensureSelection();renderSelector();renderState();renderActivity();renderLearning();}
function bindDelivery(){
  q("continue-to-delivery")?.addEventListener("click",showDeliveryStep);q("back-to-outreach")?.addEventListener("click",showOutreachStep);q("delivery-company-select")?.addEventListener("change",e=>{delivery.selectedDomain=e.target.value;saveDelivery();renderAll();});q("open-gmail-draft")?.addEventListener("click",openGmailDraft);q("confirm-delivery-sent")?.addEventListener("click",confirmSent);q("reply-text")?.addEventListener("input",previewReply);q("record-reply")?.addEventListener("click",recordReply);q("step-7")?.addEventListener("click",e=>{const btn=e.target.closest("[data-outcome-stage]");if(btn)recordOutcome(btn.dataset.outcomeStage);});q("export-learning-data")?.addEventListener("click",exportLearningData);q("reset-workspace")?.addEventListener("click",()=>setTimeout(()=>{if(!localStorage.getItem(MAIN_STORAGE_KEY))localStorage.removeItem(DELIVERY_STORAGE_KEY);},0));
  window.addEventListener("leadintel:module-opened",event=>{if(Number(event.detail?.step)!==7)return;persistMainStep(7);ensureSelection();renderAll();});
  window.addEventListener("leadintel:language-changed",renderAll);
}
function loadProductionSaas(){
  const loadMailboxUi=()=>{if(document.querySelector('script[data-production-gmail-ui]'))return;const ui=document.createElement('script');ui.src=asset('production-gmail-ui.js');ui.dataset.productionGmailUi='true';document.body.appendChild(ui);};
  if(document.querySelector('script[data-server-bridge]')){loadMailboxUi();return;}
  const bridge=document.createElement('script');bridge.src=SERVER_BRIDGE_ASSET;bridge.dataset.serverBridge='true';
  bridge.addEventListener('load',loadMailboxUi);
  document.body.appendChild(bridge);
}
function initDelivery(){injectDeliveryUI();bindDelivery();renderAll();if(readJson(MAIN_STORAGE_KEY).step===7)showDeliveryStep();loadProductionSaas();}
initDelivery();
import './content-variants.js?v=20260905-step1-language-v1';
