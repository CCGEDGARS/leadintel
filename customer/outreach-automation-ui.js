(function(root){
'use strict';
const ID='outreach-automation-panel';
let policy=null,status=null,approvedPackage=null,busy=false;
const days=[['1','Mon'],['2','Tue'],['3','Wed'],['4','Thu'],['5','Fri'],['6','Sat'],['0','Sun']];
function bridge(){return root.LeadIntelServerBridge||null;}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function css(){if(document.querySelector('link[data-outreach-automation-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./outreach-automation.css?v=20260929-delivery-setup-v1';l.dataset.outreachAutomationCss='1';document.head.appendChild(l);}
function anchor(){return document.querySelector('.step-view[data-step="7"]')||document.querySelector('.step-view[data-step="6"]')||document.querySelector('#delivery')||document.querySelector('#outreach')||document.querySelector('main')||document.body;}
function isOwner(){return String(status?.role||policy?.role||'')==='owner';}
function serverPolicy(){return policy?.policy||policy||{automaticDelivery:'manual_only'};}
function serverStatus(){return status||{};}
function renderSetup(){
  const brand=document.getElementById('brand-identity');if(!brand)return;
  let card=document.getElementById('delivery-setup');if(!card){card=document.createElement('section');card.id='delivery-setup';card.className='panel brand-identity-panel delivery-setup';brand.after(card);}
  const p=serverPolicy(),ready=Boolean(policy),locked=p.automaticDelivery==='manual_only',owner=isOwner();
  const limit=Number(p.workspaceDailyLimit||20),preset=[5,10,20].includes(limit)?String(limit):'custom';
  card.innerHTML=`<div class="brand-identity-summary"><div class="brand-identity-intro"><span class="eyebrow">Email delivery</span><h3>Delivery settings</h3><p>Choose how many emails LeadIntel may send automatically each day. Review and approve messages before activating automatic delivery.</p></div><span class="brand-identity-status">${locked?'Manual delivery':p.mode==='automatic'&&p.enabled?'Automatic delivery on':'Manual delivery'}</span></div>
    <div class="delivery-setup-controls"><label for="delivery-setup-limit">Automatic daily limit</label><select id="delivery-setup-limit" ${!ready||!owner?'disabled':''}><option value="5" ${preset==='5'?'selected':''}>5 emails</option><option value="10" ${preset==='10'?'selected':''}>10 emails</option><option value="20" ${preset==='20'?'selected':''}>20 emails</option><option value="custom" ${preset==='custom'?'selected':''}>Custom</option></select><input id="delivery-setup-custom" type="number" min="1" max="500" value="${esc(limit)}" aria-label="Custom automatic daily limit" ${preset==='custom'?'':'hidden'} ${!ready||!owner?'disabled':''}><button id="delivery-setup-save" class="secondary-btn" type="button" ${!ready||!owner?'disabled':''}>Save daily limit</button></div>
    <p class="delivery-setup-note">${locked?'Automatic sending is not available yet. Saving a limit will not send email.':'One Gmail mailbox is connected per workspace today. The sending window and mailbox rules may allow fewer messages than this limit. Set the mode, schedule and pause controls in Delivery.'}</p><p id="delivery-setup-message" role="status" aria-live="polite"></p>`;
  const choice=card.querySelector('#delivery-setup-limit'),custom=card.querySelector('#delivery-setup-custom');
  choice.addEventListener('change',()=>{custom.hidden=choice.value!=='custom';});
  card.querySelector('#delivery-setup-save').addEventListener('click',async()=>{
    const value=Number(choice.value==='custom'?custom.value:choice.value),notice=card.querySelector('#delivery-setup-message');
    if(!Number.isInteger(value)||value<1||value>500){notice.textContent='Choose a whole number from 1 to 500.';return;}
    const b=bridge();if(!b?.saveOutreachAutomationPolicy){notice.textContent='Sign in to save this setting.';return;}
    const button=card.querySelector('#delivery-setup-save');button.disabled=true;
    const result=await b.saveOutreachAutomationPolicy({...p,workspaceDailyLimit:value,mailboxDailyLimit:value});
    button.disabled=false;if(!result.ok){notice.textContent=result.error||'Could not save the daily limit.';return;}
    await refresh();document.getElementById('delivery-setup-message').textContent='Daily limit saved. No emails were sent.';
  });
}
function selectedDays(p){const set=new Set((p.workingDays||[1,2,3,4,5]).map(String));return days.map(([n,label])=>`<label class="oa-day"><input type="checkbox" data-oa-day="${n}" ${set.has(n)?'checked':''}>${label}</label>`).join('');}
function queueEligibility(){const p=serverPolicy(),b=bridge();return Boolean(isOwner()&&p.mode==='automatic'&&p.enabled&&b?.gmail?.connected&&approvedPackage&&!busy);}
function render(){
  renderSetup();
  const p=serverPolicy();const s=serverStatus();let el=document.getElementById(ID);if(!el){el=document.createElement('section');el.id=ID;el.className='outreach-automation-panel';anchor().appendChild(el);}
  if(p.automaticDelivery==='manual_only'){
    el.innerHTML=`<div class="oa-head"><div><span class="oa-kicker">Gmail delivery</span><h3>Manual delivery only</h3><p>Automatic Gmail delivery is disabled. Review each approved message and use the explicit Send with Gmail action in Delivery &amp; Learning.</p></div><span class="oa-role">Manual only</span></div>`;
    return;
  }
  const owner=isOwner();const usage=s.usage||{},q=s.queue||{};
  const custom=!['5','10','20'].includes(String(p.workspaceDailyLimit||20));
  el.innerHTML=`
  <div class="oa-head"><div><span class="oa-kicker">Outreach Automation</span><h3>Safe automatic Gmail outreach</h3><p>Manual stays available. Automatic sends only approved contacts under server-enforced limits.</p></div><span class="oa-role">${owner?'Owner controls':'Read only'}</span></div>
  <div class="outreach-automation-grid">
    <div class="oa-card"><h4>Mode & limits</h4>
      <label>Mode<select id="oa-mode"><option value="manual" ${p.mode!=='automatic'?'selected':''}>Manual</option><option value="automatic" ${p.mode==='automatic'?'selected':''}>Automatic</option></select></label>
      <label class="oa-toggle"><input id="oa-enabled" type="checkbox" ${p.enabled?'checked':''}> Automation enabled</label>
      <label>Workspace daily limit<select id="oa-workspace-limit"><option>5</option><option>10</option><option>20</option><option value="custom" ${custom?'selected':''}>Custom</option></select></label>
      <input id="oa-custom-limit" type="number" min="1" max="500" value="${esc(p.workspaceDailyLimit||20)}" ${custom?'':'hidden'} aria-label="Custom daily limit">
      <label>Mailbox daily limit<input id="oa-mailbox-limit" type="number" min="1" max="500" value="${esc(p.mailboxDailyLimit||20)}"><small>One Gmail mailbox per workspace today. Both limits apply; the sending window may allow fewer messages.</small></label>
    </div>
    <div class="oa-card"><h4>Schedule</h4><span class="oa-label">Working days</span><div class="oa-days">${selectedDays(p)}</div>
      <label>Timezone<input id="oa-timezone" value="${esc(p.timezone||'Europe/Riga')}"></label>
      <div class="oa-two"><label>Send window start<input id="oa-window-start" type="time" value="${esc(p.sendWindowStart||'09:00')}"></label><label>Send window end<input id="oa-window-end" type="time" value="${esc(p.sendWindowEnd||'16:30')}"></label></div>
      <span class="oa-label">Delay range</span><div class="oa-two"><label>Min minutes<input id="oa-delay-min" type="number" min="1" value="${esc(p.minDelayMinutes||8)}"></label><label>Max minutes<input id="oa-delay-max" type="number" min="1" value="${esc(p.maxDelayMinutes||18)}"></label></div>
    </div>
    <div class="oa-card"><h4>Follow-ups</h4><label>Follow-ups<input id="oa-followups" type="number" min="0" max="5" value="${esc(p.maxFollowups??2)}"></label><label>Follow-up delays, days<input id="oa-followup-days" value="${esc((p.followupDelaysDays||[3,7]).join(','))}"></label><label>Reply polling, minutes<input id="oa-reply-poll" type="number" min="60" value="${esc(p.replyPollIntervalMinutes||60)}"></label></div>
    <div class="oa-card oa-status"><h4>Live status</h4><div><strong>${esc(usage.workspaceSentToday||0)} / ${esc(usage.workspaceLimit||p.workspaceDailyLimit||20)}</strong><span>Sent today</span></div><div><strong>${esc(q.queued||0)}</strong><span>Queue</span></div><div><strong>${esc(q.nextEligibleSendAt||'—')}</strong><span>Next send</span></div><div><strong>${esc(q.blockedByLimit||0)}</strong><span>Blocked reason: daily limit</span></div></div>
  </div>
  <div class="oa-actions"><button id="oa-save" class="oa-primary">Save settings</button><button id="oa-pause">${p.paused?'Resume automation':'Pause automation'}</button><button id="oa-stop" class="oa-danger">${p.emergencyStop?'Clear emergency stop':'Emergency stop'}</button><button id="oa-refresh">Refresh status</button></div>
  <div class="oa-queue-preview"><div><h4>Queue preview</h4><p>${q.queued?`${esc(q.queued)} approved message(s) waiting.`:'No approved messages waiting.'} ${q.blockedByLimit?`${esc(q.blockedByLimit)} blocked by limit.`:''}</p></div><button id="oa-enqueue" ${queueEligibility()?'':'disabled'}>Add approved contact to automatic queue</button></div>
  <p id="oa-package-note" class="oa-note">${approvedPackage?`Approved package ready for ${esc(approvedPackage.recipient||approvedPackage.domain||'contact')}.`:'Approve an outreach package first. Automatic queueing never selects a contact by itself.'}</p>
  <p id="oa-message" class="oa-message" aria-live="polite"></p>`;
  el.querySelectorAll('input,select,button').forEach(node=>{if(!owner&&node.id!=='oa-refresh')node.disabled=true;});
  const limit=el.querySelector('#oa-workspace-limit');if(limit)limit.value=custom?'custom':String(p.workspaceDailyLimit||20);limit?.addEventListener('change',()=>{el.querySelector('#oa-custom-limit').hidden=limit.value!=='custom';});
  bind(el);
}
function message(text,error=false){const el=document.getElementById('oa-message');if(el){el.textContent=text||'';el.dataset.error=error?'1':'0';}}
function readPolicy(){const el=document.getElementById(ID);const limitChoice=el.querySelector('#oa-workspace-limit').value;const limit=limitChoice==='custom'?Number(el.querySelector('#oa-custom-limit').value):Number(limitChoice);return {mode:el.querySelector('#oa-mode').value,enabled:el.querySelector('#oa-enabled').checked,paused:Boolean(serverPolicy().paused),emergencyStop:Boolean(serverPolicy().emergencyStop),workspaceDailyLimit:limit,mailboxDailyLimit:Number(el.querySelector('#oa-mailbox-limit').value),workingDays:[...el.querySelectorAll('[data-oa-day]:checked')].map(x=>Number(x.dataset.oaDay)),timezone:el.querySelector('#oa-timezone').value.trim(),sendWindowStart:el.querySelector('#oa-window-start').value,sendWindowEnd:el.querySelector('#oa-window-end').value,minDelayMinutes:Number(el.querySelector('#oa-delay-min').value),maxDelayMinutes:Number(el.querySelector('#oa-delay-max').value),maxFollowups:Number(el.querySelector('#oa-followups').value),followupDelaysDays:el.querySelector('#oa-followup-days').value.split(',').map(x=>Number(x.trim())).filter(Number.isFinite),replyPollIntervalMinutes:Number(el.querySelector('#oa-reply-poll').value)};}
async function refresh(){const b=bridge();if(!b?.getOutreachAutomationPolicy||!b?.getOutreachAutomationStatus)return;const [p,s]=await Promise.all([b.getOutreachAutomationPolicy(),b.getOutreachAutomationStatus()]);if(!p.ok||!s.ok){message(p.error||s.error||'Unable to load automation status',true);return;}policy=p;status=s;render();}
async function mutate(next,success){const b=bridge();if(!b?.saveOutreachAutomationPolicy)return;busy=true;render();const result=await b.saveOutreachAutomationPolicy(next);busy=false;if(!result.ok){render();message(result.error||'Settings were not saved',true);return;}await refresh();message(success||'Automation settings saved.');}
async function save(){const next=readPolicy();if(next.mode==='automatic'&&next.enabled){const ok=window.confirm('Activate Automatic outreach? Approved contacts may be emailed without per-message confirmation. Server limits, send windows, pause, emergency stop, suppression and reply-stop rules remain enforced.');if(!ok)return;}await mutate(next,'Automation settings saved.');}
function bind(el){
  el.querySelector('#oa-save')?.addEventListener('click',save);
  el.querySelector('#oa-refresh')?.addEventListener('click',refresh);
  el.querySelector('#oa-pause')?.addEventListener('click',()=>mutate({...serverPolicy(),paused:!serverPolicy().paused},serverPolicy().paused?'Automation resumed.':'Automation paused.'));
  el.querySelector('#oa-stop')?.addEventListener('click',()=>mutate({...serverPolicy(),emergencyStop:!serverPolicy().emergencyStop},serverPolicy().emergencyStop?'Emergency stop cleared.':'Emergency stop activated.'));
  el.querySelector('#oa-enqueue')?.addEventListener('click',enqueueApproved);
}
async function enqueueApproved(){const b=bridge();const p=serverPolicy();if(!(p.mode==='automatic'&&p.enabled&&b?.gmail?.connected&&approvedPackage))return;busy=true;render();const result=await b.enqueueOutreachAutomation(approvedPackage);busy=false;if(!result.ok){render();message(result.error||'Approved contact was not queued',true);return;}approvedPackage=null;await refresh();message('Approved contact added to automatic queue.');}
function receivePackage(event){const value=event?.detail;if(!value||typeof value!=='object')return;approvedPackage={...value,approved_at:value.approved_at||value.approvedAt||new Date().toISOString(),approved:true};render();}
function init(){if(typeof document==='undefined')return;css();root.addEventListener?.('leadintel:approved-outreach-package',receivePackage);root.addEventListener?.('leadintel:server-ready',()=>refresh());root.addEventListener?.('leadintel:module-opened',()=>{if(!document.getElementById(ID))render();});render();setTimeout(refresh,0);}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
root.LeadIntelOutreachAutomationUI={refresh,receivePackage,enqueueApproved};
})(typeof window!=='undefined'?window:globalThis);
