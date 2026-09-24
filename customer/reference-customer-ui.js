const REFERENCE_STORAGE_KEY='leadintel_customer_v2_state';
const FIRECRAWL_PROXY='https://apollo-proxy.edgars-7e7.workers.dev';
const PDFJS_VERSION='6.2.108';
const XLSX_VERSION='0.18.5';
const MAX_REFERENCE_ANALYSIS=24;
let pdfModule=null;

(function installReferenceCustomerUI(root){
  const Ref=root.LeadIntelReferenceCustomers;if(!Ref||typeof document==='undefined')return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  function readState(){try{return JSON.parse(localStorage.getItem(REFERENCE_STORAGE_KEY)||'{}');}catch{return {};}}
  function writeState(state){return Ref.persistReferenceWorkspaceState(root,state,{render:false});}
  function ensureState(state){state.referenceCustomers=Ref.normalizeReferenceState(state.referenceCustomers||{});return state;}
  function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),2600);}
  function ensureModal(){
    let modal=document.getElementById('reference-customer-modal');if(modal)return modal;
    modal=document.createElement('div');modal.id='reference-customer-modal';modal.className='reference-customer-modal';modal.hidden=true;
    modal.innerHTML=`<div class="reference-customer-backdrop" data-reference-close></div><section class="reference-customer-dialog" role="dialog" aria-modal="true" aria-labelledby="reference-customer-title">
      <header><div><span class="eyebrow">Reference Customer Intelligence</span><h2 id="reference-customer-title">Teach LeadIntel what a great customer looks like.</h2><p>Upload your best existing customers. LeadIntel studies their websites, detects meaningful segments and shows you the model before it affects Discovery.</p></div><button type="button" class="reference-close" data-reference-close aria-label="Close">×</button></header>
      <div class="reference-workflow"><span class="active">1 · Upload</span><span>2 · Analyze</span><span>3 · Review</span><span>4 · Activate</span></div>
      <div id="reference-market-summary" class="reference-market-summary"></div>
      <section class="reference-format-guide"><div><strong>Keep the list simple</strong><p><b>Include a Company Name, Website, or both.</b> LeadIntel can find missing information before analysis.</p><div class="reference-format-example"><span>Company Name</span><span>Website</span><span>Example Company</span><span>https://example.com</span></div></div><button class="secondary-btn" type="button" id="reference-template-download">Download example CSV</button></section>
      <div class="reference-import-actions"><button class="primary-btn reference-upload" type="button" id="reference-upload-button" aria-label="Upload &amp; Analyze Customers">Upload &amp; Analyze Customers</button><input type="file" id="reference-file-input" accept=".csv,.xlsx,.xls,text/csv" hidden><button class="secondary-btn" type="button" id="reference-add-manual" aria-controls="reference-manual-form" aria-expanded="false">Add manually</button><details class="reference-pdf-fallback"><summary>Have only a PDF?</summary><button class="text-btn reference-upload-pdf" type="button" id="reference-pdf-upload-button">Upload PDF for review</button><input type="file" id="reference-pdf-input" accept=".pdf,application/pdf" hidden></details></div>
      <form id="reference-manual-form" class="reference-manual-form" aria-label="Add a reference company" hidden><label for="reference-manual-company">Company name<input id="reference-manual-company" name="companyName" placeholder="Company Name" autocomplete="organization"></label><label for="reference-manual-website">Website <span>(optional)</span><input id="reference-manual-website" name="website" placeholder="Website (optional)" inputmode="url" autocomplete="url"></label><div class="reference-manual-actions"><button class="primary-btn small" type="submit" id="reference-save-manual">Add company</button><button class="secondary-btn small" type="button" id="reference-cancel-manual">Cancel</button></div></form>
      <div id="reference-import-status" class="reference-import-status" aria-live="polite"></div>
      <div class="reference-table-wrap"><table class="reference-table"><thead><tr><th>Company</th><th>Website</th><th>Analysis</th><th></th></tr></thead><tbody id="reference-table-body"></tbody></table></div>
      <div class="reference-analysis-actions"><button class="primary-btn" type="button" id="reference-analyze">Analyze customer list</button><small>LeadIntel will scrape the ready websites and create a compact commercial profile for each company. Website content itself is not stored here.</small></div>
      <section id="reference-segment-review" class="reference-segment-review" hidden><div class="reference-section-head"><div><span class="eyebrow">Suggested customer profile</span><h3>Review the profile LeadIntel inferred</h3></div><span id="reference-analysis-count"></span></div><div id="reference-segments"></div><p class="reference-activation-note"><strong>Review before activation.</strong> Only traits repeated across a segment will guide Discovery and company ranking in your Step 1 market. One-off observations stay visible for review and do not enter the lookalike model. This does not exclude other companies or add these references to outreach.</p></section>
      <div id="reference-dna-summary" class="reference-dna-summary"></div>
      <footer><button class="secondary-btn" type="button" data-reference-close>Close</button><button class="primary-btn" type="button" id="reference-activate" disabled>Activate selected segments</button></footer>
    </section>`;
    document.body.appendChild(modal);bindModal(modal);return modal;
  }
  function bindModal(modal){
    modal.addEventListener('click',event=>{
      if(event.target.closest('[data-reference-close]'))close();
      const confirm=event.target.closest('[data-confirm-reference]');if(confirm)confirmRow(confirm.dataset.confirmReference);
      const remove=event.target.closest('[data-remove-reference]');if(remove)removeRow(remove.dataset.removeReference);
      const segment=event.target.closest('[data-reference-segment]');if(segment)setTimeout(updateActivateButton,0);
    });
    const fileInput=modal.querySelector('#reference-file-input');
    modal.querySelector('#reference-upload-button')?.addEventListener('click',()=>{if(!fileInput)return;fileInput.value='';fileInput.click();});
    fileInput?.addEventListener('change',async event=>{try{await handleFile(event.target.files?.[0]);}finally{event.target.value='';}});
    const pdfInput=modal.querySelector('#reference-pdf-input');
    modal.querySelector('#reference-pdf-upload-button')?.addEventListener('click',()=>{if(!pdfInput)return;pdfInput.value='';pdfInput.click();});
    pdfInput?.addEventListener('change',async event=>{try{await handleFile(event.target.files?.[0]);}finally{event.target.value='';}});
    modal.querySelector('#reference-template-download')?.addEventListener('click',downloadTemplate);
    const manualToggle=modal.querySelector('#reference-add-manual'),manualForm=modal.querySelector('#reference-manual-form');
    manualToggle?.addEventListener('click',()=>{
      const opening=Boolean(manualForm?.hidden);if(manualForm)manualForm.hidden=!opening;
      manualToggle.setAttribute('aria-expanded',String(opening));
      if(opening){modal.querySelector('#reference-manual-company')?.focus();modal.querySelector('#reference-import-status').textContent='';}
    });
    manualForm?.addEventListener('submit',event=>{void addManual(event);});
    modal.querySelector('#reference-cancel-manual')?.addEventListener('click',()=>{
      if(manualForm)manualForm.hidden=true;manualToggle?.setAttribute('aria-expanded','false');manualToggle?.focus();
    });
    modal.querySelector('#reference-analyze')?.addEventListener('click',analyzeCustomerList);
    modal.querySelector('#reference-activate')?.addEventListener('click',activateSelectedSegments);
  }
  function open(){const modal=ensureModal();modal.hidden=false;render();}
  function close(){const modal=document.getElementById('reference-customer-modal');if(modal)modal.hidden=true;}
  function selectedSegmentIds(){return [...document.querySelectorAll('input[data-reference-segment]:checked:not(:disabled)')].map(node=>node.dataset.referenceSegment);}
  function updateActivateButton(){const button=document.getElementById('reference-activate');if(button)button.disabled=!selectedSegmentIds().length;}
  function downloadTemplate(){const csv='Company Name,Website\nExample Company,https://example.com\nWebsite-only example,https://example.org\n';const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='LeadIntel_Reference_Customers_Template.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function render(){
    const modal=ensureModal(),state=ensureState(readState()),reference=state.referenceCustomers,body=modal.querySelector('#reference-table-body');
    modal.querySelector('#reference-market-summary').innerHTML=`<strong>Search market</strong><span>${esc((state.targetMarkets||[]).join(' · ')||'Select your target market in Step 1')}</span><small>LeadIntel will look for similar companies inside this Step 1 market after you activate the model.</small>`;
    body.innerHTML=reference.rows.length?reference.rows.map(row=>{const analysis=reference.analyses?.[row.id];return `<tr><td><strong>${row.companyName?esc(row.companyName):'<span class="reference-warning">Company name missing</span>'}</strong></td><td>${row.website?`<a href="${esc(row.website)}" target="_blank" rel="noopener noreferrer">${esc(row.domain||row.website)}</a>`:'<span class="reference-warning">Website missing</span>'}</td><td>${analysis?`<span class="reference-status reference-status-ready">Analyzed · ${esc(analysis.confidence)}</span>`:`<span class="reference-status reference-status-${esc(row.status)}">${row.status==='needs_review'?'Needs review':row.status==='ready'?'Ready':'Needs website'}</span>`}</td><td>${row.status==='needs_review'?`<button class="text-btn" type="button" data-confirm-reference="${esc(row.id)}">Confirm</button>`:''}<button class="text-btn" type="button" data-remove-reference="${esc(row.id)}">Remove</button></td></tr>`}).join(''):`<tr><td colspan="4" class="reference-empty">Upload a two-column customer list: Company Name + Website.</td></tr>`;
    renderSegments(reference);
    const dna=reference.dna;modal.querySelector('#reference-dna-summary').innerHTML=dna?`<div class="reference-active-model"><span class="eyebrow">${dna.dimensions?.length?'Approved customer profile':'No usable lookalike profile'}</span><strong>${esc(dna.profileName||'Reference customer model')} · ${dna.sampleSize||dna.activeCount} references · ${esc(dna.profileConfidence||dna.confidence)} confidence</strong>${dna.profileSummary?`<p>${esc(dna.profileSummary)}</p>`:''}<p>${dna.dimensions?.length?`Discovery will use repeated traits as a soft preference in ${(state.targetMarkets||[]).join(' · ')||'your selected market'}.`:'No repeated traits were found, so this list will not influence lookalike discovery. Add or correct reference companies, then analyze again.'}</p><div>${(dna.dimensions||[]).slice(0,7).map(d=>`<span><b>${esc(d.label||d.key)}</b> ${(d.values||[]).map(value=>`${esc(value)} (${Number(d.evidenceByValue?.[value]||d.evidenceCount)||0}/${dna.sampleSize})`).join(', ')}</span>`).join('')}</div></div>`:'';
    updateActivateButton();
  }
  function renderSegments(reference){const section=document.getElementById('reference-segment-review'),container=document.getElementById('reference-segments'),count=document.getElementById('reference-analysis-count');if(!section||!container)return;const segments=reference.segments||[];section.hidden=!segments.length;if(!segments.length){container.innerHTML='';return;}count.textContent=`${Object.keys(reference.analyses||{}).length} analyzed`;
    const sampleSize=Object.keys(reference.analyses||{}).length,first=segments[0],noRecurring=segments.length===1&&first.count>1&&!first.recurringDimensionCount;
    const notice=reference.segmentationMeaningful?'':`<div class="reference-coherent-note"><strong>${noRecurring?'No shared profile detected':first.confidence==='low'?'Early profile hypothesis':first.confidence==='medium'?'Provisional customer profile':'Shared customer profile suggested'}</strong><span>${noRecurring?`No traits repeat across the ${sampleSize} analyzed companies. One-off observations below are excluded from Discovery; add or correct reference companies before activation.`:`Inferred from ${sampleSize} analyzed reference compan${sampleSize===1?'y':'ies'}. Evidence counts show how many companies support each trait. Only repeated traits will influence Discovery.`}</span></div>`;
    container.innerHTML=notice+segments.map(segment=>{const disabled=segment.canActivate===false,checked=!disabled&&reference.activeSegmentIds?.includes(segment.id),observationLabel=segment.recurringDimensionCount?'Observed attributes':'One-off attributes · not used in Discovery';return `<label class="reference-segment-card${disabled?' reference-segment-card-disabled':''}"><input type="checkbox" data-reference-segment="${esc(segment.id)}" ${checked?'checked':''} ${disabled?'disabled':''}><div><div class="reference-segment-head"><strong>${esc(segment.name)}</strong><span>${segment.count} companies · ${esc(segment.confidence)} confidence</span></div>${segment.summary?`<p>${esc(segment.summary)}</p>`:''}<small><b>${observationLabel}:</b> ${(segment.traits||[]).slice(0,5).map(esc).join(' · ')}</small></div></label>`;}).join('');
  }
  function mergeRows(state,newRows,source){
    const existing=state.referenceCustomers?.rows||[];const combined=Ref.normalizeImportedRows([...existing.map(row=>({Company:row.companyName,Website:row.website})),...newRows.map(row=>({Company:row.companyName,Website:row.website}))],{sourceType:'state'});
    const incomingByKey=new Map(newRows.map(row=>[row.domain||`${row.companyName.toLowerCase()}`,row]));
    const preservedAnalyses=state.referenceCustomers?.analyses||{};
    state.referenceCustomers=Ref.normalizeReferenceState({...state.referenceCustomers,source,rows:combined.map(row=>{const incoming=incomingByKey.get(row.domain||row.companyName.toLowerCase());return incoming?{...row,status:incoming.status,reviewed:incoming.reviewed}:row;}),analyses:preservedAnalyses,segments:[],activeSegmentIds:[],activeIds:[],activated:false,dna:null});return state;
  }
  async function handleFile(file){if(!file)return;const modal=ensureModal(),statusNode=modal.querySelector('#reference-import-status');statusNode.textContent='Reading customer list…';try{
      const name=file.name||'customer-list',ext=(name.split('.').pop()||'').toLowerCase();let rawRows=[],sourceType=ext;
      if(ext==='csv'){rawRows=Ref.parseCsv(await file.text());}
      else if(ext==='xlsx'||ext==='xls'){const XLSX=await import(`https://cdn.jsdelivr.net/npm/xlsx@${XLSX_VERSION}/+esm`);const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});const sheet=workbook.Sheets[workbook.SheetNames[0]];rawRows=XLSX.utils.sheet_to_json(sheet,{defval:''});sourceType='xlsx';}
      else if(ext==='pdf'){rawRows=await parsePdfRows(file);sourceType='pdf';}
      else throw new Error('Use CSV or Excel. PDF is available as a fallback.');
      const rows=Ref.normalizeImportedRows(rawRows,{sourceType});if(!rows.length)throw new Error('No records found. Include a Company Name, Website, or both.');const state=ensureState(readState());mergeRows(state,rows,{type:sourceType,name});await writeState(state);statusNode.textContent=`${rows.length} companies imported. ${rows.filter(row=>row.status==='ready').length} ready for analysis.`;render();
    }catch(error){statusNode.textContent=error.message||'Unable to import customer list';}}
  async function getPdfModule(){if(pdfModule)return pdfModule;pdfModule=await import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`);pdfModule.GlobalWorkerOptions.workerSrc=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;return pdfModule;}
  async function parsePdfRows(file){const pdfjs=await getPdfModule(),pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;const rows=[];for(let pageNo=1;pageNo<=Math.min(pdf.numPages,30)&&rows.length<200;pageNo++){const page=await pdf.getPage(pageNo),content=await page.getTextContent();const line=content.items.map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();for(const part of line.split(/\s{2,}|\s*[|•]\s*/)){const value=clean(part);if(value.length<2)continue;const urlMatch=value.match(/https?:\/\/\S+|\b(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}\b/i);if(urlMatch){const website=urlMatch[0];const company=clean(value.replace(urlMatch[0],'').replace(/[-–—,:;]+$/,''))||website;rows.push({Company:company,Website:website});}}}return rows;}
  async function addManual(event){
    event?.preventDefault?.();
    const modal=ensureModal(),form=modal.querySelector('#reference-manual-form'),button=modal.querySelector('#reference-save-manual'),status=modal.querySelector('#reference-import-status');
    const raw={Company:modal.querySelector('#reference-manual-company').value,Website:modal.querySelector('#reference-manual-website').value};
    const rows=Ref.normalizeImportedRows([raw],{sourceType:'manual'});
    if(!rows.length){status.textContent='Enter a company name, a website, or both.';modal.querySelector('#reference-manual-company')?.focus();return;}
    if(button.disabled)return;
    button.disabled=true;button.textContent='Adding…';
    try{
      const state=ensureState(readState()),incoming=rows[0],existing=state.referenceCustomers.rows.some(row=>(incoming.domain&&row.domain===incoming.domain)||row.id===incoming.id);
      if(existing){status.textContent=`${incoming.companyName||incoming.domain} is already in this list.`;return;}
      mergeRows(state,rows,{type:'manual',name:'Manual entry'});
      writeState(state);
      form.hidden=true;modal.querySelector('#reference-add-manual')?.setAttribute('aria-expanded','false');
      for(const id of ['reference-manual-company','reference-manual-website'])modal.querySelector(`#${id}`).value='';
      render();
      root.LeadIntelReferenceCustomerLibraryUI?.openEditor?.();
      status.textContent=state.referenceCustomerPortfolio?.selectedListId
        ?`${incoming.companyName||incoming.domain} added to the draft. Save Updated List before viewing results or activating the model.`
        :`${incoming.companyName||incoming.domain} added. Save this customer list before analyzing it.`;
    }catch(error){
      status.textContent=error?.message||'Unable to add the company. Your current list is still available.';
      form.hidden=false;modal.querySelector('#reference-add-manual')?.setAttribute('aria-expanded','true');
    }finally{button.disabled=false;button.textContent='Add company';}
  }
  async function confirmRow(id){const state=ensureState(readState());const row=state.referenceCustomers.rows.find(item=>item.id===id);if(!row)return;if(!row.domain){toast('A valid Website is required before analysis');return;}row.status='ready';row.reviewed=true;state.referenceCustomers=Ref.normalizeReferenceState(state.referenceCustomers);await writeState(state);render();}
  async function removeRow(id){const state=ensureState(readState());state.referenceCustomers.rows=state.referenceCustomers.rows.filter(row=>row.id!==id);delete state.referenceCustomers.analyses?.[id];state.referenceCustomers.segments=[];state.referenceCustomers.activeSegmentIds=[];state.referenceCustomers.activeIds=[];state.referenceCustomers.activated=false;state.referenceCustomers.dna=null;state.referenceCustomers=Ref.normalizeReferenceState(state.referenceCustomers);await writeState(state);render();}
  function inferAnalysis(text=''){const hay=clean(text).toLowerCase();const industry=/manufactur|factory|production|ražošan|rūpnīc/.test(hay)?'industrial manufacturing':/logistics|warehouse|noliktav/.test(hay)?'logistics':/software|saas|platform|technology/.test(hay)?'software / technology':/construction|būvniec/.test(hay)?'construction':/consult|training|coaching|professional service/.test(hay)?'professional services':'';const employees=hay.match(/(?:about|over|more than|approximately|around)?\s*(\d{2,5})\s+(?:employees|staff|people|darbiniek)/i);const n=employees?Number(employees[1]):0;const sizeBand=n?(n<50?'<50':n<=100?'50-100':n<=500?'100-500':'500+') :'';const businessModel=/\bb2b\b|business customers|corporate clients|industrial clients|companies/.test(hay)?'B2B':'';const growthStage=/expansion|growing|new market|export|investment|paplašin|eksport|investīc/.test(hay)?'growth / expansion':'';const operatingComplexity=/multiple locations|multi-site|factory|warehouse|operations|production/.test(hay)?'operationally complex':'';const buyerRoles=[];for(const [label,re] of [['CEO',/chief executive|\bceo\b/],['Sales Director',/sales director|head of sales/],['HR Director',/hr director|human resources director/],['COO',/chief operating officer|\bcoo\b/],['Procurement',/procurement|purchasing|iepirkum/],['Operations',/operations director|operations manager/],['Plant Manager',/plant manager|production manager/]])if(re.test(hay))buyerRoles.push(label);const buyingTriggers=[];for(const [label,re] of [['Expansion',/expansion|new facility|new factory|capacity|paplašin/],['Modernization',/moderni[sz]|automation investment|equipment upgrade|digital transformation/],['Hiring',/hiring|recruit|vacanc/],['Market entry',/new market|market entry|export expansion/]])if(re.test(hay))buyingTriggers.push(label);const customerOutcome=/increase sales|sales performance|revenue growth|conversion/.test(hay)?'improve commercial performance':/efficien|productivity|reduce cost/.test(hay)?'improve operational efficiency':'';const supported=[industry,sizeBand,businessModel,growthStage,operatingComplexity,customerOutcome,...buyerRoles,...buyingTriggers].filter(Boolean).length;return {industry,sizeBand,businessModel,growthStage,operatingComplexity,customerOutcome,buyerRoles,buyingTriggers,confidence:supported>=5?'high':supported>=2?'medium':'low'};}
  async function analyzeRow(row){const response=await fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:row.website,formats:['markdown'],onlyMainContent:true,timeout:25000})});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Source returned ${response.status}`);const data=payload.data||payload;const text=String(data.markdown||data.content||'').slice(0,25000);if(!text.trim())throw new Error('No readable website content');return inferAnalysis(text);}
  async function analyzeCustomerList(){let state=ensureState(readState());const ready=state.referenceCustomers.rows.filter(row=>row.status==='ready'&&row.website).slice(0,MAX_REFERENCE_ANALYSIS);if(!ready.length){toast('Upload companies with valid websites first');return;}const modal=ensureModal(),statusNode=modal.querySelector('#reference-import-status'),button=modal.querySelector('#reference-analyze');button.disabled=true;const analyses={...state.referenceCustomers.analyses};let completed=0,failed=0;for(const row of ready){statusNode.textContent=`Analyzing customer websites… ${completed+1}/${ready.length}`;try{analyses[row.id]=await analyzeRow(row);}catch{analyses[row.id]={confidence:'low'};failed++;}completed++;}state=ensureState(readState());state.referenceCustomers.analyses=analyses;const segmentation=Ref.buildReferenceSegments(state.referenceCustomers.rows,analyses);state.referenceCustomers.segments=segmentation.segments;state.referenceCustomers.segmentationMeaningful=segmentation.meaningful;state.referenceCustomers.activeSegmentIds=[];state.referenceCustomers.activeIds=[];state.referenceCustomers.activated=false;state.referenceCustomers.dna=null;state.referenceCustomers.analyzedAt=new Date().toISOString();state.referenceCustomers=Ref.normalizeReferenceState(state.referenceCustomers);await writeState(state);statusNode.textContent=`Analysis complete · ${ready.length-failed}/${ready.length} websites produced usable intelligence${failed?` · ${failed} need review`:''}. Review the Customer segments below before activation.`;button.disabled=false;render();}
  async function activateSelectedSegments(){let state=ensureState(readState());const segmentIds=selectedSegmentIds();if(!segmentIds.length){toast('Select at least one customer segment');return;}state.referenceCustomers=Ref.activateReferenceSegments(state.referenceCustomers,segmentIds);state.referenceCustomers.dna=Ref.buildReferenceDna(state.referenceCustomers,state.referenceCustomers.analyses);state.referenceCustomers.analyzedAt=new Date().toISOString();await writeState(state);render();toast('Reference Customer priority model activated');}
  root.LeadIntelReferenceCustomerUI={open,close,render};
})(globalThis);
