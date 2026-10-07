(function(root){
 'use strict';
 const styles=[['professional','Professional','Clear & credible'],['curiosity','NLP','Curiosity & relevance'],['friendly','Friendly','Warm & personal'],['brutal','Brutal Honesty','Transparent AI introduction'],['original','AI Generated','An original, editable draft']];
 const labels={delivery_approach:'How you deliver your service',meeting_value:'What the meeting will offer',sender:'Sender name',company:'Sender company',offer:'Your offer',target:'Who you help',problem:'The problem you solve',value:'The outcome you deliver',meetingValue:'The value of the meeting',nextAction:'Your invitation'};
 function state({ready=false,pending=false,authenticated=false,missing=[],unconfirmed=[],hasDraft=false,approved=false,busy=false,invalidCalendly=false,syncConflict=false}={}){
  const required=missing.filter(k=>k!=='calendly');
  if(busy)return {kind:'busy',canGenerate:false,text:'Writing your message…'};
  if(pending)return {kind:'loading',canGenerate:false,text:'Checking your selected recipient…'};
  if(!authenticated)return {kind:'blocked',canGenerate:false,text:'Sign in to load your saved recipient and message.',action:'buyer'};
  if(syncConflict)return {kind:'blocked',canGenerate:false,text:'Resolve the workspace sync conflict before generating.',detail:'Your local changes and the saved server version are preserved.',action:'sync'};
  if(!ready)return {kind:'blocked',canGenerate:false,text:'Confirm a recipient in Buyers to start.',action:'buyer'};
  if(invalidCalendly)return {kind:'blocked',canGenerate:false,text:'Check your booking link.',detail:'Use a valid Calendly event URL in Sender & settings.',action:'settings'};
  if(unconfirmed.length)return {kind:'blocked',canGenerate:false,text:'Review '+unconfirmed.length+' Profile answer'+(unconfirmed.length===1?'':'s')+' before generating.',detail:unconfirmed.map(k=>labels[k]||k.replaceAll('_',' ')).join(' · '),action:'profile'};
  if(required.length)return {kind:'blocked',canGenerate:false,text:'Complete the information your message needs.',detail:required.map(k=>labels[k]||k).join(' · '),action:required.some(k=>['sender','company','nextAction'].includes(k))?'settings':'profile'};
  return {kind:approved?'approved':hasDraft?'draft':'ready',canGenerate:!approved,text:approved?'Approved and ready for Delivery.':hasDraft?'Your draft is ready to review and edit.':'Choose a style, then generate your message.',detail:missing.includes('calendly')?'Add your booking link in Sender & settings before approval.':''};
 }
 function mount(document){
  const q=id=>document.getElementById(id),studio=q('message-studio'),step=q('step-6');if(!studio||studio.dataset.workspaceMounted)return false;studio.dataset.workspaceMounted='true';step.classList.add('message-workspace');
  const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text)e.textContent=text;return e;};
  const header=step.querySelector('.outreach-header');header.querySelector('h1').textContent='Write a message worth answering.';header.querySelector('p').textContent='Turn your research into a personal invitation.';
  const intro=studio.querySelector(':scope > h3');intro.remove();
  const recipient=node('div','mw-recipient');recipient.innerHTML='<span class="mw-avatar" aria-hidden="true">↗</span><div><span class="mw-caption">Your recipient</span><p id="mw-recipient-text"></p><span id="mw-recipient-detail"></span></div><span id="mw-channel" class="mw-channel"></span>';
  q('message-recipient').replaceWith(recipient);q('mw-recipient-text').replaceWith(Object.assign(q('message-recipient')||node('p'),{id:'message-recipient'}));
  // Reuse canonical controls and their event listeners; no copied fields or separate state.
  const settings=studio.querySelector('details');settings.id='mw-settings';settings.open=false;settings.querySelector('summary').textContent='Sender & settings';settings.prepend(q('message-sender-identity'));settings.insertBefore(settings.querySelector('summary'),settings.firstChild);
  const source=q('message-pitch-preview').closest('details');source.querySelector('summary').textContent='Your reviewed business information';settings.append(source);
  const layout=node('div','mw-layout'),rail=node('aside','mw-rail'),editor=node('div','mw-editor');rail.setAttribute('aria-label','Message preparation');layout.append(rail,editor);studio.append(layout);
  const preparation=node('section','mw-section');preparation.innerHTML='<div class="mw-section-heading"><span class="mw-step-number">1</span><div><h3>Make it personal</h3><p>Choose a researched fact for your opening.</p></div></div><p id="mw-trigger-summary"></p>';
  const trigger=step.querySelector('.trigger-script-panel');const review=node('details','mw-trigger-review');review.innerHTML='<summary>Review a company fact</summary>';review.append(trigger);preparation.append(review);rail.append(preparation);
  trigger.querySelector('h3').hidden=true;trigger.querySelector(':scope > p').hidden=true;trigger.querySelector(':scope > small').hidden=true;
  const triggerTools=node('details','mw-extra-tools');triggerTools.innerHTML='<summary>More research tools</summary>';for(const id of ['load-trigger-alerts','save-trigger-scripts','restore-trigger-scripts','trigger-monitoring-alerts'])triggerTools.append(q(id));step.querySelector('.message-advanced').append(triggerTools);
  q('use-reviewed-trigger').textContent='Use this fact';
  const findFact=node('button','secondary-btn small','Find a stronger fact ✦');findFact.id='message-find-fact';findFact.type='button';preparation.append(findFact);
  const factStatus=node('p','','');factStatus.id='message-fact-status';factStatus.setAttribute('role','status');preparation.append(factStatus);
  const opening=node('button','secondary-btn small','Update opening only');opening.id='message-update-opening';opening.type='button';opening.disabled=true;preparation.append(opening);
  const openingHelp=node('p','mw-fact-help','Changes only the opening. Your introduction, benefits, links and closing stay intact.');preparation.append(openingHelp);
  const styleSection=node('section','mw-section');styleSection.innerHTML='<div class="mw-section-heading"><span class="mw-step-number">2</span><div><h3>Choose your style</h3><p id="mw-style-help">A proven template or an original AI draft.</p></div></div><div id="mw-style-options" class="mw-styles" role="group" aria-label="Writing style"></div>';
  styleSection.append(q('message-mode-label'),q('message-template-editor'),q('message-my-templates'));rail.append(styleSection);
  const references=node('details','mw-section mw-reference-panel');references.id='mw-writing-references';references.innerHTML='<summary>Writing references <span id="mw-reference-count">Optional · 3 slots</span></summary><div id="mw-writing-reference-host"></div>';rail.append(references,settings);
  const drafts=step.querySelector('.outreach-drafts');editor.append(drafts);drafts.querySelector('.draft-head').hidden=true;
  for(const id of ['outreach-call-opener','outreach-follow-up','outreach-objection-reply']){const card=q(id).closest('article');step.querySelector('.message-advanced').append(card);}const auxiliary=drafts.querySelector('.script-grid > details');if(auxiliary)auxiliary.remove();
  const editorHead=node('div','mw-editor-head');editorHead.innerHTML='<div><span class="mw-caption">3 · Review & finish</span><h3 id="mw-editor-title">Your email</h3></div><span id="mw-draft-badge" class="mw-channel">Draft</span>';drafts.prepend(editorHead);
  const options=node('div','mw-subject-options');for(const id of ['message-subject-choice-label','message-ai-subject-label'])options.append(q(id));drafts.querySelector('.script-grid').before(options);
  const generateBar=node('div','mw-generate-bar');generateBar.append(q('message-language').closest('label'),q('message-generate'));drafts.querySelector('.script-grid').before(generateBar);
  const notice=node('div','mw-readiness');notice.id='mw-readiness';notice.innerHTML='<p id="mw-readiness-text" role="status"></p><p id="mw-readiness-detail"></p><button id="mw-resolve" class="secondary-btn small" type="button" hidden></button>';generateBar.after(notice);notice.append(q('message-generation-status'));
  const empty=node('div','mw-empty');empty.id='mw-empty';empty.innerHTML='<span aria-hidden="true">✦</span><h4>A good conversation starts here.</h4><p>Choose a style and generate a message tailored to this recipient. Your draft will appear here.</p>';drafts.querySelector('.script-grid').before(empty);
  const valueProof=node('details','mw-value-proof');valueProof.innerHTML='<summary>Business value & proof</summary><p id="mw-business-value"></p><p id="mw-proof-value"></p><small>Assess earning more, saving costs and simplifying work. Include only supported benefits; numbers need approved results and a timeframe.</small>';drafts.querySelector('.script-grid').before(valueProof);
  const toolbar=node('div','mw-draft-toolbar');toolbar.id='mw-draft-toolbar';toolbar.append(q('message-improve'),q('message-save-draft'),q('message-save-as-template'));drafts.querySelector('.outreach-approval').before(toolbar);
  editor.append(q('message-personal-review'));
  const copyEmail=drafts.querySelector('[data-copy-field="email"]');toolbar.prepend(copyEmail);copyEmail.className='secondary-btn';copyEmail.id='mw-copy-email';
  const copyLinkedIn=drafts.querySelector('[data-copy-field="linkedin"]');copyLinkedIn.className='primary-btn';copyLinkedIn.textContent='Copy message';q('linkedin-manual-actions').prepend(copyLinkedIn);

  q('message-evidence').hidden=true;
  const oldBar=q('message-generation-status').parentElement===notice?studio.querySelector(':scope > .draft-controls'):null;if(oldBar)oldBar.remove();
  const evidence=step.querySelector('.message-advanced');evidence.querySelector('summary').textContent='Research & campaign tools';evidence.open=false;rail.append(evidence);
  const linkActions=q('linkedin-manual-actions');const recording=node('details','mw-recording');recording.innerHTML='<summary>Record a message you sent</summary>';recording.append(q('linkedin-sent-confirm').closest('label'),q('linkedin-record-sent'),q('linkedin-manual-status'));linkActions.querySelector('p').textContent='Copy the draft, then paste and send it inside LinkedIn.';linkActions.append(recording);
  q('linkedin-open-profile').textContent='Open LinkedIn profile ↗';
  const manualButtons=node('div','mw-linkedin-actions');manualButtons.append(copyLinkedIn,q('linkedin-open-profile'));linkActions.prepend(manualButtons);linkActions.querySelector(':scope > p').textContent='Paste and send manually inside LinkedIn. Then record the outcome below.';
  for(const id of ['mark-contacted','preview-approved-email'])step.querySelector('.message-advanced').append(q(id));
  q('message-mode').addEventListener('change',()=>paintStyles(document));
  q('mw-style-options').addEventListener('click',event=>{const button=event.target.closest('[data-writing-style]');if(!button)return;const select=q('message-mode');select.value=button.dataset.writingStyle;select.dispatchEvent(new document.defaultView.Event('change',{bubbles:true}));});
  return true;
 }
 function paintStyles(document){const select=document.getElementById('message-mode'),host=document.getElementById('mw-style-options');if(!select||!host)return;host.replaceChildren();for(const option of select.options){const info=styles.find(s=>s[0]===option.value),button=document.createElement('button');button.type='button';button.className='mw-style';button.dataset.writingStyle=option.value;button.setAttribute('aria-pressed',String(select.value===option.value));const title=document.createElement('strong'),description=document.createElement('span');title.textContent=info?.[1]||option.textContent;description.textContent=info?.[2]||'Your saved template';button.append(title,description);host.append(button);}}
 function subjectPreview(pattern,context={}){const values={buyerCompany:context.company,sender:context.sender,company:context.senderCompany,development:context.trigger?.title,value:context.value};const fallback={development:'select a company fact',value:'your business outcome',buyerCompany:'recipient company',sender:'sender name',company:'sender company'};return String(pattern).replace(/\{\{(\w+)\}\}/g,(_,key)=>values[key]||'['+(fallback[key]||key)+']');}
 function render(document,context){if(!document.getElementById('mw-readiness-text'))return;const q=id=>document.getElementById(id),view=state(context),linkedin=context.channel==='linkedin',person=context.person;
  const name=person?.publicName||person?.name||context.contact?.name||'No recipient selected';q('message-recipient').textContent=name;q('mw-recipient-detail').textContent=[context.company,person?.title].filter(Boolean).join(' · ');q('mw-channel').textContent=linkedin?'LinkedIn · manual':'Email';q('mw-editor-title').textContent=linkedin?'Your LinkedIn message':'Your email';q('mw-draft-badge').textContent=context.approved?'Approved':context.hasDraft?'Draft':'Not generated';
  q('mw-readiness-text').textContent=view.text;q('mw-readiness-detail').textContent=view.detail||'';q('mw-readiness').dataset.state=view.kind;
  q('message-generate').disabled=!view.canGenerate||context.factResearchBusy;q('message-generate').textContent=context.busy?'Writing…':context.templateSelected?'Generate from this template ✦':context.hasDraft?'Regenerate AI message ✦':'Generate AI message ✦';
  q('message-update-opening').disabled=!view.canGenerate||!context.hasDraft||context.trigger?.verification!=='user_reviewed'||!root.LeadIntelMessageFacts?.event(context.trigger?.excerpt);
  q('message-find-fact').disabled=!context.authenticated||!context.ready||context.syncConflict||context.busy||context.factResearchBusy;
  q('message-improve').disabled=!view.canGenerate||!context.hasDraft||context.factResearchBusy;
  q('mw-business-value').textContent=context.value?'Reviewed business outcome: '+context.value:'No approved business outcome supplied. Review your Profile answers.';
  q('mw-proof-value').textContent=context.proof?'Approved proof: '+context.proof:'No approved measured results supplied. Use your website for capabilities, not as proof of invented savings.';
  for(const option of q('message-subject-choice').options)if(option.value)option.textContent=subjectPreview(option.textContent,context);
  const resolve=q('mw-resolve');resolve.hidden=!view.action;resolve.textContent=view.action==='sync'?'Review sync choices ↑':view.action==='profile'?'Review Profile answers →':view.action==='settings'?'Complete sender & settings':'Return to Buyers';resolve.onclick=()=>{if(view.action==='settings'){q('mw-settings').open=true;q('mw-settings').scrollIntoView({block:'center',behavior:'smooth'});}else context.onResolve?.(view.action);};
  q('mw-copy-email').hidden=linkedin;q('mw-empty').hidden=context.hasDraft;const grid=q('step-6').querySelector('.outreach-drafts .script-grid');grid.hidden=!context.hasDraft;q('mw-draft-toolbar').hidden=!context.hasDraft;
  const approval=q('step-6').querySelector('.outreach-approval');approval.hidden=linkedin||!context.hasDraft;q('approve-outreach').textContent=context.approved?'Approved ✓':'Approve & continue →';
  q('message-generation-status').hidden=!context.busy&&!context.generationError;
  q('mw-trigger-summary').textContent=context.trigger?'Reviewed: '+(root.LeadIntelMessageFacts?.event(context.trigger.excerpt)||context.trigger.title||context.trigger.url):'No reviewed event selected. Find and check a specific development for a stronger opening.';
  q('mw-style-help').textContent=(linkedin?'An editable AI message or your saved template.':'A protected core template or original AI draft.')+' Generation never changes the saved original.';
  const delivery=q('continue-to-delivery')?.closest('.delivery-entry');if(delivery)delivery.hidden=linkedin||!context.approved;
  paintStyles(document);return view;
 }
 const api=Object.freeze({mount,render,state,paintStyles,subjectPreview});if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelMessageWorkspace=api;
})(typeof window==='object'?window:globalThis);
