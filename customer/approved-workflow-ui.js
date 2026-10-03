(function(root){
  'use strict';
  const API='https://leadintel-api.edgars-7e7.workers.dev';
  const labels={profile:'Company profile',strategy:'Market strategy',companies:'Company discovery',buyers:'Buyer selection',triggers:'Buying signals',messages:'Message template',crm:'CRM records',delivery:'Delivery and follow-up'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data=null,workspace='',busy=false,dirty=false,dialog,timer;
  const bridge=()=>root.LeadIntelServerBridge;
  function notice(message){dialog.querySelector('[data-wf-notice]').textContent=message;}
  async function api(body){
    const id=bridge()?.workspace?.id;
    if(!bridge()?.session?.authenticated||!id)throw new Error('Sign in to configure automatic execution.');
    if(body&&workspace!==id)throw new Error('Workspace changed. Refresh the workflow before changing settings.');
    if(workspace&&workspace!==id){data=null;dirty=false;}
    workspace=id;
    const response=await fetch(API+'/api/approved-workflow?workspace_id='+encodeURIComponent(id),{method:body?'POST':'GET',credentials:'include',headers:{Accept:'application/json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const value=await response.json().catch(()=>({}));
    if(bridge()?.workspace?.id!==id)throw new Error('Workspace changed. Refresh the workflow before continuing.');
    if(!response.ok)throw new Error(value.error||'Could not load the workflow.');
    return value;
  }
  function field(name,label,value,type='text',extra=''){
    return '<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
  }
  function summary(stage){
    const c=data.config,p=data.context.profile||{},signals=data.context.signals.filter(x=>x.active).map(x=>x.name).join(', ');
    return {
      profile:(p.companyName||'Company not set')+' · '+(p.priorityOffers||'Offer not set'),
      strategy:'Markets: '+(p.targetMarkets||'Not set')+'. Exclusions: '+(p.exclusions||'None provided')+'. Signals: '+(signals||'None active')+'.',
      companies:'Research up to '+c.companies.queries+' market queries and '+c.companies.limit+' companies per cycle, with company-level verification. Only qualified companies advance.',
      buyers:'Research a pool of up to 20 and recommend up to six. Eligible saved buyers receive priority; a verified business email is mandatory. Roles: '+(c.buyers.roles.join(', ')||'Not selected')+'. '+(c.buyers.enrich?'Apollo may enrich one buyer per qualified company.':'Use existing verified CRM contacts.')+' Personal email and phone lookup are off.',
      triggers:'Minimum qualification score '+c.triggers.minimumScore+'/100. '+({lookalike:'Lookalike fit must be supported by quoted reference traits; buying intent stays unconfirmed.',signals:'Current dated buying signals are required.',balanced:'Either verified route may qualify; companies passing both receive priority.'}[c.companies.researchPriority||'balanced'])+' Company verification must be current within '+c.triggers.maxEvidenceAgeDays+' days. Identity, geography, offer fit, independent evidence and exclusion checks remain mandatory.',
      messages:'Subject: '+(c.messages.subject||'Not written')+'\n\n'+(c.messages.body||'Write the template below.')+(c.messages.followup?'\n\nFollow-up: '+c.messages.followup:''),
      crm:'Save companies, verified contacts, evidence, scores and messages in this workspace’s CRM. Keep records when automation stops. Archived, suppressed and existing customers are excluded.',
      delivery:c.delivery.dailyLimit+' emails per day · '+c.delivery.timezone+' · Monday–Friday '+c.delivery.sendWindowStart+'–'+c.delivery.sendWindowEnd+'. Research '+c.delivery.frequency+'. '+(c.messages.followup?'One follow-up after 3 business days.':'No follow-up.')+' Messages are spaced 8–18 minutes apart. Stop follow-ups on replies. No repeat initial outreach to an already contacted recipient.'
    }[stage];
  }
  function render(){
    const c=data.config,owner=data.role==='owner',active=data.status==='automatic',approved=data.stages.every(x=>x.approved);
    dirty=false;
    let html='<div class="wf-status"><strong>'+esc({manual:'Manual control',automatic:'Automatic workflow approved',paused:'Paused',stopped:'Stopped',needs_review:'Changes need review'}[data.status]||data.status)+'</strong><span>'+(data.approvedAt?'Approved '+esc(new Date(data.approvedAt).toLocaleString()):'Automatic execution is off')+'</span></div>';
    html+='<p>Configure and review every stage. Final approval lets the server run the workflow while this page is closed. You can pause or take over at any time.</p><form data-wf-form><div class="wf-grid">';
    html+=field('companies','Companies per cycle',c.companies.limit,'number','min="1" max="10" required')+field('queries','Market queries per cycle',c.companies.queries,'number','min="1" max="8" required')+field('roles','Buyer roles',c.buyers.roles.join(', '),'text','placeholder="Enter the roles you want to contact" required');
    html+='<label class="wf-check"><input type="checkbox" checked disabled>Automatically verify emails before sending · Required</label>';
    html+='<label class="wf-check"><input name="enrich" type="checkbox" '+(c.buyers.enrich?'checked':'')+'>Find and enrich buyers with Apollo</label>';
    html+='<label>Discovery mode<select name="priority">'+[['lookalike','Lookalike'],['signals','Signals'],['balanced','Balanced']].map(([value,label])=>'<option value="'+value+'" '+((c.companies.researchPriority||'balanced')===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label><label>Minimum qualification score<select name="score">'+[70,80,90].map(value=>'<option value="'+value+'" '+(c.triggers.minimumScore===value?'selected':'')+'>'+value+'/100'+(value===80?' · Recommended':'')+'</option>').join('')+'</select></label>'+field('age','Maximum evidence age (days)',c.triggers.maxEvidenceAgeDays,'number','min="1" max="365" required')+field('limit','Daily email limit',c.delivery.dailyLimit,'number','min="1" max="50" required');
    html+='<label>Research frequency<select name="frequency"><option value="daily" '+(c.delivery.frequency==='daily'?'selected':'')+'>Daily</option><option value="weekly" '+(c.delivery.frequency==='weekly'?'selected':'')+'>Weekly</option></select></label>';
    html+=field('timezone','Timezone',c.delivery.timezone,'text','required')+field('start','Weekday sending starts',c.delivery.sendWindowStart,'time','required')+field('end','Weekday sending ends',c.delivery.sendWindowEnd,'time','required')+'</div>';
    html+=field('subject','Email subject',c.messages.subject,'text','required')+'<label>Email template<textarea name="body" rows="5" required>'+esc(c.messages.body)+'</textarea></label><label>Optional follow-up<textarea name="followup" rows="3">'+esc(c.messages.followup)+'</textarea></label>';
    html+='<p class="wf-hint">Available fields: {{firstName}}, {{company}}, {{sender}}, {{offer}}, {{evidenceUrl}}. They insert verified data into your approved wording. Missing values stop the run.</p><button type="submit" '+(!owner?'disabled':'')+'>Save workflow settings</button></form><ol class="wf-stages">';
    data.stages.forEach((stage,i)=>{html+='<li><details><summary><span>'+(i+1)+'. '+labels[stage.stage]+'</span><strong>'+(stage.approved?'Approved':'Review needed')+'</strong></summary><p class="wf-review">'+esc(summary(stage.stage))+'</p><button data-wf-approve="'+stage.stage+'" '+(!owner||stage.approved||data.stages.slice(0,i).some(s=>!s.approved)?'disabled':'')+'>'+(stage.approved?'Approved':'Approve this stage')+'</button></details></li>';});
    html+='</ol>';
    if(data.blockers.length)html+='<div class="wf-blockers"><strong>Before activation</strong><ul>'+data.blockers.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul></div>';
    html+='<div class="wf-final"><label class="wf-check"><input data-wf-final type="checkbox" '+(!owner||!approved||data.blockers.length||active?'disabled':'')+'>I approve automatic research, buyer enrichment, CRM updates and email delivery within these rules and limits.</label>'+actionButton('activate','Approve and start automatic workflow',!owner||!approved||data.blockers.length||active)+'<p>Provider calls already in progress may finish after you pause. A sent email cannot be recalled.</p></div><div class="wf-actions">';
    html+=actionButton('pause','Pause',!owner||!active)+actionButton('manual','Take over manually',!owner||!active)+actionButton('stop','Stop workflow',!owner||!data.revision||data.status==='stopped')+actionButton('resume','Resume automatic workflow',!owner||!data.approvedAt||active||!approved||data.blockers.length)+actionButton('run','Run now',!owner||!active)+'<button data-wf-refresh>Refresh status</button></div><h3>Run history</h3>';
    if(data.nextRunAt)html+='<p>Next research cycle: '+esc(new Date(data.nextRunAt).toLocaleString())+'. The server checks scheduled work hourly.</p>';
    html+=data.runs.length?data.runs.map(run=>'<details class="wf-run"><summary>'+esc(new Date(run.created_at).toLocaleString())+' · '+esc(run.status)+' · '+(run.result?.candidates?.length||0)+' qualified companies · '+(run.result?.queued||0)+' new emails queued</summary><p>'+esc(run.error_message||'')+'</p>'+((run.result?.skippedWithoutVerifiedBuyer||0)>0?'<p>'+run.result.skippedWithoutVerifiedBuyer+' companies skipped because no verified buyer matched the approved roles.</p>':'')+(run.status==='completed'&&!run.result?.candidates?.length?'<p>No company passed the approved qualification route, threshold, evidence and buyer checks. No emails were queued.</p>':'')+'<ul>'+(run.result?.candidates||[]).map(c=>'<li><details><summary>'+esc(c.company)+' · '+esc(c.qualification?.score==null?'Not yet scored':c.qualification.score+'/100 · '+c.qualification.route)+' · '+esc(c.contact?.name||'Buyer not found yet')+'</summary><p>'+esc(c.message?.subject||'')+'</p><p class="wf-review">'+esc(c.message?.body||'')+'</p><ul>'+(c.evidence||[]).filter(e=>/^https?:\/\//.test(e.url||'')).map(e=>'<li><a target="_blank" rel="noopener" href="'+esc(e.url)+'">'+esc(e.title||e.url)+'</a> '+esc(e.date||'Date unknown')+'</li>').join('')+'</ul></details></li>').join('')+'</ul>'+((run.result?.reviewBuyers||[]).length?'<details><summary>Buyers needing review</summary><ul>'+run.result.reviewBuyers.map(c=>'<li><strong>'+esc(c.company)+'</strong> · '+esc(c.reason)+'<ul>'+(c.people||[]).slice(0,6).map(p=>'<li>'+esc(p.publicName||p.name)+' · '+esc(p.title)+'</li>').join('')+'</ul></li>').join('')+'</ul></details>':'')+(run.status==='blocked'?'<p>Retry resumes the saved stage. An interrupted request may consume provider credits again.</p><button data-wf-retry="'+esc(run.id)+'" '+(!active||!owner||run.revision!==data.revision?'disabled':'')+'>Retry this run</button>':'')+'</details>').join(''):'<p>No automatic runs yet. Reviewed settings are saved on the server.</p>';
    dialog.querySelector('[data-wf-content]').innerHTML=html;
    root.LeadIntelOutreachAutomationUI?.refresh?.();
    const form=dialog.querySelector('[data-wf-form]');
    form.addEventListener('input',()=>{dirty=true;dialog.querySelectorAll('[data-wf-approve], [data-wf-action="activate"], [data-wf-action="resume"], [data-wf-action="run"]').forEach(b=>b.disabled=true);notice('Save changed settings, then review the affected stages. Until you save or pause, automatic work uses the previously saved settings.');});
    form.addEventListener('submit',event=>{event.preventDefault();const f=new FormData(form);mutate('save',{config:{qualificationVersion:3,companies:{researchPriority:f.get('priority'),limit:Number(f.get('companies')),queries:Number(f.get('queries'))},buyers:{roles:String(f.get('roles')).split(','),enrich:f.has('enrich')},triggers:{minimumScore:Number(f.get('score')),maxEvidenceAgeDays:Number(f.get('age'))},messages:{subject:f.get('subject'),body:f.get('body'),followup:f.get('followup')},delivery:{dailyLimit:Number(f.get('limit')),frequency:f.get('frequency'),timezone:f.get('timezone'),sendWindowStart:f.get('start'),sendWindowEnd:f.get('end')}}});});
    dialog.querySelectorAll('[data-wf-approve]').forEach(b=>b.addEventListener('click',()=>mutate('approve-stage',{stage:b.dataset.wfApprove})));
    dialog.querySelectorAll('[data-wf-action]').forEach(b=>b.addEventListener('click',()=>{const action=b.dataset.wfAction;if(action==='activate'&&!dialog.querySelector('[data-wf-final]').checked){notice('Check the final approval after reviewing all stages.');return;}mutate(action,{approved:action==='activate'});}));
    dialog.querySelectorAll('[data-wf-retry]').forEach(b=>b.addEventListener('click',()=>mutate('retry',{runId:b.dataset.wfRetry})));
    dialog.querySelector('[data-wf-refresh]').addEventListener('click',load);
  }
  function actionButton(action,label,disabled){return '<button data-wf-action="'+action+'" '+(disabled?'disabled':'')+'>'+label+'</button>';}
  async function load(){if(workspace&&workspace!==bridge()?.workspace?.id){dirty=false;data=null;}if(busy||dirty)return;busy=true;try{data=await api();render();notice('');}catch(error){notice(error.message);}finally{busy=false;}}
  async function mutate(action,extra={}){
    if((busy&&!['pause','stop','manual'].includes(action))||!data)return;busy=true;notice(action==='run'?'Running the approved workflow…':'Saving…');
    try{data=await api({action,revision:data.revision,...extra});render();void root.LeadIntelQualificationSettings?.refresh?.();notice(action==='activate'?'Workflow approved. The server will start the research cycle automatically.':action==='manual'?'Automatic work paused. Continue using the normal stage controls.':action==='save'?'Settings saved. Review the affected stages.':'Workflow updated.');}
    catch(error){notice(error.message);}finally{busy=false;}
  }
  function open(){
    if(!dialog){dialog=document.createElement('dialog');dialog.className='wf-dialog';dialog.innerHTML='<header><div><span class="eyebrow">Workflow controls</span><h2>Review once. Run automatically.</h2></div><button data-wf-close aria-label="Close workflow controls">Close</button></header><p data-wf-notice role="status" aria-live="polite"></p><div data-wf-content></div>';document.body.append(dialog);dialog.querySelector('[data-wf-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>clearInterval(timer));}
    dialog.showModal();load();clearInterval(timer);timer=setInterval(()=>{if(dialog.open&&!busy&&!dirty)load();},15000);
  }
  function init(){
    const style=document.createElement('link');style.rel='stylesheet';style.href='approved-workflow.css?v=20261001-v1';document.head.append(style);
    const button=document.createElement('button');button.className='wf-open';button.textContent='Workflow automation';button.type='button';button.addEventListener('click',open);
    const anchor=document.querySelector('.sidebar')||document.querySelector('.app-sidebar')||document.querySelector('aside');(anchor||document.body).append(button);
    root.LeadIntelApprovedWorkflow={open,refresh:load};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
