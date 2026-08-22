const STORAGE_KEY="leadintel_customer_v2_state";
const FIRECRAWL_PROXY="https://apollo-proxy.edgars-7e7.workers.dev";
const PDFJS_VERSION="6.2.108";
const MAX_PDF_BYTES=15*1024*1024;
const MAX_PDFS=5;
const profileFields=[
  ["companyOverview","Company overview",true],["priorityOffers","Priority offers",false],["idealCustomer","Ideal customer profile",false],
  ["lookalikeCustomers","Lookalike customers",false],["decisionMakers","Decision makers",false],["currentMarkets","Current market footprint",false],
  ["targetMarkets","Priority growth markets",false],["differentiation","Competitive advantages",false],["buyingTriggers","Buying situations / triggers",true],
  ["exclusions","Negative ICP / exclusions",false],["opportunityValue","Commercial value",false],["commercialObjective","6–12 month commercial objective",true]
];
let state=loadState();
let editMode=false;
let pdfModule=null;
const $=id=>document.getElementById(id);

function defaultState(){return LeadIntelProfile.normalizeSavedState({step:1,website:"",additionalLinks:[],documents:[],answers:{},scrapedSources:[],profile:null,approved:false});}
function loadState(){try{return LeadIntelProfile.normalizeSavedState(JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"));}catch{return defaultState();}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateCompleteness();}
function esc(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function showToast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove("show"),2200);}
function setStep(step){state.step=step;saveState();document.querySelectorAll(".step-view").forEach(el=>el.classList.toggle("active",Number(el.dataset.step)===step));document.querySelectorAll("[data-step-marker]").forEach(el=>{const n=Number(el.dataset.stepMarker);el.classList.toggle("active",n===step);el.classList.toggle("complete",n<step);});window.scrollTo({top:0,behavior:"smooth"});}
function updateCompleteness(){const score=LeadIntelProfile.calculateCompleteness(state);$("completeness-score").textContent=`${score}%`;$("progress-ring").style.setProperty("--p",score);$("completeness-caption").textContent=score<10?"Add your website to begin.":score<70?"More strategic context will improve targeting.":score<95?"Strong context. Complete remaining answers for best results.":"Ready for intelligence analysis.";}
function syncInputsFromState(){$("company-website").value=state.website.replace(/^https?:\/\//,"").replace(/\/$/,"");$("additional-links").value=state.additionalLinks.join("\n");document.querySelectorAll("[data-question]").forEach(el=>el.value=state.answers[el.dataset.question]||"");renderDocuments();}
function readSources(){state.website=LeadIntelProfile.normalizeUrl($("company-website").value);state.additionalLinks=$("additional-links").value.split(/\n/).map(LeadIntelProfile.normalizeUrl).filter(Boolean).slice(0,8);saveState();}
function readAnswers(){document.querySelectorAll("[data-question]").forEach(el=>{state.answers[el.dataset.question]=el.value.trim();});saveState();}
function validateStep1(){readSources();if(!state.website){$("step1-error").textContent="Enter a valid company website.";return false;}$("step1-error").textContent="";return true;}
function validateStep2(){readAnswers();const required=LeadIntelProfile.QUESTION_IDS.filter(id=>id!=="lookalike_customers");const missing=required.filter(id=>!state.answers[id]);if(missing.length){$("step2-error").textContent=`Complete ${missing.length} required question${missing.length===1?"":"s"}.`;document.querySelector(`[data-question="${missing[0]}"]`)?.focus();return false;}$("step2-error").textContent="";return true;}

async function getPdfModule(){
  if(pdfModule)return pdfModule;
  pdfModule=await import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`);
  pdfModule.GlobalWorkerOptions.workerSrc=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  return pdfModule;
}
async function extractPdf(file){
  const pdfjs=await getPdfModule();
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
  let text="";
  for(let pageNo=1;pageNo<=pdf.numPages&&text.length<25000;pageNo++){
    const page=await pdf.getPage(pageNo);const content=await page.getTextContent();text+=content.items.map(item=>item.str).join(" ")+"\n";
  }
  return text.replace(/\s+/g," ").trim().slice(0,25000);
}
async function handlePdfFiles(files){
  const room=Math.max(0,MAX_PDFS-state.documents.length);const selected=[...files].filter(file=>file.type==="application/pdf"||/\.pdf$/i.test(file.name)).slice(0,room);
  if(!selected.length){showToast(room?"Choose PDF files":"Maximum 5 PDFs reached");return;}
  for(const file of selected){
    if(file.size>MAX_PDF_BYTES){state.documents.push({name:file.name,size:file.size,text:"",status:"too-large"});renderDocuments();continue;}
    const doc={name:file.name,size:file.size,text:"",status:"extracting"};state.documents.push(doc);renderDocuments();
    try{doc.text=await extractPdf(file);doc.status=doc.text?"ready":"no-text";}catch{doc.status="error";doc.text="";}
    state.documents=state.documents.slice(0,MAX_PDFS);saveState();renderDocuments();
  }
}
function renderDocuments(){const list=$("document-list");if(!state.documents.length){list.innerHTML="";return;}list.innerHTML=state.documents.map((doc,index)=>`<div class="doc-item"><div><span>PDF</span><div><strong>${esc(doc.name)}</strong><small>${formatBytes(doc.size)} · ${doc.text?`${Math.round(doc.text.length/100)/10}k chars extracted`:statusLabel(doc.status)}</small></div></div><div><span class="doc-status">${doc.status==="ready"?"READY":doc.status==="extracting"?"READING…":"REVIEW"}</span><button class="doc-remove" type="button" data-remove-doc="${index}" aria-label="Remove ${esc(doc.name)}">×</button></div></div>`).join("");}
function formatBytes(bytes){return bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;}
function statusLabel(status){return {"too-large":"over 15 MB","no-text":"no extractable text","error":"text extraction failed","extracting":"extracting text"}[status]||"pending";}

async function scrapeSource(url,type){
  const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,timeout:30000})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`Source returned ${response.status}`);
  const data=payload.data||payload;
  const text=String(data.markdown||data.content||"").slice(0,30000);
  if(!text.trim())throw new Error("No readable page content returned");
  return {type,url,title:data.metadata?.title||data.title||new URL(url).hostname,text,status:"ready"};
}
function analysisStatus(title,caption){$("analysis-title").textContent=title;$("analysis-caption").textContent=caption;}
function analysisLog(label,status="done"){$("analysis-log").insertAdjacentHTML("beforeend",`<span>${status==="done"?"✓":"!"} ${esc(label)}</span>`);}
async function analyzeCompany(){
  if(!validateStep2())return;
  setStep(3);$("profile-content").hidden=true;$("analysis-state").hidden=false;$("analysis-log").innerHTML="";state.scrapedSources=[];state.approved=false;
  const sources=[{url:state.website,type:"website"},...state.additionalLinks.map(url=>({url,type:"link"}))];
  analysisStatus("Reading company sources…","Public source failures will not block the profile; they will be shown as intelligence gaps.");
  for(const [index,source] of sources.entries()){
    try{const result=await scrapeSource(source.url,source.type);state.scrapedSources.push(result);analysisLog(index===0?"Main website":`Additional source ${index}`);}catch(error){analysisLog(index===0?"Main website unavailable":`Source ${index} unavailable`,"warn");state.scrapedSources.push({type:source.type,url:source.url,title:"",text:"",status:`error: ${error.message}`});}
  }
  const usable=state.scrapedSources.filter(x=>x.text);
  analysisStatus("Synthesizing strategic context…","Your answers remain authoritative when they conflict with public website wording.");
  analysisLog(`${usable.length}/${sources.length} web sources readable`);analysisLog(`${state.documents.filter(d=>d.text).length} PDFs with extracted text`);
  await new Promise(resolve=>setTimeout(resolve,450));
  state.profile=LeadIntelProfile.buildCompanyIntelligenceProfile({...state,scrapedSources:usable});
  saveState();analysisLog("Company Intelligence Profile built");
  await new Promise(resolve=>setTimeout(resolve,350));
  $("analysis-state").hidden=true;$("profile-content").hidden=false;renderProfile();
}
function fieldValue(profile,key){const value=profile?.[key];return Array.isArray(value)?value.join("; "):String(value||"");}
function renderProfile(){
  const p=state.profile;if(!p)return;
  $("profile-company-name").textContent=p.companyName||"Company";$("profile-mission").textContent=p.mission;$("profile-completeness").textContent=`${p.completeness}%`;
  $("profile-editor").innerHTML=profileFields.map(([key,label,wide])=>`<div class="profile-field ${wide?"wide":""}"><label for="profile-${key}">${esc(label)}</label><textarea id="profile-${key}" data-profile-field="${key}" rows="${wide?3:2}" ${editMode?"":"readonly"}>${esc(fieldValue(p,key))}</textarea></div>`).join("");
  $("recommended-signals").innerHTML=(p.recommendedSignals||[]).map((signal,index)=>`<label class="signal-item"><input type="checkbox" data-signal-index="${index}" ${signal.active===false?"":"checked"}><div><strong>${esc(signal.name)}</strong><small>${esc(signal.reason)}</small></div><span class="priority">${esc(signal.priority)}</span></label>`).join("");
  $("source-summary").innerHTML=`<span class="source-chip">Website ${p.sourceSummary.website}</span><span class="source-chip">Additional links ${p.sourceSummary.additionalLinks}</span><span class="source-chip">PDFs ${p.sourceSummary.documents}</span><span class="source-chip">Total evidence sources ${p.sourceSummary.total}</span>`;
  $("evidence-digest").textContent=p.evidenceDigest||"No readable public/document evidence was collected. The profile currently relies on strategic answers.";
  const gaps=p.informationGaps||[];$("information-gaps").innerHTML=gaps.length?gaps.map(x=>`<div class="gap-item">${esc(x)}</div>`).join(""):`<div class="gap-item good">No critical context gaps detected for this onboarding stage.</div>`;
  updateApprovalUI();
}
function saveProfileEdits(){
  document.querySelectorAll("[data-profile-field]").forEach(el=>{const key=el.dataset.profileField;state.profile[key]=key==="currentMarkets"?el.value.split(/;|,/).map(x=>x.trim()).filter(Boolean):el.value.trim();});
  document.querySelectorAll("[data-signal-index]").forEach(el=>{if(state.profile.recommendedSignals[Number(el.dataset.signalIndex)])state.profile.recommendedSignals[Number(el.dataset.signalIndex)].active=el.checked;});
  state.approved=false;saveState();
}
function toggleEdit(){
  if(editMode){saveProfileEdits();editMode=false;$("edit-profile").textContent="Edit profile";showToast("Profile edits saved");}else{editMode=true;$("edit-profile").textContent="Save edits";}
  renderProfile();
}
function approveProfile(){saveProfileEdits();state.approved=true;state.profile.approvedAt=new Date().toISOString();saveState();editMode=false;renderProfile();showToast("Company Intelligence Profile approved");}
function updateApprovalUI(){const approved=state.approved;$("profile-status").textContent=approved?"Approved":"Draft";$("profile-status").classList.toggle("approved",approved);$("approve-profile").textContent=approved?"Approved ✓":"Approve profile";$("approve-profile").disabled=approved;$("approve-profile-bottom").textContent=approved?"Approved · ready for Market Opportunity Engine":"Approve Company Intelligence Profile";$("approve-profile-bottom").disabled=approved;$("approval-card").classList.toggle("approved",approved);}
function resetWorkspace(){if(!window.confirm("Start over? This clears this browser's LeadIntel customer onboarding workspace."))return;localStorage.removeItem(STORAGE_KEY);state=defaultState();editMode=false;syncInputsFromState();setStep(1);showToast("Customer workspace reset");}

function bind(){
  $("company-website").addEventListener("input",()=>{readSources();});$("additional-links").addEventListener("input",readSources);
  document.querySelectorAll("[data-question]").forEach(el=>el.addEventListener("input",readAnswers));
  $("to-questionnaire").addEventListener("click",()=>{if(validateStep1())setStep(2);});$("back-to-sources").addEventListener("click",()=>setStep(1));$("analyze-company").addEventListener("click",analyzeCompany);
  $("pdf-input").addEventListener("change",e=>handlePdfFiles(e.target.files));
  $("document-list").addEventListener("click",e=>{const btn=e.target.closest("[data-remove-doc]");if(!btn)return;state.documents.splice(Number(btn.dataset.removeDoc),1);saveState();renderDocuments();});
  const zone=$("upload-zone");["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add("dragging");}));["dragleave","drop"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove("dragging");}));zone.addEventListener("drop",e=>handlePdfFiles(e.dataTransfer.files));
  $("edit-profile").addEventListener("click",toggleEdit);$("approve-profile").addEventListener("click",approveProfile);$("approve-profile-bottom").addEventListener("click",approveProfile);$("improve-profile").addEventListener("click",()=>setStep(1));$("reset-workspace").addEventListener("click",resetWorkspace);
}
function init(){syncInputsFromState();bind();updateCompleteness();setStep(state.step||1);if(state.step===3&&state.profile){$("analysis-state").hidden=true;$("profile-content").hidden=false;renderProfile();}}
init();