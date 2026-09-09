const COPILOT_FILE_XLSX_VERSION='0.18.5';
const COPILOT_FILE_FIRECRAWL='https://apollo-proxy.edgars-7e7.workers.dev';
const COPILOT_FILE_STORAGE_KEY='leadintel_customer_v2_state';

const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let currentRows=[];
let currentFileName='';

function normalizedOutputRows(rows=[]){
  return [...rows].map(row=>({
    companyName:clean(row.companyName),
    website:clean(row.website),
    status:clean(row.outputStatus||row.status||'Needs review'),
    confidence:clean(row.confidence||'')
  })).filter(row=>row.companyName).sort((a,b)=>{
    const rank=value=>value==='Ready'?0:value==='Found'?1:2;
    return rank(a.status)-rank(b.status)||a.companyName.localeCompare(b.companyName,undefined,{sensitivity:'base'});
  });
}

function csvCell(value){const text=String(value??'');return /[",\n\r]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
function cleanedCsv(rows=[]){
  const out=normalizedOutputRows(rows);
  return ['Company Name,Website,Status,Confidence',...out.map(row=>[row.companyName,row.website,row.status,row.confidence].map(csvCell).join(','))].join('\n');
}

function setPanelStatus(text){const node=document.querySelector('[data-copilot-file-status]');if(node)node.textContent=String(text||'');}
function renderRows(){
  const host=document.querySelector('[data-copilot-file-results]');if(!host)return;
  const rows=normalizedOutputRows(currentRows);
  if(!rows.length){host.innerHTML='';return;}
  const ready=rows.filter(row=>row.status==='Ready').length,found=rows.filter(row=>row.status==='Found').length,review=rows.length-ready-found;
  host.innerHTML=`<div class="copilot-file-summary"><strong>${rows.length} companies detected</strong><span>${ready} ready · ${found} found · ${review} need review</span></div><div class="copilot-file-table-wrap"><table class="copilot-file-table"><thead><tr><th>Company</th><th>Website</th><th>Status</th></tr></thead><tbody>${rows.slice(0,80).map(row=>`<tr><td>${esc(row.companyName)}</td><td>${row.website?esc(row.website):'—'}</td><td>${esc(row.status)}</td></tr>`).join('')}</tbody></table></div>`;
}

async function parseFile(file){
  const Ref=window.LeadIntelReferenceCustomers;
  const detector=window.LeadIntelReferenceCustomerTableDetection?.detectCustomerTable;
  if(!Ref?.normalizeImportedRows)throw new Error('Customer file intelligence is not ready. Reload and try again.');
  const ext=(String(file?.name||'').split('.').pop()||'').toLowerCase();
  let rawRows=[];
  if(ext==='csv')rawRows=Ref.parseCsv(await file.text());
  else if(ext==='xlsx'||ext==='xls'){
    if(typeof detector!=='function')throw new Error('Customer table detector is not ready. Reload and try again.');
    const XLSX=await import(`https://cdn.jsdelivr.net/npm/xlsx@${COPILOT_FILE_XLSX_VERSION}/+esm`);
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
    const sheets=workbook.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:'',raw:false})}));
    rawRows=detector(sheets).rows;
  } else throw new Error('Attach an Excel or CSV file (.xlsx, .xls, .csv).');
  const rows=Ref.normalizeImportedRows(rawRows,{sourceType:ext||'file'});
  if(!rows.length)throw new Error('No company names could be identified in this file.');
  return rows.map(row=>({...row,outputStatus:row.website?'Ready':'Needs review',confidence:row.website?'provided':''}));
}

async function findWebsite(row){
  const helper=window.LeadIntelReferenceCustomerWebsiteEnrichment;
  if(!helper?.selectOfficialWebsite||!helper?.extractCandidates)throw new Error('Website enrichment is not ready. Reload and try again.');
  const state=(()=>{try{return JSON.parse(localStorage.getItem(COPILOT_FILE_STORAGE_KEY)||'{}');}catch{return {};}})();
  const country=clean(row.country)||(Array.isArray(state.targetMarkets)?clean(state.targetMarkets[0]):'');
  const query=`"${clean(row.companyName)}" official website${country?` ${country}`:''}`;
  const response=await fetch(`${COPILOT_FILE_FIRECRAWL}/firecrawl-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,limit:5})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(clean(payload?.error)||`Website search returned ${response.status}`);
  return helper.selectOfficialWebsite({...row,country},helper.extractCandidates(payload));
}

async function enrichMissing(button){
  const missing=currentRows.filter(row=>!row.website);
  if(!missing.length){setPanelStatus('All detected companies already have websites.');return;}
  button.disabled=true;let found=0,checked=0;
  for(const row of missing){
    setPanelStatus(`Finding missing websites… ${checked}/${missing.length} checked · ${found} found`);
    try{const match=await findWebsite(row);if(match){row.website=match.url;row.domain=new URL(match.url).hostname.replace(/^www\./,'');row.outputStatus='Found';row.confidence=match.confidence||'high';found++;}}catch{}
    checked++;
  }
  currentRows.forEach(row=>{if(!row.website){row.outputStatus='Needs review';row.confidence=row.confidence||'low';}});
  renderRows();setPanelStatus(`${found} official website${found===1?'':'s'} found. ${missing.length-found} still need review.`);button.disabled=false;
}

function downloadCleaned(){
  if(!currentRows.length)return;
  const blob=new Blob([cleanedCsv(currentRows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='LeadIntel_Customer_List_Cleaned.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function importIntoReferenceCustomers(){
  const Ref=window.LeadIntelReferenceCustomers;if(!Ref?.normalizeReferenceState)throw new Error('Reference Customer Intelligence is not ready.');
  const accepted=currentRows.filter(row=>row.companyName);
  if(!accepted.length)throw new Error('No customer rows are ready to import.');
  let state={};try{state=JSON.parse(localStorage.getItem(COPILOT_FILE_STORAGE_KEY)||'{}');}catch{}
  const current=Ref.normalizeReferenceState(state.referenceCustomers||{});
  const combined=Ref.normalizeImportedRows([...current.rows.map(row=>({Company:row.companyName,Website:row.website})),...accepted.map(row=>({Company:row.companyName,Website:row.website}))],{sourceType:'state'});
  state.referenceCustomers=Ref.normalizeReferenceState({...current,source:{type:'copilot-file',name:currentFileName||'Ask LeadIntel cleaned list'},rows:combined,segments:[],activeSegmentIds:[],activeIds:[],activated:false,dna:null});
  localStorage.setItem(COPILOT_FILE_STORAGE_KEY,JSON.stringify(state));
  await window.LeadIntelServerBridge?.saveNow?.().catch(()=>null);
  window.dispatchEvent(new CustomEvent('leadintel:reference-customers-updated'));
  setPanelStatus(`${accepted.length} companies sent to Reference Customer Intelligence for review.`);
}

function ensureUi(){
  const drawer=document.getElementById('leadintel-copilot-drawer');const form=drawer?.querySelector('.copilot-composer');if(!form||drawer.querySelector('[data-copilot-file-intelligence]'))return;
  const box=document.createElement('section');box.className='copilot-file-intelligence';box.dataset.copilotFileIntelligence='';
  box.innerHTML=`<div class="copilot-file-head"><button type="button" class="copilot-file-attach" data-copilot-file-attach>📎 Attach Excel / CSV</button><input type="file" data-copilot-file-input accept=".xlsx,.xls,.csv,text/csv" hidden><small>Upload the file as it is. LeadIntel will find the customer table, identify company names and websites, and flag missing data.</small></div><div data-copilot-file-status class="copilot-file-status"></div><div data-copilot-file-results></div><div class="copilot-file-actions" hidden><button type="button" data-copilot-file-enrich>Find missing websites</button><button type="button" data-copilot-file-download>Download cleaned CSV</button><button type="button" data-copilot-file-import>Use in Reference Customer Intelligence</button></div>`;
  form.insertBefore(box,form.firstChild);
  const input=box.querySelector('[data-copilot-file-input]');box.querySelector('[data-copilot-file-attach]').addEventListener('click',()=>{input.value='';input.click();});
  input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;currentFileName=file.name;currentRows=[];renderRows();setPanelStatus('Scanning file and detecting the customer table…');try{currentRows=await parseFile(file);renderRows();box.querySelector('.copilot-file-actions').hidden=false;const missing=currentRows.filter(row=>!row.website).length;setPanelStatus(`${currentRows.length} companies detected${missing?` · ${missing} missing websites`:''}.`);}catch(error){setPanelStatus(error?.message||'Unable to read this file');}finally{input.value='';}});
  box.querySelector('[data-copilot-file-enrich]').addEventListener('click',event=>enrichMissing(event.currentTarget));
  box.querySelector('[data-copilot-file-download]').addEventListener('click',downloadCleaned);
  box.querySelector('[data-copilot-file-import]').addEventListener('click',()=>importIntoReferenceCustomers().catch(error=>setPanelStatus(error?.message||'Unable to import cleaned list')));
}

export function installCopilotFileIntelligence(){ensureUi();}
export {normalizedOutputRows,cleanedCsv};
if(typeof window!=='undefined')window.LeadIntelCopilotFileIntelligence={installCopilotFileIntelligence,normalizedOutputRows,cleanedCsv};
