const MAIN_STORAGE_KEY="leadintel_customer_v2_state";
const DISCOVERY_STORAGE_KEY="leadintel_customer_v2_discovery";
const OUTREACH_STORAGE_KEY="leadintel_customer_v2_outreach";
const DELIVERY_STORAGE_KEY="leadintel_customer_v2_delivery";
const q=id=>document.getElementById(id);
let delivery=loadDelivery();

function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||"{}");}catch{return {};}}
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

function injectDeliveryUI(){
  if(!document.querySelector('link[href="delivery.css"]')){const link=document.createElement("link");link.rel="stylesheet";link.href="delivery.css";document.head.appendChild(link);}
  const steps=document.querySelector(".steps");
  if(steps&&!steps.querySelector('[data-step-marker="7"]'))steps.insertAdjacentHTML("beforeend",'<li data-step-marker="7"><span>07</span><div><strong>Delivery & learning</strong><small>Send, replies, outcomes</small></div></li>');
  const draftPanel=document.querySelector("#step-6 .outreach-drafts");
  if(draftPanel&&!q("continue-to-delivery"))draftPanel.insertAdjacentHTML("afterend",'<div class="delivery-entry"><div><span class="eyebrow">Next step</span><strong>Deliver approved outreach and teach LeadIntel what actually converts.</strong></div><button class="primary-btn" id="continue-to-delivery" type="button" disabled>Continue to Delivery & Learning →</button></div>');
  const content=document.querySelector("main.content");
  if(content&&!q("step-7"))content.insertAdjacentHTML("beforeend",`<section class="step-view" id="step-7" data-step="7">
    <div class="profile-header delivery-header"><div><span class="eyebrow">Step 7 · Delivery & Learning</span><h1>Close the loop between intelligence and revenue.</h1><p>Open the approved email in Gmail, confirm the real send, record replies and outcomes, then let LeadIntel learn which markets, signals, offers and messages are producing movement.</p></div><div class="profile-header-actions"><span class="profile-status" id="delivery-status">Ready</span><button class="secondary-btn small" id="back-to-outreach" type="button">← Dossier</button></div></div>

    <section class="panel connector-card"><div><span class="connector-badge"><i></i> Gmail Compose · Manual confirmation</span><h3>Controlled delivery bridge</h3><p>LeadIntel opens a prefilled Gmail draft from the approved package. You send it in Gmail, then explicitly confirm the send here.</p></div><div class="warning-note"><strong>Automatic Gmail sync is not connected.</strong><br>This prototype stores no Gmail credentials or OAuth tokens and never auto-sends.</div></section>

    <section class="panel"><div class="section-title"><span class="eyebrow">Approved opportunity</span><h3>Choose who you are contacting</h3><p>Only Step 6 packages that passed human approval are available for delivery.</p></div><div class="delivery-control-grid"><label>Opportunity<select id="delivery-company-select"></select></label><label>Recipient email<input id="delivery-recipient" type="email" autocomplete="email" placeholder="buyer@company.com"></label><div class="delivery-buttons"><button class="secondary-btn" id="open-gmail-draft" type="button">Open Gmail draft ↗</button><button class="primary-btn" id="confirm-delivery-sent" type="button">Confirm sent ✓</button></div></div>
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
function showDeliveryStep(){if(!approvedPackages().length){toast("Approve at least one outreach package first");return;}ensureSelection();renderAll();showStep(7);}
function showOutreachStep(){showStep(6);}

function openGmailDraft(){const pkg=currentPackage();if(!pkg){toast("Select an approved opportunity");return;}const url=LeadIntelDelivery.buildGmailComposeUrl(pkg,q("delivery-recipient").value);if(!url){toast("Enter a valid recipient email first");return;}window.open(url,"_blank","noopener,noreferrer");toast("Gmail draft opened · send it there, then confirm here");}
function confirmSent(){const pkg=currentPackage();if(!pkg){toast("Select an approved opportunity");return;}const result=LeadIntelDelivery.confirmSend(delivery,pkg,q("delivery-recipient").value,new Date().toISOString());if(result.error){toast(result.error);return;}delivery=result.state;saveDelivery();updatePipelineStage(pkg.domain,"Contacted");markOutreachContacted(pkg.domain,result.record.sentAt);renderAll();toast("Send confirmed · Pipeline moved to Contacted");}
function previewReply(){const text=q("reply-text")?.value||"";q("reply-classification").textContent=`Classification: ${text.trim()?LeadIntelDelivery.classifyReply(text).replaceAll("_"," "):"—"}`;}
function recordReply(){const record=currentRecord();if(!record?.sentAt){toast("Confirm the send before recording a reply");return;}const result=LeadIntelDelivery.recordReply(delivery,delivery.selectedDomain,q("reply-text").value,new Date().toISOString());if(result.error){toast(result.error);return;}delivery=result.state;saveDelivery();const target=LeadIntelDelivery.recommendedPipelineStage(result.record);updatePipelineStage(delivery.selectedDomain,target);q("reply-text").value="";renderAll();toast(`Reply recorded · ${result.record.latestReplyCategory.replaceAll("_"," ")} · Pipeline ${target}`);}
function recordOutcome(stage){const record=currentRecord();if(!record?.sentAt){toast("Confirm the send before recording an outcome");return;}const result=LeadIntelDelivery.recordOutcome(delivery,delivery.selectedDomain,stage,new Date().toISOString());if(result.error){toast(result.error);return;}delivery=result.state;saveDelivery();updatePipelineStage(delivery.selectedDomain,result.record.outcomeStage);renderAll();toast(`${result.record.company||delivery.selectedDomain} moved to ${result.record.outcomeStage}`);}
function exportLearningData(){const summary=LeadIntelDelivery.buildLearningSummary(delivery,approvedPackages(),pipeline(),3);const payload={schema_version:1,exported_at:new Date().toISOString(),connector:delivery.connector,delivery,learning:summary};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`leadintel-learning-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("Learning data exported");}

function crmStage(){return pipeline().find(item=>item.domain===delivery.selectedDomain)?.stage||LeadIntelDelivery.recommendedPipelineStage(currentRecord());}
function renderSelector(){const list=approvedPackages();const select=q("delivery-company-select");if(!select)return;select.innerHTML=list.length?list.map(item=>`<option value="${esc(item.domain)}" ${item.domain===delivery.selectedDomain?"selected":""}>${esc(item.company)} · ${esc(item.drafts?.tone||"consultative")}</option>`).join(""):'<option value="">No approved outreach packages</option>';const gate=q("continue-to-delivery");if(gate){gate.disabled=!list.length;gate.textContent=list.length?"Continue to Delivery & Learning →":"Approve an outreach package first";}const record=currentRecord();q("delivery-recipient").value=record?.recipientEmail||"";q("open-gmail-draft").disabled=!list.length;q("confirm-delivery-sent").disabled=!list.length;}
function renderState(){const record=currentRecord();q("delivery-crm-stage").textContent=crmStage();q("delivery-sent-at").textContent=record?.sentAt?new Date(record.sentAt).toLocaleString():"Not yet";q("delivery-reply-category").textContent=record?.latestReplyCategory?record.latestReplyCategory.replaceAll("_"," "):"—";q("delivery-outcome").textContent=record?.outcomeStage||"—";q("delivery-status").textContent=record?.outcomeStage||record?.latestReplyCategory?"Active":record?.sentAt?"Contacted":"Ready";q("reply-text").disabled=!record?.sentAt;q("record-reply").disabled=!record?.sentAt;document.querySelectorAll("[data-outcome-stage]").forEach(btn=>btn.disabled=!record?.sentAt);previewReply();}
function activityLabel(item){if(item.type==="message.sent")return "Message sent";if(item.type==="reply.received")return `Reply · ${item.category.replaceAll("_"," ")}`;if(item.type==="outcome.recorded")return `Outcome · ${item.stage}`;return item.type;}
function renderActivity(){const target=q("delivery-activity");if(!target)return;const rows=delivery.activity.filter(item=>!delivery.selectedDomain||item.domain===delivery.selectedDomain);target.innerHTML=rows.length?rows.map(item=>`<div class="activity-row"><span>${esc(item.type)}</span><strong>${esc(activityLabel(item))}</strong><small>${new Date(item.at).toLocaleString()}</small></div>`).join(""):'<div class="learning-empty">No delivery activity recorded for this opportunity yet.</div>';}
function metricCard(label,value){return `<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;}
function segmentCard(title,rows){return `<div class="learning-segment-card"><h4>${esc(title)}</h4>${rows.length?rows.slice(0,6).map(row=>`<div class="learning-segment-row"><strong>${esc(row.key)}</strong><span>${row.sent} sent</span><span>${row.replyRate}% reply</span><span>${row.meetingRate}% meet</span></div>`).join(""):'<div class="learning-empty">Not enough activity yet.</div>'}</div>`;}
function renderLearning(){const summary=LeadIntelDelivery.buildLearningSummary(delivery,approvedPackages(),pipeline(),3);const m=summary.metrics;q("learning-scorecard").innerHTML=[metricCard("Sent",m.sent),metricCard("Replies",`${m.replied} · ${m.replyRate}%`),metricCard("Meetings",`${m.meetings} · ${m.meetingRate}%`),metricCard("Proposals",m.proposals),metricCard("Won / Lost",`${m.won} / ${m.lost}`),metricCard("Win rate",`${m.winRate}%`)].join("");q("learning-segments").innerHTML=[segmentCard("By tone",summary.byTone),segmentCard("By market",summary.byMarket),segmentCard("By offer",summary.byOffer),segmentCard("By signal",summary.bySignal)].join("");q("learning-recommendations").innerHTML=summary.recommendations.length?summary.recommendations.map(item=>`<div>${esc(item)}</div>`).join(""):'<div class="learning-empty">No optimization recommendation yet. A segment needs at least 3 sends before LeadIntel treats it as a usable pattern.</div>';}
function renderAll(){ensureSelection();renderSelector();renderState();renderActivity();renderLearning();}
function bindDelivery(){q("continue-to-delivery")?.addEventListener("click",showDeliveryStep);q("back-to-outreach")?.addEventListener("click",showOutreachStep);q("delivery-company-select")?.addEventListener("change",e=>{delivery.selectedDomain=e.target.value;saveDelivery();renderAll();});q("open-gmail-draft")?.addEventListener("click",openGmailDraft);q("confirm-delivery-sent")?.addEventListener("click",confirmSent);q("reply-text")?.addEventListener("input",previewReply);q("record-reply")?.addEventListener("click",recordReply);q("step-7")?.addEventListener("click",e=>{const btn=e.target.closest("[data-outcome-stage]");if(btn)recordOutcome(btn.dataset.outcomeStage);});q("export-learning-data")?.addEventListener("click",exportLearningData);q("reset-workspace")?.addEventListener("click",()=>setTimeout(()=>{if(!localStorage.getItem(MAIN_STORAGE_KEY))localStorage.removeItem(DELIVERY_STORAGE_KEY);},0));}
function loadProductionSaas(){
  if(document.querySelector('script[data-server-bridge]'))return;
  const bridge=document.createElement('script');bridge.src='server-bridge.js';bridge.dataset.serverBridge='true';
  bridge.addEventListener('load',()=>{if(document.querySelector('script[data-production-gmail-ui]'))return;const ui=document.createElement('script');ui.src='production-gmail-ui.js';ui.dataset.productionGmailUi='true';document.body.appendChild(ui);});
  document.body.appendChild(bridge);
}
function initDelivery(){injectDeliveryUI();bindDelivery();renderAll();loadProductionSaas();}
initDelivery();
