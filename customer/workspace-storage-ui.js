(function(root){
 'use strict';
 if(root.LeadIntelStorage)return;
 const document=root.document,apiBase='https://leadintel-api.edgars-7e7.workers.dev';
 let data=null,dataContext='',error='',epoch=0,busy=false,refreshTimer=null,blockedContext='';
 const bridge=()=>root.LeadIntelServerBridge;
 const signedIn=()=>Boolean(bridge()?.session?.authenticated&&bridge()?.workspace?.id&&bridge()?.ready!==false);
 const context=()=>signedIn()?`${bridge().session.user?.id||''}:${bridge().workspace.id}:${bridge().workspace.role||''}`:'';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bytes=value=>{const n=Math.max(0,Number(value)||0);if(n>=1e9)return `${+(n/1e9).toFixed(2)} GB`;if(n>=1e6)return `${+(n/1e6).toFixed(2)} MB`;if(n>=1e3)return `${+(n/1e3).toFixed(1)} KB`;return `${n} B`;};
 function scoped(){return dataContext===context()?data:null;}
 function attentionItems(){
  if(!signedIn())return [];
  const status=scoped(),items=[];
  if(status?.billing?.payment_issue)items.push({id:'storage-payment',severity:'error',title:'Storage payment needs attention',detail:'Update the payment method in Settings → Storage. Existing data is preserved.',target:{type:'settings'}});
  if(status&&(status.records.state==='full'||status.files.state==='full'||blockedContext===context()))items.push({id:'storage-full',severity:'error',title:'Storage limit needs attention',detail:'New storage growth is paused. Open Settings → Storage to upgrade or reduce stored content.',target:{type:'settings'}});
  else if(status&&(status.records.state==='warning'||status.files.state==='warning'))items.push({id:'storage-warning',severity:'recommendation',title:'Storage is nearing its allowance',detail:'At least 80% is used. Review your allowance in Settings → Storage.',target:{type:'settings'}});
  if(error)items.push({id:'storage-connection',severity:'recommendation',title:'Storage status needs a recheck',detail:'The usage check could not connect. Retry in Settings → Storage.',target:{type:'settings'}});
  if(status?.billing?.available===false)items.push({id:'storage-billing-connection',severity:'recommendation',title:'Storage billing is temporarily unavailable',detail:'Usage and saved data remain available. Retry billing in Settings → Storage.',target:{type:'settings'}});
  return items;
 }
 function meter(label,m){const used=bytes(m.used_bytes),limit=bytes(m.limit_bytes);return `<div class="storage-meter"><div><strong>${label}</strong><span>${m.measured===false?'Calculating existing usage…':`${used} / ${limit}`}</span></div>${m.measured===false?'':`<progress max="${Number(m.limit_bytes)}" value="${Math.min(Number(m.used_bytes),Number(m.limit_bytes))}" aria-label="${label}: ${used} of ${limit}"></progress>`}</div>`;}
 function priceLabel(status){const price=status.upgrade?.price;if(!price)return 'Monthly price will appear when billing is activated.';return `${new Intl.NumberFormat('en-IE',{style:'currency',currency:price.currency}).format(price.amount_minor/100)}/month${price.tax_behavior==='inclusive'?' · tax included':' · before applicable tax'}`;}
 function render(){
  const host=document.getElementById('workspace-storage-card');if(!host)return;
  const status=scoped(),issues=attentionItems(),red=issues.some(x=>x.severity==='error');
  host.className='workspace-storage-card'+(red?' is-error':issues.length?' is-warning':'');
  const title=`<div class="storage-card-head"><div><span class="eyebrow">Your workspace</span><h3>Storage</h3></div><span class="storage-plan">${esc(status?.plan?.name||'Included')}</span></div>`;
  if(!signedIn()){host.innerHTML=title+'<p>Sign in to view your private storage usage.</p><p class="storage-note">Included per workspace: 100 MB of CRM/workspace data and 1 GB of files. Shared by its members.</p>';return;}
  host.innerHTML=title+`<p class="storage-note">One allowance for this workspace, shared by its members.</p>${status?meter('CRM & workspace data',status.records)+meter('Files',status.files):'<p role="status">Checking storage usage…</p>'}
   ${status?.billing?.payment_issue?'<p class="storage-alert" role="alert">Storage payment needs attention. Update your payment method. Saved data is preserved.</p>':''}
   ${status&&(status.records.state==='full'||status.files.state==='full'||blockedContext===context())?'<p class="storage-alert" role="alert">The storage allowance blocks new growth. Upgrade or reduce stored content. Existing data remains readable.</p>':''}
   <p data-storage-connection class="${error?'is-warning':''}" role="status">${error?'Storage check could not connect. Retry; saved data is preserved.':''}</p>
   <div class="storage-upgrade"><strong>Storage Plus</strong><span>${bytes(status?.upgrade?.records_limit_bytes||500000000)} of CRM/workspace data + ${bytes(status?.upgrade?.files_limit_bytes||10000000000)} of files</span><small>${esc(status?priceLabel(status):'Checking upgrade availability…')}</small></div>
   <p class="storage-note">Pay securely through Stripe. Extra capacity starts after payment is confirmed. AI and research credits are separate.</p>
   ${status?.billing?.setup_required?'<p class="storage-setup">Billing setup is in progress. Included storage is available.</p>':''}
   ${status?.billing?.available===false?`<p class="storage-setup is-warning" role="status">${esc(status.billing.message||'Storage billing is temporarily unavailable. Your usage and saved data remain available.')}</p>`:''}
   <div class="storage-actions"><button class="ai-settings-btn primary" data-storage-action="checkout" type="button" ${busy||!status?.billing?.can_upgrade?'disabled':''}>${busy?'Opening…':'Upgrade storage'}</button><button class="ai-settings-btn" data-storage-action="portal" type="button" ${busy||!status?.billing?.can_manage?'disabled':''}>Manage billing</button><button class="ai-settings-btn" data-storage-action="refresh" type="button">Refresh usage</button></div>
   ${bridge()?.workspace?.role!=='owner'?'<small>Only the workspace owner can change its storage plan.</small>':''}`;
 }
 function changed(){render();root.dispatchEvent(new root.CustomEvent('leadintel:storage-status-changed'));}
 async function refresh(){
  const requested=context(),requestEpoch=++epoch;
  if(!requested){data=null;dataContext='';error='';changed();return;}
  try{
   const response=await root.fetch(`${apiBase}/api/storage/status?workspace_id=${encodeURIComponent(bridge().workspace.id)}`,{credentials:'include',headers:{Accept:'application/json'}});
   const next=await response.json();if(requestEpoch!==epoch||context()!==requested)return;
   if(!response.ok||next.workspace_id!==bridge().workspace.id)throw Error('Storage status unavailable');
   if(data&&blockedContext===requested&&(next.plan.key!==data.plan.key||next.records.used_bytes<data.records.used_bytes||next.files.used_bytes<data.files.used_bytes))blockedContext='';
   data=next;dataContext=requested;error='';changed();
  }catch{if(requestEpoch!==epoch||context()!==requested)return;error='unavailable';changed();}
 }
 async function action(kind){
  if(kind==='refresh')return refresh();
  const requested=context(),status=scoped();if(!requested||busy||bridge()?.workspace?.role!=='owner'||!(kind==='checkout'?status?.billing.can_upgrade:status?.billing.can_manage))return;
  busy=true;render();
  try{
   const response=await root.fetch(`${apiBase}/api/storage/${kind}?workspace_id=${encodeURIComponent(bridge().workspace.id)}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:'{}'});
   const result=await response.json();if(context()!==requested)return;
   if(!response.ok)throw Error('Billing unavailable');
   const url=new URL(result.url);if(url.protocol!=='https:'||url.username||url.password||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw Error('Invalid billing destination');
   root.location.assign(url.toString());
  }catch{if(context()===requested){error='unavailable';changed();}}
  finally{busy=false;render();}
 }
 function mount(){
  const drawer=document.getElementById('ai-settings-drawer');if(!drawer||document.getElementById('workspace-storage-card'))return;
  if(!document.querySelector('[data-workspace-storage-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='workspace-storage.css?v=20261012-v1';css.dataset.workspaceStorageCss='1';document.head.appendChild(css);}
  const card=document.createElement('section');card.id='workspace-storage-card';card.setAttribute('aria-label','Workspace storage');
  const anchor=document.getElementById('communication-integration-heading')?.closest('section')||document.getElementById('ai-engine-summary');if(anchor)anchor.insertAdjacentElement('afterend',card);else drawer.appendChild(card);
  card.addEventListener('click',event=>{const button=event.target.closest('[data-storage-action]');if(button)void action(button.dataset.storageAction);});render();
 }
 function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=root.setTimeout(()=>void refresh(),500);}
 root.LeadIntelStorage={refresh,attentionItems};
 root.addEventListener('leadintel:settings-opened',()=>{mount();void refresh();});
 root.addEventListener('leadintel:server-ready',()=>{mount();void refresh();});
 root.addEventListener('leadintel:workspace-changed',()=>{++epoch;data=null;dataContext='';error='';blockedContext='';busy=false;changed();});
 root.addEventListener('leadintel:server-synced',scheduleRefresh);
 root.addEventListener('leadintel:storage-quota-rejected',event=>{if(signedIn()&&event.detail?.workspaceId===bridge().workspace.id&&event.detail.context===context()){blockedContext=context();changed();scheduleRefresh();}});
 root.addEventListener('focus',()=>{if(document.getElementById('workspace-storage-card'))scheduleRefresh();});
 const observer=new root.MutationObserver(mount);observer.observe(document.documentElement,{childList:true,subtree:true});
 mount();
})(window);
