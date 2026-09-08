(function(root){
'use strict';
const ID='outreach-automation-panel';
let policy=null,status=null,approvedPackage=null,busy=false;
const days=[['1','Mon'],['2','Tue'],['3','Wed'],['4','Thu'],['5','Fri'],['6','Sat'],['0','Sun']];
function bridge(){return root.LeadIntelServerBridge||null;}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function css(){if(document.querySelector('link[data-outreach-automation-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./outreach-automation.css?v=20260908-v1';l.dataset.outreachAutomationCss='1';document.head.appendChild(l);}
function anchor(){return document.querySelector('.step-view[data-step="7"]')||document.querySelector('.step-view[data-step="6"]')||document.querySelector('#delivery')||document.querySelector('#outreach')||document.querySelector('main')||document.body;}
function isOwner(){return String(status?.role||policy?.role||'')==='owner';}
function serverPolicy(){return policy?.policy||policy||{};}
function serverStatus(){return status||{};}
function selectedDays(p){const set=new Set((p.workingDays||[1,2,3,4,5]).map(String));return days.map(([n,label])=>`<label class="oa-day"><input type="checkbox" data-oa-day="${n}" ${set.has(n)?'checked':''}>${label}</label>`).join('');}
function queueEligibility(){const p=serverPolicy(),b=bridge();return Boolean(isOwner()&&p.mode==='automatic'&&p.enabled&&b?.gmail?.connected&&approvedPackage&&!busy);}
function render(){
  const p=serverPolicy();const s=serverStatus();let el=document.getElementById(ID);if(!el){el=document.createElement('section');el.id=ID;el.className='outreach-automation-panel';anchor().appendChild(el);}const owner=isOwner();const usage=s.usage||{},q=s.queue||{};
  const custom=!['10','20','30','50'].includes(String(p.workspaceDailyLimit||20));
  el.innerHTML=`
  <div class="oa-head"><div><span class="oa-kicker">Outreach Automation</span><h3>Safe automatic Gmail outreach</h3><p>Manual stays available. Automatic sends only approved contacts under server-enforced limits.</p></div><span class="oa-role">${owner?'Owner controls':'Read only'}</span></div>
  <div class="outreach-automation-grid">
    <div class="oa-card"><h4>Mode & limits</h4>
      <label>Mode<select id="oa-mode"><option value="manual" ${p.mode!=='automatic'?'selected':''}>Manual</option><option value="automatic" ${p.mode==='automatic'?'selected':''}>Automatic</option></select></label>
      <label class="oa-toggle"><input id="oa-enabled" type="checkbox" ${p.enabled?'checked':''}> Automation enabled</label>
      <label>Workspace daily limit<select id="oa-workspace-limit"><option>10</option><option ${Number(p.workspaceDailyLimit||20)===20?'selected':''}>20</option><option>30</option><option>50</option><option value="custom" ${custom?'selected':''}>Custom</option></select></label>
      <input id="oa-custom-limit" type="number" min="1" max="500" value="${esc(p.workspaceDailyLimit||20)}" ${custom?'':'hidden'} aria-label="Custom daily limit">
      <label>Mailbox daily limit<input id="oa-mailbox-limit" type="number" min="1" max="500" value="${esc(p.mailboxDailyLimit||20)}"></label>
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
