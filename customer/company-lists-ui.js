(function(root){
 'use strict';if(root.LeadIntelCompanyListUI)return;
 const M=root.LeadIntelCompanyLists,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let current=null,options=null,scope='',pending=false,timer=null,pollVersion=0,sort='score',descending=true,prepared=null,showAll=false;
 const identity=()=>JSON.stringify([root.LeadIntelServerBridge?.session?.authenticated,root.LeadIntelServerBridge?.session?.user?.id,root.LeadIntelServerBridge?.workspace?.id,root.LeadIntelServerBridge?.workspace?.role]);
 function stopPolling(){clearTimeout(timer);pollVersion++;}
 function synchronize(){const key=identity();if(key!==scope){scope=key;current=null;options=null;prepared=null;showAll=false;searchKey='';savedSearch=null;searchMessage='';searchState={snapshot:null,busy:false};stopPolling();if($('company-list-content'))$('company-list-content').replaceChildren();notice('');paintSearch();}return key;}
 async function api(params={},body){const key=synchronize(),bridge=root.LeadIntelServerBridge;if(!bridge?.session?.authenticated||!bridge.workspace?.id)throw Error('Sign in and select a workspace first.');const query=new URLSearchParams({workspace_id:bridge.workspace.id,...params});const response=await fetch('https://leadintel-api.edgars-7e7.workers.dev/api/company-lists?'+query,{signal:AbortSignal.timeout(30000),credentials:'include',method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(key!==identity())throw Error('Workspace changed. Reopen company lists.');if(!response.ok)throw Error(data.error||'Company list request failed.');return data;}
 function notice(message){if($('company-list-notice'))$('company-list-notice').textContent=message;}
 async function action(fn,formAction=false){
  if(pending)return;
  const owner=synchronize();pending=true;stopPolling();notice('');
  $('company-list-panel')?.setAttribute('aria-busy','true');
  try{await fn();}
  catch(e){
   if(owner===identity()){
    const inline=formAction&&$('company-list-form-error');
    if(inline){inline.textContent=e.message;inline.hidden=false;inline.focus();}
    else notice(e.message);
   }
  }finally{pending=false;$('company-list-panel')?.setAttribute('aria-busy','false');poll();}
 }
 let searchKey='',searchEpoch=0,savedSearch=null,searchBusy=false,searchMessage='',searchState={snapshot:null,busy:false};
 const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 function searchView(){try{return root.LeadIntelDiscoveryUI?.getCompanyListSnapshot?.()||{snapshot:null,busy:false};}catch(error){return {snapshot:null,busy:false,error:error.message};}}
 function paintSearch(){
  const save=$('save-company-search-list'),exp=$('export-company-search-list');if(!save||!exp)return;
  const view=searchState,signedIn=root.LeadIntelServerBridge?.session?.authenticated,allowed=['owner','researcher','sales'].includes(root.LeadIntelServerBridge?.workspace?.role);
  save.disabled=searchBusy||view.busy||!view.snapshot||!signedIn||!allowed;
  save.textContent=searchBusy?'Please wait…':'Save list';
  exp.disabled=searchBusy||view.busy||!savedSearch||!signedIn||!allowed;
  $('company-search-list-status').textContent=searchMessage||view.error||(!view.snapshot?'Run a company search to save a list.':!signedIn?'Sign in to save and export a list.':!allowed?'Your workspace role cannot save company lists.':view.busy?'Wait for the search to finish before saving the list.':savedSearch?'Saved · '+savedSearch.results.length+' companies. Available in CRM → Company lists.':'Save all '+view.snapshot.rows.length+' companies before exporting. Review status and sources are included.');
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
  if(!key||!root.LeadIntelServerBridge?.session?.authenticated)return;const owner=scope,epoch=searchEpoch;
  try{const fingerprint=await digest(key);if(owner!==identity()||key!==searchKey)return;
   const result=await api({search_snapshot:fingerprint});if(owner!==identity()||key!==searchKey||epoch!==searchEpoch)return;savedSearch=result.list;paintSearch();
  }catch{if(owner===identity()&&key===searchKey)paintSearch();}
 }
 async function searchAction(command){
  if(searchBusy)return;await refreshSearch();const owner=scope,key=searchKey,view=searchState;if(searchBusy||!key||view.busy)return;
  searchBusy=true;searchEpoch++;searchMessage='';paintSearch();
  try{
   const fingerprint=await digest(key);if(owner!==identity()||key!==searchKey)throw Error('Company results changed. Save the current list again.');
   if(command==='save'){
    const result=await api({}, {action:'snapshot',name:'Company search · '+new Date().toLocaleString(),snapshot:JSON.parse(key),fingerprint});
    if(owner!==identity()||key!==searchKey)throw Error('List saved. Results have since changed; save the updated list before exporting.');
    if(result.list?.criteria?.fingerprint!==fingerprint)throw Error('List save was not confirmed. Please retry.');savedSearch=result.list;
   }else{
    if(!savedSearch||savedSearch.criteria.fingerprint!==fingerprint)throw Error('Save the current list before exporting.');
    const result=await api({id:savedSearch.id});if(owner!==identity()||key!==searchKey)throw Error('Company results changed. Save the current list again.');
    if(!result.list||result.list.criteria.fingerprint!==fingerprint){savedSearch=null;throw Error('This saved list is no longer available. Save the list again before exporting.');}
    download($('company-search-list-format').value,result.list);
   }
  }catch(e){if(owner===identity())searchMessage=e.message;}
  finally{searchBusy=false;paintSearch();}
 }
 function renderSearchSnapshot(l){
  $('company-list-content').innerHTML='<div class="cl-result-heading"><h4>'+esc(l.name)+'</h4><span>Saved search results</span></div><p>'+l.results.length+' companies · Saved '+esc(new Date(l.createdAt+'Z').toLocaleString())+'</p><p>This copy preserves the scores, review status and sources at the time of saving. Continue research in Companies. Buying intent remains unconfirmed.</p><div class="cl-toolbar"><button type="button" class="secondary-btn" data-cl="csv">Download CSV</button><button type="button" class="secondary-btn" data-cl="xlsx">Download Excel</button><button type="button" class="text-btn" data-cl="delete">Delete list</button></div><div class="cl-table-wrap"><table><thead><tr><th>Company</th><th>Location</th><th>Company fit</th><th>Review and evidence</th></tr></thead><tbody>'+l.results.map(r=>'<tr><td><strong>'+esc(r.company)+'</strong>'+(r.website?'<a href="'+esc(r.website)+'" target="_blank" rel="noopener noreferrer">'+esc(M.domain(r.website))+' ↗</a>':'')+'</td><td>'+esc(r.location)+'</td><td>'+(r.score??'—')+'<small>'+esc(r.scoreState==='current'?'Current score':r.scoreState==='previous'?'Previous score · needs review':'Awaiting score')+'</small></td><td><strong>'+esc(r.reviewStatus)+'</strong><p>'+esc(r.signals.join(', '))+'</p><details><summary>Saved evidence</summary><p>'+esc(r.summary)+'</p>'+r.evidence.map(e=>'<blockquote>'+esc(e.quote)+'</blockquote><a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Source'+(e.date?' · '+esc(e.date):'')+' ↗</a>').join('')+'</details></td></tr>').join('')+'</tbody></table></div>';
 }
 function mount(){
  const searchContext=$('company-search-context');
  if(!searchContext||$('company-list-panel'))return;
  const anchor=$('event-discovery-panel')||searchContext;
  const panel=document.createElement('section');panel.id='company-list-panel';panel.className='panel company-list-panel';panel.innerHTML='<div class="cl-heading"><div><span class="eyebrow">Company lists</span><h3>Find companies that match your profiles</h3><p>Build up to 200 companies from active profiles, with optional buying signals. Every match receives the same evidence checks.</p></div><button type="button" class="primary-btn" data-cl="new">Build company list</button></div><div class="cl-toolbar"><button type="button" class="secondary-btn" data-cl="lists">Open saved lists</button></div><p id="company-list-notice" role="status" aria-live="polite"></p><div id="company-list-content"></div>';anchor.before(panel);panel.addEventListener('click',click);panel.addEventListener('change',change);panel.addEventListener('input',e=>{if(e.target.closest('#company-list-form')){invalidateReview();if(['budget','count'].includes(e.target.name))syncCriteriaFields();}});
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
    <label>Companies to find<select name="preset"><option>10</option><option>20</option><option>50</option><option>100</option><option>200</option><option value="custom">Custom</option></select><input name="count" type="number" min="1" max="200" value="10" aria-label="Custom company count" hidden></label>
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
   <div class="cl-grid"><label>Research operation limit for this run<input type="number" name="budget" min="10" max="5000" value="200" aria-describedby="company-list-allowance-note"><small>Searches, page reads, analysis, evidence reviews and retries use this allowance. Providers may bill several requests per operation.</small></label></div>
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
  const minimum=3*count+2; // At least one plan and search, then a read, assessment and review per verified company.
  const note=$('company-list-allowance-note');
  note.hidden=!Number.isInteger(count)||count<1||count>200||!Number.isInteger(budget)||budget<10||budget>=minimum;
  note.textContent=note.hidden?'':`Verifying ${count} companies takes at least ${minimum} operations for planning, discovery, page reads, assessments and evidence reviews. With a limit of ${budget}, this run can only return a partial list.`;
 }
 function invalidateReview(){
  prepared=null;$('company-list-preview')?.replaceChildren();
  const error=$('company-list-form-error');if(error){error.hidden=true;error.textContent='';}
 }
 function formValue(){const f=$('company-list-form'),data=new FormData(f);return {name:data.get('name'),count:Number(data.get('preset')==='custom'?data.get('count'):data.get('preset')),markets:String(data.get('markets')).split('\n').map(s=>s.trim()).filter(Boolean),profileIds:data.getAll('profile'),profileMode:data.get('profileMode'),signalMode:data.get('signalMode'),signalIds:data.getAll('signal'),referenceIds:data.getAll('reference'),mode:data.get('mode')||'any',budget:Number(data.get('budget')),weights:Object.fromEntries((options.buyingSignals||[]).filter(s=>data.has('weight:'+s.id)).map(s=>[s.id,Number(data.get('weight:'+s.id))])),contextFingerprint:options.contextFingerprint};}
 function review(){
  invalidateReview();const raw=formValue(),c=M.configuration(raw,options);prepared=raw;
  $('company-list-preview').innerHTML='<div class="cl-preview"><h4 tabindex="-1">'+esc(c.name)+' · '+c.count+' companies</h4><p>'+esc(c.markets.join(', '))+'</p><p>'+esc(M.criteriaSummary(c))+'</p>'+c.profiles.map(p=>'<details><summary>'+esc(p.name)+'</summary><p>'+esc(p.description)+'</p><p>Offer: '+esc(p.offers)+'</p><p>Exclusions: '+esc(p.exclusions||'Workspace exclusions apply')+'</p></details>').join('')+c.references.map(r=>'<details><summary>'+esc(r.name)+'</summary>'+r.evidence.slice(0,4).map(e=>'<blockquote>'+esc(e.quote)+' <a target="_blank" rel="noopener noreferrer" href="'+esc(e.url)+'">Source ↗</a></blockquote>').join('')+'</details>').join('')+'<p><strong>Up to '+c.budget+' research operations for this run.</strong> Provider charges vary. Research stops at the approved limit.</p><p>Profile fit and signal priority are shown separately. Buying intent remains unconfirmed.</p><button type="button" class="primary-btn" data-cl="start">Start research</button></div>';
  $('company-list-preview').querySelector('h4').focus();
 }
 function change(e){if(e.target.closest('#company-list-form')){invalidateReview();const f=$('company-list-form');if(e.target.name==='budget')f.elements.budget.dataset.custom='true';if(e.target.name==='preset')f.elements.count.hidden=e.target.value!=='custom';if(['preset','count'].includes(e.target.name)&&!f.elements.budget.dataset.custom)f.elements.budget.value=M.recommendedBudget(f.elements.preset.value==='custom'?f.elements.count.value:f.elements.preset.value);if(e.target.name==='referenceGroup'){const v=e.target.value;if(v!=='custom')for(const box of f.querySelectorAll('[name="reference"]')){const r=options.references.find(r=>r.id===box.value);box.checked=r.ready&&(v==='active'?r.active:r.groupId===v);}}if(e.target.name==='reference')f.elements.referenceGroup.value='custom';syncCriteriaFields();}}
 function statusLabel(status){return status==='canceled'?'Paused':status;}
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
 function poll(){
  stopPolling();
  if(!current||!['queued','running'].includes(current.status))return;
  const list=current,key=scope,version=pollVersion;
  const watching=()=>version===pollVersion&&key===identity()&&current===list;
  timer=setTimeout(async()=>{
   try{
    if(!watching())return;
    const data=await api({id:list.id});
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
  const rows=[...l.results].sort((a,b)=>{
   const cmp=sort==='score'?a.score-b.score:String(a[sort]||'').localeCompare(String(b[sort]||''));
   return descending?-cmp:cmp;
  });
  const firstLabel=sort==='score'&&descending?'top':'first';
  $('company-list-content').innerHTML='<div class="cl-result-heading"><h4>'+esc(l.name)+'</h4><span>'+esc(statusLabel(l.status))+(l.saved?' · Saved to CRM':'')+'</span></div><p><strong>'+l.results.length+' of '+l.criteria.count+' matching companies</strong> · '+l.progress.checked+' sources assessed · '+l.progress.operations+' / '+l.progress.allowance+' research operations</p><progress max="'+l.criteria.count+'" value="'+l.results.length+'" aria-label="Matching companies"></progress><p role="status" class="'+(l.status==='incomplete'?'cl-blocker':'')+'">'+esc(l.progress.reason)+'</p><details data-detail="criteria"><summary>List criteria and research receipts</summary><p>'+esc(M.criteriaSummary(l.criteria))+' · '+esc(l.criteria.markets.join(', '))+'</p><p>References: '+esc(l.criteria.references.map(r=>r.name).join(', ')||'None')+'</p><p>Importance: '+esc(l.criteria.signals.map(s=>s.name+' '+l.criteria.weights[s.id]).join(', '))+'</p><p>Criteria are frozen when research starts. New lists check selected profiles first; optional verified buying signals add priority or become required filters. Off criteria have no influence. Earlier lists retain their saved policy. Buying intent is unconfirmed.</p><p>'+esc(l.progress.operationTotals?'Measured attempts: '+l.progress.operationTotals.complete+' completed, '+l.progress.operationTotals.failed+' failed, '+l.progress.operationTotals.interrupted+' interrupted. Showing recent receipts; each match retains its own evidence review.':'Earlier accounting retained; detailed receipts were not recorded for every historical operation.')+'</p><ul>'+l.receipts.slice(-20).map(r=>'<li>'+esc([r.provider,r.operation,r.status,r.at].filter(Boolean).join(' · '))+'</li>').join('')+'</ul></details><div class="cl-toolbar"><button type="button" class="secondary-btn" data-cl="refresh">Refresh status</button>'+(active?'<button type="button" class="secondary-btn" data-cl="pause">Pause research</button>':l.status!=='complete'?'<button type="button" class="primary-btn" data-cl="resume">'+(l.progress.operations>=l.progress.allowance?'Add '+l.criteria.budget+' operations and continue':'Resume within remaining allowance')+'</button>':'')+'<button type="button" class="primary-btn" data-cl="save" '+(active||!rows.length?'disabled':'')+'>Save list to CRM</button><button type="button" class="secondary-btn" data-cl="csv" '+(!rows.length?'disabled':'')+'>Download CSV</button><button type="button" class="secondary-btn" data-cl="xlsx" '+(!rows.length?'disabled':'')+'>Download Excel</button><button type="button" class="text-btn" data-cl="delete" '+(active?'disabled':'')+'>Delete list</button></div>'+(l.incompleteChecks?.length?'<details data-detail="incomplete"><summary>Incomplete or rejected source checks ('+l.incompleteChecks.length+')</summary>'+l.incompleteChecks.slice(-30).map(r=>'<p><a href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.company||M.domain(r.url))+'</a> · '+esc(r.reason)+'</p>').join('')+'</details>':'')+(rows.length?'<p>'+rows.length+' matching companies · Showing '+(showAll?'all companies':firstLabel+' '+Math.min(10,rows.length))+'</p>'+(rows.length>10?'<button type="button" class="secondary-btn" data-cl="show-all">'+(showAll?'Show '+firstLabel+' 10':'Show all '+rows.length+' companies')+'</button>':'')+'<div class="cl-table-wrap"><table><thead><tr>'+[['company','Company'],['location','Location'],['score','Relevance']].map(([k,v])=>'<th'+(sort===k?' aria-sort="'+(descending?'descending':'ascending')+'"':'')+'><button type="button" data-cl="sort" data-sort="'+k+'">'+v+(sort===k?(descending?' ↓':' ↑'):'')+'</button></th>').join('')+'<th>Profiles, signals and evidence</th><th>Next step</th></tr></thead><tbody>'+(showAll?rows:rows.slice(0,10)).map(r=>'<tr><td><strong>'+esc(r.company)+'</strong><a href="'+esc(r.website)+'" target="_blank" rel="noopener noreferrer">'+esc(r.domain)+' ↗</a></td><td>'+esc(r.location)+'</td><td><strong>'+r.score+'</strong>'+(r.fitScore!==undefined?'<small>Profile fit '+esc(r.fitScore)+'/90 · Signal bonus +'+esc(r.signalBonus)+'/10</small>':'')+'<small>Buying intent unconfirmed</small></td><td><details data-detail="company:'+esc(r.domain)+'"><summary>'+esc(r.matches.map(m=>m.name).join(', '))+'</summary>'+r.matches.map(m=>'<p><strong>'+esc((m.kind==='profile'?'Profile: ':m.kind==='signal'?'Buying signal: ':'')+m.name)+'</strong>'+matchScore(m)+'</p><p>'+esc(m.reason)+'</p><blockquote>'+esc(m.quote)+'</blockquote><a href="'+esc(m.url)+'" target="_blank" rel="noopener noreferrer">Source'+(m.date?' · '+esc(m.date):'')+' ↗</a>'+(m.referenceName?'<p>Similar to '+esc(m.referenceName)+': '+esc(m.referenceQuote)+(m.referenceUrl?' <a href="'+esc(m.referenceUrl)+'" target="_blank" rel="noopener noreferrer">Reference source ↗</a>':'')+'</p>':'')).join('')+(r.profileMatches?.some(m=>m.opportunityUrl)?r.profileMatches.filter(m=>m.opportunityUrl).map(m=>'<p>Opportunity: '+esc(m.opportunityTitle)+' <a href="'+esc(m.opportunityUrl)+'" target="_blank" rel="noopener noreferrer">Saved opportunity source ↗</a></p>').join(''):'')+(r.quality?'<p>Evidence review: '+esc(r.quality.reason)+'</p>':'<p>Earlier evidence policy; no separate review was recorded.</p>')+(r.commercialFit?'<p>Commercial fit: '+esc(r.commercialFit.reason)+'</p>':'')+'<p>Checked '+esc(new Date(r.checkedAt).toLocaleString())+'</p></details></td><td><button type="button" class="secondary-btn" data-cl="buyer" data-domain="'+esc(r.domain)+'" '+(active?'disabled':'')+'>Find buyers →</button></td></tr>').join('')+'</tbody></table></div>':'<p>No verified matches yet. Incomplete research does not mean no matching companies exist.</p>');for(const detail of content.querySelectorAll('details'))detail.open=expanded.has(detail.dataset.detail);
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
    current=(await api({}, {action:'start',...prepared})).list;render();
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
   const result=await api({}, {action:command,id:list.id,revision:list.revision,...(command==='buyer'?{domain:b.dataset.domain}:{})});
   if(command==='delete'){
    if(savedSearch?.id===list.id){searchEpoch++;savedSearch=null;paintSearch();}
    return showLists();
   }
   if(command==='buyer'){await root.LeadIntelDiscoveryUI?.openListCompany?.(result.candidate);return;}
   current=result.list;render();
  },command==='review'||command==='start');
 }
 root.addEventListener('leadintel:journey-focus-changed',e=>{if($('company-list-panel'))$('company-list-panel').hidden=e.detail?.focus==='buyers';});
 root.LeadIntelCompanyListUI={mount,refreshSearch,open: id=>action(()=>id?open(id):showLists())};
 const init=()=>{mount();mountSearch();const observer=new MutationObserver(()=>{if(!$('company-list-panel'))mount();mountCrm();mountSearch();});observer.observe(document.body,{childList:true,subtree:true});};
 for(const type of ['leadintel:server-ready','leadintel:session-changed','leadintel:account-changed','storage'])root.addEventListener(type,()=>{synchronize();void refreshSearch();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
