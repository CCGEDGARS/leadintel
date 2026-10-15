(function(root){
'use strict';
const q=id=>document.getElementById(id);
const bridge=()=>root.LeadIntelServerBridge;
const identity=()=>JSON.stringify([bridge()?.session?.user?.id,bridge()?.workspace?.id,bridge()?.gmail?.email]);
let active=null,busy=false;
function snapshot(context){
 if(!context?.item||context.channel!=='email')throw Error('Choose an email message first.');
 const {item,draft,brand}=context;
 const subject=String(draft?.subject??item.drafts?.emailSubject??'').trim();
 const message=String(draft?.message??item.drafts?.emailBody??'').trim();
 if(!subject||!message)throw Error('Prepare an email subject and message first.');
 if(/\{\{|\}\}/.test(subject+message))throw Error('Complete the missing message fields before sending a test.');
 let rendered;
 if(item.approved&&item.approvedSource?.emailSubject===subject&&item.approvedSource?.emailBody===message){rendered=root.LeadIntelOutreach?.renderApprovedEmail(item);if(!rendered)throw Error('The approved email could not be rendered. Review its branding.');}
 else if(brand?.status==='ready'){
  const api=root.LeadIntelBrandIdentity;if(!api)throw Error('Email branding is still loading.');
  rendered=api.renderEmail({subject,bodyText:message,brandSnapshot:api.snapshot(brand)});
 }else rendered={subject,textBody:message,htmlBody:''};
 return {subject:rendered.subject,body:rendered.textBody,text_body:rendered.textBody,html_body:rendered.htmlBody||'',source:JSON.stringify([item.domain,item.selectedPersonId,context.channel,subject,message,brand||null])};
}
function ensureDialog(){
 if(q('test-email-dialog'))return q('test-email-dialog');
 if(!q('test-email-css')){const link=document.createElement('link');link.id='test-email-css';link.rel='stylesheet';link.href='test-email.css?v=20261015-v1';document.head.appendChild(link);}
 const dialog=document.createElement('dialog');dialog.id='test-email-dialog';dialog.setAttribute('aria-labelledby','test-email-title');
 dialog.innerHTML='<form id="test-email-form"><header><h2 id="test-email-title">Send test email</h2><button type="button" id="test-email-close" aria-label="Close test email">×</button></header><p>Send a real copy through your connected Gmail to an address you control. Customer status and automation stay unchanged.</p><p><strong>From:</strong> <span id="test-email-from"></span></p><label for="test-email-recipient">Test recipient email</label><input id="test-email-recipient" type="email" required autocomplete="email" placeholder="your.other@gmail.com"><label for="test-email-subject">Test subject</label><input id="test-email-subject" readonly><details open><summary>Message preview</summary><pre id="test-email-preview"></pre></details><p id="test-email-status" role="status" aria-live="polite"></p><footer><button type="button" class="secondary-btn" id="test-email-cancel">Cancel</button><button type="submit" class="primary-btn" id="test-email-submit">Send test email</button><button type="button" class="secondary-btn" id="test-email-another" hidden>Prepare another test</button></footer></form>';
 document.body.appendChild(dialog);
 const close=()=>{if(!busy)dialog.close();};q('test-email-close').onclick=close;q('test-email-cancel').onclick=close;
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 dialog.addEventListener('close',()=>{active=null;});
 q('test-email-form').addEventListener('submit',e=>{e.preventDefault();void send();});
 q('test-email-another').onclick=()=>{if(!active||busy)return;active.fresh=true;active.completed=false;q('test-email-submit').disabled=false;q('test-email-another').hidden=true;q('test-email-recipient').disabled=false;q('test-email-status').textContent='Ready for a new test. Confirm the address before sending.';};
 return dialog;
}
function open(getContext){
 const dialog=ensureDialog();if(busy)return;
 try{
  if(!bridge()?.session?.authenticated||!bridge()?.workspace)throw Error('Sign in to your workspace first.');
  if(!bridge()?.gmail?.connected)throw Error('Connect Gmail in Settings before sending a test.');
  const email=snapshot(getContext());active={getContext,email,identity:identity(),workspace:bridge().workspace.id,fresh:false};
  q('test-email-from').textContent=bridge().gmail.email;q('test-email-subject').value='[TEST] '+email.subject.replace(/^\[TEST\]\s*/i,'');q('test-email-preview').textContent=email.body;
  q('test-email-recipient').value='';q('test-email-recipient').disabled=false;q('test-email-submit').disabled=false;q('test-email-another').hidden=true;q('test-email-status').textContent='Review the preview, then enter your test address.';
 }catch(e){active=null;q('test-email-from').textContent=bridge()?.gmail?.email||'Gmail not connected';q('test-email-subject').value='';q('test-email-preview').textContent='';q('test-email-recipient').value='';q('test-email-submit').disabled=true;q('test-email-another').hidden=true;q('test-email-status').textContent=e.message;}
 if(!dialog.open)dialog.showModal();q('test-email-recipient').focus();
}
async function digest(value){const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
async function send(){
 if(busy||!active)return;
 const a=active,recipient=q('test-email-recipient').value.trim().toLowerCase();
 if(!/^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/.test(recipient)){q('test-email-status').textContent='Enter one valid test email address.';return;}
 const current=()=>a===active&&a.identity===identity()&&bridge()?.gmail?.connected&&JSON.stringify(snapshot(a.getContext()))===JSON.stringify(a.email);
 busy=true;q('test-email-submit').disabled=true;q('test-email-recipient').disabled=true;q('test-email-close').disabled=true;q('test-email-cancel').disabled=true;
 try{
  if(!current())throw Error('The workspace or message changed. Close and reopen the test preview.');
  const {source,...content}=a.email;
  const fingerprint=await digest(JSON.stringify([a.identity,recipient,content]));const storageKey='leadintel:test-email:'+fingerprint;
  let attempt;try{attempt=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}
  if(!attempt||a.fresh)attempt={key:'test-'+root.crypto.randomUUID()};
  if(!root.confirm('Send a real test email from '+bridge().gmail.email+' to '+recipient+'?\nSubject: '+q('test-email-subject').value)){q('test-email-status').textContent='Test cancelled. Nothing was sent.';return;}
  if(!current())throw Error('The workspace or message changed. Close and reopen the test preview.');
  sessionStorage.setItem(storageKey,JSON.stringify(attempt));a.fresh=false;
  q('test-email-status').textContent='Sending test email…';
  const response=await root.fetch('/api/integrations/gmail/test-send?workspace_id='+encodeURIComponent(a.workspace),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':attempt.key},body:JSON.stringify({...content,recipient,confirmed:true})});
  const result=await response.json();
  if(a!==active||a.identity!==identity())return;
  if(response.ok&&result.message?.status==='sent'){
   a.completed=true;q('test-email-status').textContent=(result.duplicate?'This test was already sent to ':'Test email sent to ')+recipient+'. Check its inbox or spam folder. Customer status is unchanged.';q('test-email-another').hidden=false;
  }else if(result.message?.status==='failed'){
   a.completed=true;q('test-email-status').textContent=result.error||'This test attempt failed. Prepare another test to retry.';q('test-email-another').hidden=false;
  }else if(result.message?.status==='sending'||result.code==='DELIVERY_UNCONFIRMED'){
   q('test-email-status').textContent='Delivery is unconfirmed. Check Gmail Sent. Retry checks the same request and will not send another copy.';
  }else throw Error(result.error||'Test email could not be sent.');
 }catch(e){if(a===active)q('test-email-status').textContent=e.message+' If delivery is uncertain, check Gmail Sent before retrying.';}
 finally{busy=false;if(a===active){q('test-email-submit').disabled=Boolean(a.completed);q('test-email-recipient').disabled=Boolean(a.completed);q('test-email-close').disabled=false;q('test-email-cancel').disabled=false;}}
}
function mount(container,id,getContext){
 if(!container)return;let button=q(id);
 if(!button){button=document.createElement('button');button.id=id;button.type='button';button.className='secondary-btn small';button.textContent='Send test email';container.appendChild(button);}
 button.onclick=()=>open(getContext);const context=getContext();button.hidden=context?.channel!=='email';
}
root.LeadIntelTestEmail={mount,open,snapshot};
if(typeof module!=='undefined'&&module.exports)module.exports=root.LeadIntelTestEmail;
})(typeof window!=='undefined'?window:globalThis);
