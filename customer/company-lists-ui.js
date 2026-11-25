(function(root){
 'use strict';if(root.LeadIntelCompanyListUI)return;
 const M=root.LeadIntelCompanyLists,T=root.LeadIntelTargetCriteria,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let current=null,options=null,scope='',pending=false,timer=null,pollVersion=0,sort='score',descending=true,prepared=null,showAll=false;
 const identity=()=>JSON.stringify([root.LeadIntelServerBridge?.session?.authenticated,root.LeadIntelServerBridge?.session?.user?.id,root.LeadIntelServerBridge?.workspace?.id,root.LeadIntelServerBridge?.workspace?.role]);
 function stopPolling(){clearTimeout(timer);pollVersion++;}
 function synchronize(){const key=identity();if(key!==scope){scope=key;current=null;options=null;prepared=null;showAll=false;searchScopeRevision++;searchKey='';savedSearch=null;lastSavedCopy=null;searchMessage='';searchState={snapshot:null,busy:false};stopPolling();if($('company-list-content'))$('company-list-content').replaceChildren();notice('');paintSearch();}return key;}
 // A request that got no answer: the browser could not make it (fetch rejects with a TypeError) or none came in 30 s.
 const unanswered=e=>{throw e?.name==='TimeoutError'||e?.name==='TypeError'&&e.code===undefined&&e.status===undefined?Object.assign(Error(e.message),{code:'LIST_REQUEST_UNANSWERED',cause:e}):e;};
 // A status read worth asking again: it got no answer, or what came was cut off or written by a gateway on the way
 // instead of by the server. A refusal is not one of them, in whatever form it comes (a sign-in or rate-limit page).
 const statusReadMissed=e=>e?.code==='LIST_REQUEST_UNANSWERED'||e?.code==='LIST_ANSWER_UNREADABLE'&&[200,502,503,504].includes(e.status);
 const STATUS_READ_ATTEMPTS=8;
 async function api(params={},body){const key=synchronize(),bridge=root.LeadIntelServerBridge;if(!bridge?.session?.authenticated||!bridge.workspace?.id)throw Error('Sign in and select a workspace first.');const query=new URLSearchParams({workspace_id:bridge.workspace.id,...params});const response=await fetch('https://leadintel-api.edgars-7e7.workers.dev/api/company-lists?'+query,{signal:AbortSignal.timeout(30000),credentials:'include',method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}).catch(unanswered);let data;try{data=await response.json();}catch{}if(!data||typeof data!=='object')throw Object.assign(Error('The company list answer could not be read.'),{code:'LIST_ANSWER_UNREADABLE',status:response.status});if(key!==identity())throw Error('Workspace changed. Reopen company lists.');if(!response.ok)throw Error(data.error||'Company list request failed.');return data;}
 // Shown while a list is researched: the server refuses to select or save companies of a running list.
 const BUYERS_WAIT='Find buyers and Save list to CRM are switched off while this research runs. They are available when it finishes, or at once after Pause research; a paused list can be resumed.';
 function notice(message){if($('company-list-notice'))$('company-list-notice').textContent=message;}
 // `waiting` is shown at once for the requests that take seconds (the saved lists, the list criteria), so the
 // panel does not look dead between the click and the answer. It is cleared when the request ends without an error.
 async function action(fn,formAction=false,waiting=''){
  if(pending)return;
  const owner=synchronize();pending=true;stopPolling();notice(waiting);
  $('company-list-panel')?.setAttribute('aria-busy','true');
  try{await fn();}
  catch(e){
   if(owner===identity()){
    const inline=formAction&&$('company-list-form-error');
    if(inline){inline.textContent=e.message;inline.hidden=false;inline.focus();}
    else notice(e.message);
   }
  }finally{pending=false;if(waiting&&$('company-list-notice')?.textContent===waiting)notice('');$('company-list-panel')?.setAttribute('aria-busy','false');poll();}
 }
 let searchKey='',searchEpoch=0,searchScopeRevision=0,savedSearch=null,lastSavedCopy=null,searchBusy=false,searchMessage='',searchState={snapshot:null,busy:false};
 const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 function searchView(){try{return root.LeadIntelDiscoveryUI?.getCompanyListSnapshot?.()||{snapshot:null,busy:false};}catch(error){return {snapshot:null,busy:false,error:error.message};}}
 function exportTarget(){
  if(savedSearch)return savedSearch;
  const snapshot=searchState.snapshot;
  if(snapshot&&lastSavedCopy&&lastSavedCopy.criteria.context?.sellerWebsite===snapshot.context.sellerWebsite)return lastSavedCopy;
  return null;
 }
 function paintSearch(){
  const save=$('save-company-search-list'),exp=$('export-company-search-list');if(!save||!exp)return;
  const view=searchState,signedIn=root.LeadIntelServerBridge?.session?.authenticated,allowed=['owner','researcher','sales'].includes(root.LeadIntelServerBridge?.workspace?.role);
  save.disabled=searchBusy||view.busy||!view.snapshot||!signedIn||!allowed;
  save.textContent=searchBusy==='save'?'Saving list…':'Save list';
  const target=exportTarget(),previousCopy=target&&!savedSearch;
  exp.disabled=searchBusy||!target||!signedIn||!allowed;
  exp.textContent=searchBusy==='export'?'Exporting…':previousCopy?'Export saved copy':'Export list';
  const status=$('company-search-list-status');
  if(searchMessage||view.error)status.textContent=searchMessage||view.error;
  else if(!signedIn)status.textContent='Sign in to save and export a list.';
  else if(!allowed)status.textContent='Your workspace role cannot save company lists.';
  else if(previousCopy){
   const count=target.results.length;
   status.textContent='The current results have changed. Export the saved copy ('+count+' '+(count===1?'company':'companies')+'), or save again to include the changes.';
  }else if(savedSearch)status.textContent='Saved · '+savedSearch.results.length+' companies. Available in CRM → Company lists.';
  else if(view.busy)status.textContent='Wait for the search to finish before saving the list.';
  else if(view.snapshot)status.textContent='Save all '+view.snapshot.rows.length+' companies before exporting. The download includes rank, company, website and fit score.';
  else status.textContent='Run a company search to save a list.';
 }
 function mountSearch(){
  const anchor=document.querySelector('#step-5 .discovery-controls');if(!anchor||$('company-search-list-actions'))return;
  const host=document.createElement('div');host.id='company-search-list-actions';host.className='company-search-list-actions';
  host.innerHTML='<div class="cl-toolbar"><button type="button" class="secondary-btn" id="save-company-search-list" disabled>Save list</button><button type="button" class="secondary-btn" id="export-company-search-list" aria-describedby="company-search-list-status" disabled>Export list</button><label>Export format<select id="company-search-list-format"><option value="csv">CSV</option><option value="xlsx">Excel</option></select></label></div><p id="company-search-list-status" role="status" aria-live="polite"></p>';
  anchor.append(host);$('save-company-search-list').onclick=()=>searchAction('save');$('export-company-search-list').onclick=()=>searchAction('export');void refreshSearch();
 }
 async function refreshSearch(){
  synchronize();const view=searchState=searchView(),key=view.snapshot?JSON.stringify(view.snapshot):'';paintSearch();
  if(key===searchKey)return;searchKey=key;searchEpoch++;savedSearch=null;searchMessage='';paintSearch();
  if(!key||!root.LeadIntelServerBridge?.session?.authenticated)return;const owner=scope,epoch=searchEpoch,revision=searchScopeRevision;
  try{const fingerprint=await digest(key);if(owner!==identity()||key!==searchKey)return;
   const result=await api({search_snapshot:fingerprint});if(owner!==identity()||revision!==searchScopeRevision||key!==searchKey||epoch!==searchEpoch)return;
   savedSearch=result.list?.criteria?.fingerprint===fingerprint?result.list:null;
   if(savedSearch)lastSavedCopy=savedSearch;
   paintSearch();
  }catch{if(owner===identity()&&key===searchKey)paintSearch();}
 }
 async function searchAction(command){
  if(searchBusy)return;
  synchronize();
  const owner=scope,revision=searchScopeRevision,key=searchKey,target=exportTarget(),format=$('company-search-list-format').value;
  const stillHere=()=>owner===identity()&&revision===searchScopeRevision;
  if(command==='save'?(!key||searchState.busy):!target)return;
  searchBusy=command;searchMessage='';paintSearch();
  try{
   if(command==='save'){
    // Save the rows captured at the click, even if background checks finish meanwhile.
    const fingerprint=await digest(key);if(!stillHere())return;
    const result=await api({}, {action:'snapshot',name:'Company search · '+new Date().toLocaleString(),snapshot:JSON.parse(key),fingerprint});
    if(!stillHere())return;
    if(!result.list?.id||result.list.criteria?.fingerprint!==fingerprint)throw Error('List save was not confirmed. Please retry.');
    lastSavedCopy=result.list;
    if(key===searchKey){searchEpoch++;savedSearch=result.list;}
   }else{
    // Export the acknowledged list the user chose, even if the live results change.
    const result=await api({id:target.id});if(!stillHere())return;
    if(result.list?.id!==target.id||result.list.criteria?.fingerprint!==target.criteria.fingerprint){
     if(savedSearch?.id===target.id)savedSearch=null;
     if(lastSavedCopy?.id===target.id)lastSavedCopy=null;
     throw Error('This saved list is no longer available. Save the list again before exporting.');
    }
    download(format,result.list);
   }
  }catch(e){if(stillHere())searchMessage=e.message;}
  finally{searchBusy=false;paintSearch();}
 }
 function renderSearchSnapshot(l){
  const rows=M.inScoreOrder(l.results).map((r,i)=>{
   const hasScore=M.hasCompanyScore(r);
   const label=!hasScore?'Awaiting score':r.scoreState==='previous'?'Previous score · needs review':r.reviewStatus==='Checked'?'Current score':'Provisional score';
   const website=r.website?'<a href="'+esc(r.website)+'" target="_blank" rel="noopener noreferrer">'+esc(M.domain(r.website))+' ↗</a>':'';
   const sources=r.evidence.map(e=>'<blockquote>'+esc(e.quote)+'</blockquote><a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Source'+(e.date?' · '+esc(e.date):'')+' ↗</a>').join('');
   return '<tr><td>'+(hasScore?i+1:'—')+'</td><td><strong>'+esc(r.company)+'</strong>'+website+'</td><td>'+esc(r.location)+'</td>'+
    '<td>'+(hasScore?r.score:'—')+'<small>'+label+'</small></td><td><strong>'+esc(r.reviewStatus)+'</strong><p>'+esc(r.signals.join(', '))+'</p>'+
    '<details><summary>Saved evidence</summary><p>'+esc(r.summary)+'</p>'+sources+'</details></td></tr>';
  }).join('');
  $('company-list-content').innerHTML='<div class="cl-result-heading"><h4>'+esc(l.name)+'</h4><span>Saved search results</span></div><p>'+l.results.length+' companies · Saved '+esc(new Date(l.createdAt+'Z').toLocaleString())+'</p>'+
   '<p>This copy preserves the scores, review status and sources at the time of saving. Continue research in Companies. Buying intent remains unconfirmed.</p>'+
   '<div class="cl-toolbar"><button type="button" class="secondary-btn" data-cl="csv">Download CSV</button><button type="button" class="secondary-btn" data-cl="xlsx">Download Excel</button><button type="button" class="text-btn" data-cl="delete">Delete list</button></div>'+
   '<div class="cl-table-wrap"><table><thead><tr><th>Rank</th><th>Company</th><th>Location</th><th>Company fit</th><th>Review and evidence</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 }
 function mount(){
  const searchContext=$('company-search-context');
  if(!searchContext||$('company-list-panel'))return;
  // The panel is the first block of the company search card on the Companies step. It used to sit below the older
  // search, its saved companies and the known targets, more than a screen down, and was not found. It stays inside
  // the card because the card is what the page hides on the Buyers stage, which shares this section.
  const search=searchContext.closest('.discovery-panel'),anchor=$('event-discovery-panel')||searchContext;
  const panel=document.createElement('section');panel.id='company-list-panel';panel.className='panel company-list-panel';panel.setAttribute('aria-labelledby','company-list-heading');
  panel.innerHTML=`
   <header class="cl-entry">
    <div class="cl-entry-copy">
     <span class="eyebrow">Company lists</span>
     <h3 id="company-list-heading">Find companies that match your profiles</h3>
     <p>Find up to 200 companies using your active profiles and optional buying signals. Every match gets the same evidence checks.</p>
    </div>
    <div class="cl-entry-actions">
     <button type="button" class="primary-btn" data-cl="new">Build company list</button>
     <button type="button" class="secondary-btn" data-cl="lists">Open saved lists</button>
    </div>
   </header>
   <p id="company-list-notice" role="status" aria-live="polite"></p>
   <div id="company-list-content"></div>`;if(search)search.prepend(panel);else anchor.before(panel);panel.addEventListener('click',click);panel.addEventListener('change',change);panel.addEventListener('input',e=>{if(e.target.closest('#company-list-form')){invalidateReview();if(['budget','count','industry'].includes(e.target.name))syncCriteriaFields();}});
  mountCrm();
 }
 function mountCrm(){  const crm=document.querySelector('#crm-workspace .crm-header');if(crm&&!$('crm-company-lists')){const b=document.createElement('button');b.id='crm-company-lists';b.type='button';b.className='secondary-btn';b.textContent='Company lists';b.onclick=()=>{document.querySelector('#crm-workspace [data-crm-close]')?.click();root.LeadIntelDiscoveryUI?.open({focus:'companies'});$('company-list-panel')?.scrollIntoView({block:'start'});action(showLists);};crm.append(b);}
 }
 async function showLists(){clearTimeout(timer);const data=await api();current=null;$('company-list-content').innerHTML='<h4>Your company lists</h4>'+(data.lists.length?'<div class="cl-saved">'+data.lists.map(l=>'<button type="button" class="secondary-btn" data-cl="open" data-id="'+esc(l.id)+'"><strong>'+esc(l.name)+'</strong><span>'+l.progress.count+' / '+l.progress.target+' · '+esc(l.kind==='search_snapshot'?'Saved search results':statusLabel(l.status))+(l.saved?' · Saved to CRM':'')+'</span></button>').join('')+'</div>':'<p>No lists yet. Build your first list using active profiles and optional buying signals.</p>');}
 async function newList(){
  const bridge=root.LeadIntelServerBridge,owner=scope;
  if(bridge?.conflict)throw Error('Resolve workspace sync before choosing criteria.');
  if(bridge?.saveNow&&!root.LeadIntelWorkspacePersistence?.reuseAcknowledgedSave?.()){const saved=await bridge.saveNow({saveIntent:true,explicitSave:true});if(!saved?.saved)throw Error('Save your workspace before building a list.');}
  if(owner!==identity())return;
  options=(await api({options:'1'})).options;current=null;prepared=null;showAll=false;sort='score';descending=true;
  const profiles=options.profiles||[],signals=options.buyingSignals||[],trigger=profiles.some(p=>p.type==='trigger-led'&&p.active&&p.ready);
  $('company-list-content').innerHTML=`<form id="company-list-form">
   <div class="cl-grid"><label>List name<input name="name" maxlength="120" required value="My company list"></label>
    <label>Companies to find<select name="preset"><option>5</option><option selected>10</option><option>20</option><option>50</option><option>100</option><option>200</option><option value="custom">Custom</option></select><input name="count" type="number" min="1" max="200" value="10" aria-label="Custom company count" hidden></label>
    <label>Target countries or markets<textarea name="markets" rows="2" required>${esc(options.markets.join('\n'))}</textarea><small>One per line. These countries apply to this list; references may be elsewhere.</small></label></div>
   <fieldset><legend>1. Targeting profiles</legend><p>Choose one or combine active profiles. Manage their definitions and switches in Strategy. Off profiles have no influence on this list.</p>
    <div class="cl-choices cl-profiles">${profiles.map(p=>`<label><input type="checkbox" name="profile" value="${esc(p.id)}" ${p.active&&p.ready?'checked':'disabled'}><strong>${esc(p.name)}</strong><small>${esc(p.status)}</small><span>${esc(p.description)}</span></label>`).join('')}</div>
    <label>Combine profiles<select name="profileMode"><option value="any">Match any selected profile</option><option value="all">Match all selected profiles</option></select></label>
    <small>Any keeps companies fitting at least one selected profile. All requires evidence for each selected profile.</small>
   </fieldset>
   <fieldset><legend>2. Buying signals</legend><label>How should buying signals affect the list?<select name="signalMode"><option value="off" ${trigger?'':'selected'}>Profiles only</option><option value="boost" ${trigger?'selected':''}>Prioritize buying signals</option><option value="require">Require buying signals</option></select></label>
    <p>Profiles only adds no buying-event requirement. Prioritize keeps profile matches and adds up to 10 ranking points for verified signals. Require filters for selected signals. Buying signals cannot replace profile fit.</p>
    <p id="company-list-trigger-note" hidden>Trigger-led matches always need buying-signal evidence. Choose Prioritize or Require and select signals, or deselect Trigger-led. Opportunity-led uses saved, sourced opportunities independently of additional buying signals.</p>
    <fieldset id="company-list-buying-fields"><legend>Active buying signals from Strategy</legend><div class="cl-choices">${signals.map(s=>`<label><input type="checkbox" name="signal" value="${esc(s.id)}" checked>${esc(s.name)}<small>${esc(s.description||s.keywords?.join(', '))}</small></label>`).join('')}</div>
     ${signals.length?'':'<p>No active buying signals. Add or activate them in Strategy, or choose Profiles only.</p>'}
     <label>Combine buying signals<select name="mode"><option value="any">Any selected buying signal</option><option value="all">All selected buying signals</option></select></label>
     <small>For Require and Trigger-led, this controls inclusion. For Prioritize, only verified signals add priority; missing signals score zero.</small>
     <p id="company-list-optional-signals" role="status" hidden>No optional buying signals selected. This list will rank by profile fit only.</p>
     <details><summary>Signal importance</summary><div class="cl-grid">${signals.map(s=>`<label>${esc(s.name)} importance<select name="weight:${esc(s.id)}">${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>`).join('')}</div></details>
    </fieldset>
   </fieldset>
   <fieldset id="company-list-reference-fields"><legend>3. Lookalike references</legend><p>Start with one reference, or combine up to 15 analyzed references. Larger libraries remain available.</p>
    <label>Choose references<select name="referenceGroup"><option value="active">All active references</option><option value="custom">Choose individual references</option>${options.groups.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label>
    <div class="cl-choices cl-references">${options.references.map(r=>`<label><input type="checkbox" name="reference" value="${esc(r.id)}" ${r.active&&r.ready?'checked':''} ${r.ready?'':'disabled'}>${esc(r.name)}<small>${esc(r.group)}${r.ready?'':' · Analyze website in Profile first'}</small></label>`).join('')}</div>
   </fieldset>
   ${T?`<fieldset id="company-list-target-fields"><legend>4. Industry and business register</legend>
    <p>Research records published employee counts and annual turnover when available. Both are for reference and have no effect on eligibility or score.</p>
    <details><summary>Industries</summary><p>Tick every industry division a company may belong to. Leave all empty to accept any industry.</p>
     <div class="cl-choices cl-industries">${T.DIVISIONS.map(d=>`<label><input type="checkbox" name="industry" value="${esc(d.code)}">${esc(d.code+' '+d.label)}</label>`).join('')}</div></details>
    <label><input type="checkbox" name="registryOnly">Leave out companies the business register does not hold</label>

   </fieldset>`:''}
   <div class="cl-grid"><label>Research operation limit for this run<input type="number" name="budget" min="10" max="5000" value="${M.recommendedBudget(10)}" aria-describedby="company-list-allowance-note"><small>Searches, page reads, analysis, evidence reviews and retries use this allowance. AI planning, assessment and review start with a $1 estimated budget. Up to three AI web-search queries can use a fallback provider. Search and data fees are separate.</small></label></div>
   <p id="company-list-allowance-note" role="status" hidden></p>
   <p>The same evidence checks apply at every list size. You can close the app while research continues. A target is not a guarantee. Saved lists keep their original criteria; changed profiles or signals apply when you build a new list.</p>
   <button type="button" class="primary-btn" data-cl="review">Review criteria</button><div id="company-list-preview"></div>
   <p id="company-list-form-error" class="cl-blocker" role="alert" tabindex="-1" hidden></p></form>`;
  syncCriteriaFields();
 }
 function syncCriteriaFields(){
  const f=$('company-list-form');if(!f)return;
  const selected=[...f.querySelectorAll('[name="profile"]:checked')].map(box=>options.profiles.find(p=>p.id===box.value));
  const buying=$('company-list-buying-fields'),references=$('company-list-reference-fields');
  buying.disabled=f.elements.signalMode.value==='off';buying.hidden=buying.disabled;
  references.disabled=!selected.some(p=>p.type==='lookalike');references.hidden=references.disabled;
  $('company-list-trigger-note').hidden=!selected.some(p=>['trigger-led','opportunity-led'].includes(p.type));
  $('company-list-optional-signals').hidden=f.elements.signalMode.value!=='boost'||selected.some(p=>p.type==='trigger-led')||Boolean(f.querySelector('[name="signal"]:checked'));
  const count=Number(f.elements.preset.value==='custom'?f.elements.count.value:f.elements.preset.value),budget=f.elements.budget.valueAsNumber;
  const perCompany=targetValue(new FormData(f))?4:3; // A read, assessment and review per verified company, plus a register check when rules are set.
  const minimum=perCompany*count+2; // At least one plan and search before the per-company work.
  const note=$('company-list-allowance-note');
  note.hidden=!Number.isInteger(count)||count<1||count>200||!Number.isInteger(budget)||budget<10||budget>=minimum;
  note.textContent=note.hidden?'':`Verifying ${count} companies takes at least ${minimum} operations for planning, discovery, page reads, assessments${perCompany===4?', register checks':''} and evidence reviews. With a limit of ${budget}, this run can only return a partial list.`;
 }
 function invalidateReview(){
  prepared=null;$('company-list-preview')?.replaceChildren();
  const error=$('company-list-form-error');if(error){error.hidden=true;error.textContent='';}
 }
 function targetValue(data){
  if(!T||!$('company-list-target-fields'))return null;
  return {collectSizeEvidence:true,industries:data.getAll('industry'),registryOnly:data.has('registryOnly')};
 }
 const targetLabels={registry:'Business register',industry:'Industry',employees:'Employees',revenue:'Revenue'};
 function targetHtml(r){
  const t=r.target;if(!t||!Array.isArray(t.checks))return '';
  const entry=M.url(t.register?.source?.url);
  return '<div class="cl-target"><p><strong>Company evidence</strong>'+(entry?' · <a target="_blank" rel="noopener noreferrer" href="'+esc(entry)+'">Register entry ↗</a>':'')+'</p><ul>'+t.checks.map(c=>'<li data-target-status="'+esc(c.status)+'">'+(c.status==='reported'?'Reported':c.status==='match'?'Confirmed':'Not confirmed')+' · '+esc(targetLabels[c.key]||c.key)+': '+esc(c.detail)+(M.url(c.evidence?.url)?' · <a target="_blank" rel="noopener noreferrer" href="'+esc(M.url(c.evidence.url))+'">Source ↗</a>':'')+(M.url(c.exchangeRateSource)?' · <a target="_blank" rel="noopener noreferrer" href="'+esc(M.url(c.exchangeRateSource))+'">ECB rate ↗</a>':'')+'</li>').join('')+'</ul>'+(t.register?.marketingProtected===true?'<p>This company has registered marketing protection in the business register. Check the rules for direct marketing before contacting it.</p>':'')+'</div>';
 }
 function formValue(){const f=$('company-list-form'),data=new FormData(f),target=targetValue(data);return {minimumScore:80,name:data.get('name'),count:Number(data.get('preset')==='custom'?data.get('count'):data.get('preset')),markets:String(data.get('markets')).split('\n').map(s=>s.trim()).filter(Boolean),profileIds:data.getAll('profile'),profileMode:data.get('profileMode'),signalMode:data.get('signalMode'),signalIds:data.getAll('signal'),referenceIds:data.getAll('reference'),mode:data.get('mode')||'any',budget:Number(data.get('budget')),weights:Object.fromEntries((options.buyingSignals||[]).filter(s=>data.has('weight:'+s.id)).map(s=>[s.id,Number(data.get('weight:'+s.id))])),contextFingerprint:options.contextFingerprint,...(target?{target}:{})};}
 function review(){
  invalidateReview();const raw=formValue(),c=M.configuration(raw,options);prepared=raw;
  $('company-list-preview').innerHTML='<div class="cl-preview"><h4 tabindex="-1">'+esc(c.name)+' · '+c.count+' companies</h4><p>'+esc(c.markets.join(', '))+'</p><p>'+esc(M.criteriaSummary(c))+'</p>'+c.profiles.map(p=>'<details><summary>'+esc(p.name)+'</summary><p>'+esc(p.description)+'</p><p>Offer: '+esc(p.offers)+'</p><p>Exclusions: '+esc(p.exclusions||'Workspace exclusions apply')+'</p></details>').join('')+c.references.map(r=>'<details><summary>'+esc(r.name)+'</summary>'+r.evidence.slice(0,4).map(e=>'<blockquote>'+esc(e.quote)+' <a target="_blank" rel="noopener noreferrer" href="'+esc(e.url)+'">Source ↗</a></blockquote>').join('')+'</details>').join('')+'<p><strong>Up to '+c.budget+' research operations for this run.</strong> Provider charges vary. Research stops at the approved limit.</p><p>Each counted company needs a reviewed score of 80 or higher and evidence for required criteria. Profile fit and signal priority are shown separately. Buying intent remains unconfirmed.</p><button type="button" class="primary-btn" data-cl="start">Start research</button></div>';
  $('company-list-preview').querySelector('h4').focus();
 }
 function change(e){if(e.target.closest('#company-list-form')){invalidateReview();const f=$('company-list-form');if(e.target.name==='budget')f.elements.budget.dataset.custom='true';if(e.target.name==='preset')f.elements.count.hidden=e.target.value!=='custom';if(['preset','count'].includes(e.target.name)&&!f.elements.budget.dataset.custom)f.elements.budget.value=M.recommendedBudget(f.elements.preset.value==='custom'?f.elements.count.value:f.elements.preset.value);if(e.target.name==='referenceGroup'){const v=e.target.value;if(v!=='custom')for(const box of f.querySelectorAll('[name="reference"]')){const r=options.references.find(r=>r.id===box.value);box.checked=r.ready&&(v==='active'?r.active:r.groupId===v);}}if(e.target.name==='reference')f.elements.referenceGroup.value='custom';syncCriteriaFields();}}
 function statusLabel(status){return status==='canceled'?'Paused':status;}
 // When a provider refused, the panel names it, says what happened and what to do. The server keeps who refused and
 // how (`failureCause`); every other stop keeps the server's own sentence.
 function causeText(l,active){
  const c=l.failureCause,p=c?.provider;if(!p)return '';
  const diagnostic=[c.status&&'error '+c.status,c.code].filter(Boolean).join(' · ');
  const error=diagnostic?' ('+diagnostic+')':'';
  if(c.kind==='spending_limit')return p+" stopped: your account's spending limit is reached. Raise it in the "+p+' console, then resume. Your results are kept.';
  if(c.kind==='credits')return p+' has no credit left on your key. Add credit in the '+p+' console, then resume. Your results are kept.';
  if(c.kind==='key')return p+' rejected the API key'+error+'. Check the key in Settings, then resume. Your results are kept.';
  if(c.kind==='rate_limit')return p+' is limiting how fast requests may be sent. '+(active?'The search continues by itself.':'Wait a minute, then resume. Your results are kept.');
  if(c.kind==='unavailable')return p+' did not answer'+error+'. '+(active?'The search retries by itself.':'Resume in a few minutes to retry. Your results are kept.');
  if(c.kind==='refused')return p+' refused the request'+error+'. Your results are kept. Send this line to LeadIntel support.';
  return '';
 }
 // A running list says that it is running: a moving mark, a clock, the last operation and a rough time left. All of it
 // is read from the list itself (its receipts and counts); nothing extra is asked from the server. The clock counts
 // from Start or continue when that was pressed in this page, otherwise from the moment the list was created.
 const LIVE_WORK={page_read:'reading',analysis:'assessing',evidence_review:'reviewing the evidence of',register_check:'checking the business register for'};
 const startedHere=new Map();let liveTimer=null;
 const liveActive=l=>Boolean(l&&['queued','running'].includes(l.status));
 const utcTime=value=>{const text=String(value||'');return Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(text)?text:text.replace(' ','T')+'Z');};
 const minutesSeconds=ms=>{const seconds=Math.max(0,Math.floor(ms/1000));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
 function liveText(l,now=Date.now()){
  const pressed=l.progress.run?.startedAt||startedHere.get(l.id),began=pressed||utcTime(l.createdAt)||now,elapsed=Math.max(0,now-began),left=l.criteria.count-l.results.length;
  // After Start or continue in this page only this run counts: its own operations and the companies it has kept.
  const kept=l.progress.run?l.results.length-l.progress.run.baseline:pressed?l.results.filter(r=>utcTime(r.checkedAt)>=pressed).length:l.results.length;
  const waiting=l.progress.phase==='retrying'||Number(l.progress.nextAttemptAt)>now,last=l.receipts[l.receipts.length-1];
  let doing='preparing the search',ago='';
  if(last){
   const target=String(last.target||''),at=utcTime(last.at),seconds=Math.max(0,Math.floor((now-at)/1000));
   if(pressed&&at<pressed)doing='continuing the search';
   else{doing=last.operation==='search'?'searching the web':target==='search plan'?'planning the searches':(LIVE_WORK[last.operation]||'working on')+' '+(/^https?:/i.test(target)?M.domain(target):target);
   if(Number.isFinite(seconds))ago=' · '+(seconds<60?seconds+' s':Math.floor(seconds/60)+' min')+' ago';}
  }
  // Estimate from this run only, once two distinct matches have passed review.
  const minutes=kept>=2&&left>0?Math.max(1,Math.round(elapsed/kept*left/60000)):0;
  return {waiting,head:waiting?'Waiting to retry…':'Researching…',clock:'Running '+minutesSeconds(elapsed),now:waiting?'':'Now: '+doing+ago,
   estimate:minutes?'About '+minutes+' minute'+(minutes===1?'':'s')+' left at this pace':'Time left appears after the first two matches'};
 }
 function liveHtml(l){const v=liveText(l);return '<p class="cl-live'+(v.waiting?' cl-live-waiting':'')+'" data-cl-live><span class="cl-live-dot" aria-hidden="true"></span><strong data-live="head">'+esc(v.head)+'</strong><span data-live="clock">'+esc(v.clock)+'</span><span data-live="now">'+esc(v.now)+'</span><span data-live="estimate">'+esc(v.estimate)+'</span></p>';}
 function syncLive(){
  const shown=()=>liveActive(current)?document.querySelector('#company-list-content [data-cl-live]'):null;
  const stop=()=>{if(liveTimer!==null){clearInterval(liveTimer);liveTimer=null;}};
  if(!shown())return stop();
  if(liveTimer===null)liveTimer=setInterval(()=>{
   const line=shown();if(!line)return stop();
   const v=liveText(current);line.classList.toggle('cl-live-waiting',v.waiting);
   for(const name of ['head','clock','now','estimate'])line.querySelector('[data-live="'+name+'"]').textContent=v[name];
  },1000);
 }
 function matchScore(match){
  if(!Number.isFinite(match.score))return '';
  const strength=Number.isFinite(match.strength)?' · Assessed strength '+match.strength+'/100':'';
  if(match.kind==='profile')return strength+' · Profile fit '+match.score+'/90';
  if(match.kind==='signal')return strength+' · Adjusted signal strength '+match.score+'/100';
  return ' · Evidence score '+match.score;
 }
 function showMissingList(){
  current=null;$('company-list-content').textContent='This list was deleted. Open saved lists to choose another list.';
 }
 async function open(id){
  if(current?.id!==id){showAll=false;sort='score';descending=true;}
  const data=await api({id});
  if(!data.list)return showMissingList();
  current=data.list;render();
 }
 // The research runs at the server; this only watches it, one read every five seconds. A read that was not answered
 // (see statusReadMissed) is asked again at the next turn, and only a run of them ends the watching. A refusal is
 // shown at once, as before. Meanwhile the panel shows the last answer. Only this GET is repeated, never an action.
 function poll(misses=0){
  stopPolling();
  if(!current||!['queued','running'].includes(current.status))return;
  const list=current,key=scope,version=pollVersion;
  const watching=()=>version===pollVersion&&key===identity()&&current===list;
  timer=setTimeout(async()=>{
   try{
    if(!watching())return;
    let data;
    try{data=await api({id:list.id});}
    catch(e){
     if(!watching()||!statusReadMissed(e))throw e;
     if(misses+1>=STATUS_READ_ATTEMPTS)return notice('The research may still be running. Use Refresh to see where it is.');
     return poll(misses+1);
    }
    if(!watching())return;
    if(!data.list)return showMissingList();
    current=data.list;render();poll();
   }catch(e){if(watching())notice(e.message+' Use Refresh to retry.');}
  },5000);
 }
 function render(){
  if(!current)return;
  if(current.criteria.kind==='search_snapshot')return renderSearchSnapshot(current);
  const l=current,content=$('company-list-content');
  const expanded=new Set(content.dataset.listId===l.id?[...content.querySelectorAll('details[open]')].map(el=>el.dataset.detail):[]);
  content.dataset.listId=l.id;
  const active=['queued','running'].includes(l.status);
  // A list that used its allowance is paused, not broken: it says what it found and offers to go on.
  const paused=l.status==='incomplete'&&l.progress.operations>=l.progress.allowance;
  const rows=[...l.results].sort((a,b)=>{
   const cmp=sort==='score'?a.score-b.score:String(a[sort]||'').localeCompare(String(b[sort]||''));
   return descending?-cmp:cmp;
  });
  const firstLabel=sort==='score'&&descending?'top':'first';
  $('company-list-content').innerHTML='<div class="cl-result-heading"><h4>'+esc(l.name)+'</h4><span>'+esc(statusLabel(l.status))+(l.saved?' · Saved to CRM':'')+'</span></div>'+(active?liveHtml(l):'')+'<p><strong>'+l.results.length+' of '+l.criteria.count+' matching companies</strong> · '+l.progress.checked+' sources assessed · '+l.progress.operations+' / '+l.progress.allowance+' research operations</p><progress max="'+l.criteria.count+'" value="'+l.results.length+'" aria-label="Matching companies"></progress><p role="status" class="'+(paused?'cl-paused':l.status==='incomplete'?'cl-blocker':'')+'">'+esc(paused?'The search paused: '+l.results.length+' of '+l.criteria.count+' companies found so far, '+l.progress.checked+' page'+(l.progress.checked===1?'':'s')+' checked. Your results are kept.':causeText(l,active)||l.progress.reason)+'</p><details data-detail="criteria"><summary>List criteria and research receipts</summary><p>'+esc(M.criteriaSummary(l.criteria))+' · '+esc(l.criteria.markets.join(', '))+'</p><p>References: '+esc(l.criteria.references.map(r=>r.name).join(', ')||'None')+'</p><p>Importance: '+esc(l.criteria.signals.map(s=>s.name+' '+l.criteria.weights[s.id]).join(', '))+'</p><p>Criteria are frozen when research starts. New lists check selected profiles first; optional verified buying signals add priority or become required filters. Off criteria have no influence. Earlier lists retain their saved policy. Buying intent is unconfirmed.</p><p>'+esc(l.progress.operationTotals?'Measured attempts: '+l.progress.operationTotals.complete+' completed, '+l.progress.operationTotals.failed+' failed, '+l.progress.operationTotals.interrupted+' interrupted. Showing recent receipts; each match retains its own evidence review.':'Earlier accounting retained; detailed receipts were not recorded for every historical operation.')+'</p><ul>'+l.receipts.slice(-20).map(r=>'<li>'+esc([r.provider,r.stage||r.operation,r.status,r.providerCode,r.http&&'HTTP '+r.http,r.at].filter(Boolean).join(' · '))+'</li>').join('')+'</ul></details><div class="cl-toolbar"><button type="button" class="secondary-btn" data-cl="refresh">Refresh status</button>'+(active?'<button type="button" class="secondary-btn" data-cl="pause">Pause research</button>':l.status!=='complete'?'<button type="button" class="primary-btn" data-cl="resume">'+(l.failureCode==='search_budget'?'Approve 3 more AI searches':l.failureCode==='research_spend'?'Approve $1 more and resume':paused?'Keep searching':'Resume within remaining allowance')+'</button>':'')+'<button type="button" class="primary-btn" data-cl="save" '+(active||!rows.length?'disabled':'')+'>Save list to CRM</button><button type="button" class="secondary-btn" data-cl="csv" '+(!rows.length?'disabled':'')+'>Download CSV</button><button type="button" class="secondary-btn" data-cl="xlsx" '+(!rows.length?'disabled':'')+'>Download Excel</button><button type="button" class="text-btn" data-cl="delete" '+(active?'disabled':'')+'>Delete list</button></div>'+(paused?'<p class="cl-continue-note">Continues for up to '+l.criteria.budget+' more research steps.</p>':'')+(l.incompleteChecks?.length?'<details data-detail="incomplete"><summary>Incomplete or rejected source checks ('+l.incompleteChecks.length+')</summary>'+l.incompleteChecks.slice(-30).map(r=>'<p><a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.company||M.domain(r.url))+'</a> · '+esc(r.reason)+'</p>').join('')+'</details>':'')+(rows.length?'<p>'+rows.length+' matching companies · Showing '+(showAll?'all companies':firstLabel+' '+Math.min(10,rows.length))+'</p>'+(active?'<p class="cl-buyers-wait" role="note">'+esc(BUYERS_WAIT)+'</p>':'')+(rows.length>10?'<button type="button" class="secondary-btn" data-cl="show-all">'+(showAll?'Show '+firstLabel+' 10':'Show all '+rows.length+' companies')+'</button>':'')+'<div class="cl-table-wrap"><table><thead><tr>'+[['company','Company'],['location','Location'],['score','Relevance']].map(([k,v])=>'<th'+(sort===k?' aria-sort="'+(descending?'descending':'ascending')+'"':'')+'><button type="button" data-cl="sort" data-sort="'+k+'">'+v+(sort===k?(descending?' ↓':' ↑'):'')+'</button></th>').join('')+'<th>Profiles, signals and evidence</th><th>Next step</th></tr></thead><tbody>'+(showAll?rows:rows.slice(0,10)).map(r=>'<tr><td><strong>'+esc(r.company)+'</strong><a href="'+esc(r.website)+'" target="_blank" rel="noopener noreferrer">'+esc(r.domain)+' ↗</a></td><td>'+esc(r.location)+'</td><td><strong>'+r.score+'</strong>'+(r.fitScore!==undefined?'<small>Profile fit '+esc(r.fitScore)+'/90 · Signal bonus +'+esc(r.signalBonus)+'/10</small>':'')+'<small>Buying intent unconfirmed</small></td><td><details data-detail="company:'+esc(r.domain)+'"><summary>'+esc(r.matches.map(m=>m.name).join(', '))+'</summary>'+r.matches.map(m=>'<p><strong>'+esc((m.kind==='profile'?'Profile: ':m.kind==='signal'?'Buying signal: ':'')+m.name)+'</strong>'+matchScore(m)+'</p><p>'+esc(m.reason)+'</p><blockquote>'+esc(m.quote)+'</blockquote><a href="'+esc(m.url)+'" target="_blank" rel="noopener noreferrer">Source'+(m.date?' · '+esc(m.date):'')+' ↗</a>'+(m.referenceName?'<p>Similar to '+esc(m.referenceName)+': '+esc(m.referenceQuote)+(m.referenceUrl?' <a href="'+esc(m.referenceUrl)+'" target="_blank" rel="noopener noreferrer">Reference source ↗</a>':'')+'</p>':'')).join('')+(r.profileMatches?.some(m=>m.opportunityUrl)?r.profileMatches.filter(m=>m.opportunityUrl).map(m=>'<p>Opportunity: '+esc(m.opportunityTitle)+' <a href="'+esc(m.opportunityUrl)+'" target="_blank" rel="noopener noreferrer">Saved opportunity source ↗</a></p>').join(''):'')+(r.quality?'<p>Evidence review: '+esc(r.quality.reason)+'</p>':'<p>Earlier evidence policy; no separate review was recorded.</p>')+(r.commercialFit?'<p>Commercial fit: '+esc(r.commercialFit.reason)+'</p>':'')+targetHtml(r)+'<p>Checked '+esc(new Date(r.checkedAt).toLocaleString())+'</p></details></td><td><button type="button" class="secondary-btn" data-cl="buyer" data-domain="'+esc(r.domain)+'" '+(active?'disabled title="'+esc(BUYERS_WAIT)+'"':'')+'>Find buyers →</button></td></tr>').join('')+'</tbody></table></div>':'<p>No verified matches yet. Incomplete research does not mean no matching companies exist.</p>');for(const detail of content.querySelectorAll('details'))detail.open=expanded.has(detail.dataset.detail);
  if(l.progress.reasoningSpend){
   const usage=document.createElement('p'),ledger=l.progress.reasoningSpend;
   usage.textContent='AI reasoning budget used or reserved: $'+(ledger.used/1000000).toFixed(2)+' of $'+(ledger.limit/1000000).toFixed(2)+'. Search provider charges are separate.';
   content.querySelector('progress').after(usage);
  }
  if(l.progress.run){
   const times=Object.entries(l.progress.run.milestones);
   if(times.length){
    const summary=document.createElement('p');
    summary.textContent='This run · '+times.map(([count,ms])=>count+' verified in '+minutesSeconds(ms)).join(' · ');
    content.querySelector('progress').after(summary);
   }
  }
  if(l.status==='complete'&&!l.criteria.taskId&&l.criteria.count<200){
   const max=200-l.criteria.count,count=Math.min(10,max);
   content.insertAdjacentHTML('beforeend','<details data-detail="extend"><summary>Add more companies</summary><p>Search with the same criteria and an additional $1 estimated AI reasoning allowance and three AI web-search queries. New matches join this ranking.</p><label>Additional companies <input id="cl-extra-count" type="number" min="1" max="'+max+'" value="'+count+'"></label><label>Research operations for this extension <input id="cl-extra-budget" type="number" min="10" max="5000" value="'+M.recommendedBudget(count)+'"></label><button type="button" class="primary-btn" data-cl="extend">Start additional research</button></details>');
  }
  const addCount=$('cl-extra-count'),addBudget=$('cl-extra-budget');
  if(addCount&&addBudget){
   addCount.oninput=()=>{if(!addBudget.dataset.custom&&addCount.validity.valid)addBudget.value=M.recommendedBudget(Number(addCount.value));};
   addBudget.oninput=()=>{addBudget.dataset.custom='true';};
  }
  syncLive();
  if(l.criteria.taskId){for(const action of ['pause','resume','delete'])$('company-list-content').querySelector('[data-cl="'+action+'"]')?.remove();const manage=document.createElement('button');manage.type='button';manage.className='secondary-btn';manage.textContent='Manage task in Ask LeadIntel';manage.onclick=()=>root.LeadIntelCopilotLoader?.loadCopilot();$('company-list-content').querySelector('.cl-toolbar')?.prepend(manage);}
 }
 function download(type,list=current){const content=type==='csv'?M.csv(list):M.xlsx(list),blob=new Blob([content],{type:type==='csv'?'text/csv;charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(list.name.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,80)||'companies')+'.'+type;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function click(event){
  const b=event.target.closest('[data-cl]');if(!b||b.disabled)return;
  const command=b.dataset.cl;
  return action(async()=>{
   if(command==='new')return newList();
   if(command==='lists')return showLists();
   if(command==='open')return open(b.dataset.id);
   if(command==='review')return review();
   if(command==='start'){
    if(!prepared||JSON.stringify(prepared)!==JSON.stringify(formValue()))throw Error('Review the current criteria first.');
    current=(await api({}, {action:'start',...prepared})).list;if(current)startedHere.set(current.id,Date.now());render();
    const title=$('company-list-content').querySelector('h4');
    if(title){title.tabIndex=-1;title.focus();}
    return;
   }
   if(!current)return;
   if(command==='refresh')return open(current.id);
   if(command==='show-all'){showAll=!showAll;return render();}
   if(command==='sort'){
    const next=b.dataset.sort;
    descending=next===sort?!descending:next==='score';
    sort=next;return render();
   }
   if(['csv','xlsx'].includes(command))return download(command);
   const list=current,owner=scope;
   if(command==='save'){
    let cursor=0;
    do{
     const response=await api({}, {action:'save',id:list.id,revision:current.revision,cursor});
     current=response.list;cursor=response.nextCursor;render();notice(cursor!==null?'Saving companies to CRM…':'');
    }while(cursor!==null);
    root.dispatchEvent(new CustomEvent('leadintel:crm-changed'));return;
   }
   if(command==='delete'){
    const confirmed=await root.LeadIntelDialogs.confirm('This removes the list and its research history. Companies already saved in CRM remain available.',{title:'Delete company list?',action:'Delete list',danger:true});
    if(!confirmed||owner!==identity()||current!==list)return;
   }
   const extraSearch=command==='resume'&&list.failureCode==='search_budget';
   if(extraSearch){
    const confirmed=await root.LeadIntelDialogs.confirm('Allow three more paid AI web-search queries, including provider fallback?',{title:'Continue research?',action:'Approve 3 searches'});
    if(!confirmed||owner!==identity()||current!==list)return;
   }
   const extraSpend=command==='resume'&&list.failureCode==='research_spend';
   if(extraSpend){
    const confirmed=await root.LeadIntelDialogs.confirm('Add $1 to the estimated AI reasoning budget for this list?',{title:'Continue research?',action:'Approve $1'});
    if(!confirmed||owner!==identity()||current!==list)return;
   }
   const extension=command==='extend'?{additional:Number($('cl-extra-count').value),budget:Number($('cl-extra-budget').value)}:{};
   const result=await api({}, {...extension,...(extraSearch?{additionalGroundedQueries:3}:{}),...(extraSpend?{additionalReasoningUsd:1}:{}),action:command,id:list.id,revision:list.revision,...(command==='buyer'?{domain:b.dataset.domain}:{})});
   if(command==='delete'){
    searchEpoch++;
    if(savedSearch?.id===list.id)savedSearch=null;
    if(lastSavedCopy?.id===list.id)lastSavedCopy=null;
    searchMessage='';paintSearch();
    return showLists();
   }
   if(command==='buyer'){await root.LeadIntelDiscoveryUI?.openListCompany?.(result.candidate);return;}
   if(command==='resume'&&result.list)startedHere.set(result.list.id,Date.now());
   current=result.list;render();
  },command==='review'||command==='start',({new:'Loading the list criteria…',lists:'Loading your company lists…',open:'Opening the list…'})[command]||'');
 }
 // Inside the search card the panel is hidden with the card on the Buyers stage. Hiding the panel itself left it hidden
  // after a return to Companies by the sidebar, which announces no focus change (found live on 23 Nov 2026).
  root.addEventListener('leadintel:journey-focus-changed',e=>{const panel=$('company-list-panel');if(panel)panel.hidden=!panel.closest('.discovery-panel')&&e.detail?.focus==='buyers';});
 root.LeadIntelCompanyListUI={mount,refreshSearch,open: id=>action(()=>id?open(id):showLists())};
 const init=()=>{mount();mountSearch();const observer=new MutationObserver(()=>{if(!$('company-list-panel'))mount();mountCrm();mountSearch();});observer.observe(document.body,{childList:true,subtree:true});};
 for(const type of ['leadintel:server-ready','leadintel:session-changed','leadintel:account-changed','storage'])root.addEventListener(type,()=>{synchronize();void refreshSearch();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
