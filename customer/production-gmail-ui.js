(function(root){
  'use strict';
  const Outreach=root.LeadIntelOutreach||(typeof module!=='undefined'&&module.exports?require('./outreach-engine.js'):null);
  const MAIN='leadintel_customer_v2_state',DISCOVERY='leadintel_customer_v2_discovery',OUTREACH='leadintel_customer_v2_outreach',DELIVERY='leadintel_customer_v2_delivery';
  const q=id=>document.getElementById(id);
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
  function write(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function toast(message){const el=q('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3000);}
  function bridge(){return root.LeadIntelServerBridge;}
  function buildProviderSendRequest(pkg,recipient,idempotencyKey){const message=Outreach?.buildApprovedSendPayload?.(pkg,recipient);if(!message||!Outreach?.approvalCurrent?.(pkg)||!pkg.approvalAuthority?.recipient)return null;return {recipientSnapshot:{...pkg.approvalAuthority.recipient,companyDomain:pkg.domain,company:pkg.company},domain:pkg.domain,recipient:message.recipient,subject:message.subject,body:message.textBody,textBody:message.textBody,htmlBody:message.htmlBody,idempotencyKey};}
  function selectedDomain(){return read(DELIVERY).selectedDomain||q('delivery-company-select')?.value||'';}
  function approvedPackages(){const state=Outreach.normalizeOutreachState(read(OUTREACH));return root.LeadIntelDelivery?.approvedDeliveryPackages?.(state)||state.items.filter(item=>Outreach.approvalCurrent(item));}
  function approvedRecipient(pkg){return Outreach?.approvedRecipient?.(pkg)||'';}
  function approvedPackage(){const key=read(DELIVERY).selectedPackageKey;const rows=approvedPackages();if(key)return rows.find(item=>root.LeadIntelDelivery?.packageKey?.(item)===key)||null;const matches=rows.filter(item=>item.domain===selectedDomain());return matches.length===1?matches[0]:null;}
  async function deterministicKey(pkg,recipient,provider='gmail'){const selected=provider==='microsoft'?'microsoft':'gmail';const raw=`${selected}|${pkg?.domain||''}|${pkg?.approvedAt||''}|${String(recipient||'').trim().toLowerCase()}|${pkg?.approvalAuthority?.contextKey||''}`;const bytes=new TextEncoder().encode(raw);const digest=await crypto.subtle.digest('SHA-256',bytes);return `${selected}-${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;}
  function updatePipeline(domain,target){const state=LeadIntelDiscovery.normalizeDiscoveryState(read(DISCOVERY));const item=state.pipeline.find(row=>row.domain===domain);if(!item)return;const stages=LeadIntelDiscovery.CRM_STAGES;const terminal=new Set(['Won','Lost']);if(!terminal.has(item.stage)&&(terminal.has(target)||stages.indexOf(target)>stages.indexOf(item.stage)))item.stage=target;item.updatedAt=new Date().toISOString();write(DISCOVERY,state);}
  function recordSyncedReplies(replies){let state=LeadIntelDelivery.normalizeDeliveryState(read(DELIVERY));let changed=0;for(const reply of replies||[]){const domain=reply.domain;if(!domain||!reply.bodyText)continue;const result=LeadIntelDelivery.recordReply(state,{domain,recipientEmail:reply.senderEmail,threadId:reply.gmailThreadId},reply.bodyText,reply.receivedAt);if(result.error)continue;state=result.state;updatePipeline(domain,LeadIntelDelivery.recommendedPipelineStage(result.record));changed++;}if(changed)write(DELIVERY,state);return changed;}
  function inject(){const card=document.querySelector('#step-7 .connector-card');if(!card||q('production-gmail-controls'))return;card.insertAdjacentHTML('beforeend','<div class="production-gmail-controls" id="production-gmail-controls"><div class="production-mail-provider"><span class="production-gmail-status" id="production-gmail-status">Gmail not connected</span><button class="secondary-btn small" id="connect-gmail" type="button">Connect Gmail</button><button class="primary-btn small" id="send-with-gmail" type="button" hidden>Send with Gmail</button><button class="secondary-btn small" id="sync-gmail-replies" type="button" hidden>Sync replies</button><button class="text-btn" id="disconnect-gmail" type="button" hidden>Disconnect Gmail</button></div><div class="production-mail-provider"><span class="production-gmail-status" id="production-microsoft-status">Microsoft mail not connected</span><button class="secondary-btn small" id="connect-microsoft-mail" type="button">Connect Microsoft mail</button><button class="primary-btn small" id="send-with-microsoft" type="button" hidden>Send with Microsoft</button><button class="text-btn" id="disconnect-microsoft-mail" type="button" hidden>Disconnect Microsoft</button></div></div>');q('connect-gmail')?.addEventListener('click',()=>bridge()?.connectGmail());q('connect-microsoft-mail')?.addEventListener('click',()=>bridge()?.connectMicrosoftMail());q('disconnect-gmail')?.addEventListener('click',()=>disconnect('gmail'));q('disconnect-microsoft-mail')?.addEventListener('click',()=>disconnect('microsoft'));q('send-with-gmail')?.addEventListener('click',()=>send('gmail'));q('send-with-microsoft')?.addEventListener('click',()=>send('microsoft'));q('sync-gmail-replies')?.addEventListener('click',sync);}
  function render(){inject();const b=bridge();if(!q('production-gmail-controls'))return;const authenticated=Boolean(b?.session?.authenticated),gmail=b?.gmail||{},microsoft=b?.microsoftMail||{};q('connect-gmail').hidden=!authenticated||gmail.connected||!gmail.configured;q('send-with-gmail').hidden=!authenticated||!gmail.connected;q('sync-gmail-replies').hidden=!authenticated||!gmail.connected;q('disconnect-gmail').hidden=!authenticated||!gmail.connected||gmail.role!=='owner';q('connect-microsoft-mail').hidden=!authenticated||microsoft.connected||!microsoft.configured;q('send-with-microsoft').hidden=!authenticated||!microsoft.connected;q('disconnect-microsoft-mail').hidden=!authenticated||!microsoft.connected||microsoft.role!=='owner';q('production-gmail-status').textContent=!authenticated?'Local mode · Gmail Compose fallback available':!gmail.configured?'Gmail is not configured':gmail.connected?`Gmail · ${gmail.email}`:'Gmail not connected';q('production-microsoft-status').textContent=!authenticated?'Sign in to connect Microsoft mail':!microsoft.configured?'Microsoft mail is not configured':microsoft.connected?`Microsoft · ${microsoft.email}`:'Microsoft mail not connected';const badge=document.querySelector('#step-7 .connector-badge');if(badge&&(gmail.connected||microsoft.connected))badge.innerHTML=`<i></i> ${gmail.connected&&microsoft.connected?'Gmail + Microsoft':microsoft.connected?'Microsoft Graph':'Gmail API'} · Human-approved send`;const note=document.querySelector('#step-7 .warning-note');if(note&&(gmail.connected||microsoft.connected))note.innerHTML='<strong>Your connected mailbox is protected.</strong><br>Refresh tokens remain encrypted on the LeadIntel Worker. Manual sends require confirmation. Automatic Gmail delivery requires activation and approved queued messages. Microsoft access is send-only and cannot read your inbox.';const sendBusy=Boolean(activeSend?.current());for(const [id,label] of [['send-with-gmail','Send with Gmail'],['send-with-microsoft','Send with Microsoft']]){const button=q(id);if(button){button.disabled=sendBusy;button.textContent=sendBusy?'Sending…':label;}}const syncButton=q('sync-gmail-replies');if(syncButton){const syncing=Boolean(mailboxOperations.get('sync')?.current());syncButton.disabled=syncing;syncButton.textContent=syncing?'Syncing…':'Sync replies';}}
  let activeSend=null;
  function captureMailboxAuthority(provider){
    const b=bridge(),workspace=b?.workspace?.id,user=b?.session?.user?.id,role=b?.workspace?.role,account=localStorage.getItem('leadintel_account_context_v1'),cache=root.LeadIntelAccountCache,connection=provider==='microsoft'?b?.microsoftMail:b?.gmail,mailbox=JSON.stringify(connection);
    const accountCurrent=()=>Boolean(workspace&&user&&b&&bridge()===b&&b.ready!==false&&b.session?.authenticated&&b.workspace?.id===workspace&&b.session?.user?.id===user&&b.workspace?.role===role&&!b.conflict&&!b.resolvingSync&&cache===root.LeadIntelAccountCache&&(!cache?.current||cache.current())&&localStorage.getItem('leadintel_account_context_v1')===account);
    const current=()=>accountCurrent()&&connection===(provider==='microsoft'?b.microsoftMail:b.gmail)&&connection?.connected&&JSON.stringify(connection)===mailbox;
    return {bridge:b,workspace,user,connection,current,accountCurrent};
  }
  function captureSendAuthority(pkg,recipient,provider,{delivery=false,quality=null,ticket=null}={}){
    const mailboxAuthority=captureMailboxAuthority(provider),{bridge:b,workspace,user,connection}=mailboxAuthority,selection=delivery?JSON.stringify([selectedDomain(),read(DELIVERY).selectedPackageKey,q('delivery-recipient')?.value]):null;
    const original=JSON.stringify([pkg.domain,pkg.selectedPersonId,pkg.approvedAt,pkg.approvalAuthority,buildProviderSendRequest(pkg,recipient,'')]);
    const source=()=>{const main=read(MAIN);return JSON.stringify([main.profile,main.brandIdentity,main.answers,main.answerStatus,main.eventCampaigns,read(OUTREACH).messageStudio,read('leadintel_customer_v2_discovery_meta').scriptBuyer]);},sourceKey=source();
    const accountCurrent=mailboxAuthority.current;
    const current=({afterRecord=false}={})=>{if(!accountCurrent()||source()!==sourceKey||!afterRecord&&quality&&!quality.current(ticket)||delivery&&selection!==JSON.stringify([selectedDomain(),read(DELIVERY).selectedPackageKey,q('delivery-recipient')?.value]))return false;const latest=approvedPackages().find(row=>row.domain===pkg.domain&&row.selectedPersonId===pkg.selectedPersonId&&row.approvedAt===pkg.approvedAt);return Boolean(latest&&Outreach.approvalCurrent(latest)&&original===JSON.stringify([latest.domain,latest.selectedPersonId,latest.approvedAt,latest.approvalAuthority,buildProviderSendRequest(latest,recipient,'')]));};
    return {bridge:b,workspace,user,connection,provider,accountCurrent,current};
  }
  function matchingSentReceipt(result,payload,provider){
    const message=result?.message;if(!message||typeof message!=='object'||Array.isArray(message)||message.status!=='sent'||typeof message.id!=='string'||!message.id.trim()||typeof message.sent_at!=='string'||!Number.isFinite(Date.parse(message.sent_at))||root.LeadIntelDelivery?.normalizeEmail(message.recipient)!==payload.recipient||String(message.domain||'').toLowerCase().replace(/^www\./,'')!==String(payload.domain||'').toLowerCase().replace(/^www\./,'')||message.subject!==payload.subject)return false;
    return provider==='microsoft'?message.provider==='microsoft'&&message.provider_status==='accepted':(!message.provider||message.provider==='gmail')&&typeof message.gmail_message_id==='string'&&Boolean(message.gmail_message_id.trim());
  }
  function confirmedWarning(provider,recipient,extra=''){return {ok:true,providerConfirmed:true,crmSynced:false,syncWarning:true,provider,recipient,warning:'Provider confirmed the send. Review Delivery in the original workspace before recording it. Do not resend.'+(extra?' '+extra:'')};}
  async function submitApproved(pkg,email,provider,{delivery=false,quality=null,ticket=null}={}){
    const authority=captureSendAuthority(pkg,email,provider,{delivery,quality,ticket});
    if(!authority.current())return {ok:false,error:'Delivery context changed. Review the approved recipient and message before retrying.'};
    if(activeSend?.current())return {ok:false,error:'An email send is already in progress.'};
    const operation={...authority};activeSend=operation;
    const b=authority.bridge,label=provider==='microsoft'?'Microsoft':'Gmail',button=delivery?q(provider==='microsoft'?'send-with-microsoft':'send-with-gmail'):null;
    let dispatched=false,confirmedResult=null,requestTimer=null;
    if(button){button.disabled=true;button.textContent='Sending…';}
    try{
      const preview=buildProviderSendRequest(pkg,email,'');if(!preview?.textBody?.trim()||!preview.subject?.trim())return {ok:false,error:'An unchanged approved email for this exact recipient is required.'};
      const question=delivery?`Send this approved email to ${email} with ${label}?`:'Send now from '+(authority.connection.email||provider)+' to '+email+'?\nSubject: '+preview.subject;
      if(!(await (root.LeadIntelDialogs?.confirm(question)??false)))return {ok:false,cancelled:true};
      if(activeSend!==operation||!authority.current())return {ok:false,error:'Delivery context changed during confirmation. Review the saved recipient and approved message before retrying.'};
      const key=await deterministicKey(pkg,email,provider);if(activeSend!==operation||!authority.current())return {ok:false,error:'Delivery context changed before submission. Review and retry.'};
      const payload=buildProviderSendRequest(pkg,email,key),action=provider==='microsoft'?b.sendMicrosoftMail:b.sendGmail;if(!payload||typeof action!=='function')return {ok:false,error:'Connected mail delivery is unavailable.'};
      const receiptKey='leadintel_mail_submission_v1:'+authority.workspace+':'+authority.user;
      sessionStorage.setItem(receiptKey,JSON.stringify({key,workspaceId:authority.workspace,provider,status:'unconfirmed',at:new Date().toISOString()}));
      dispatched=true;
      const deadline=new Promise((_,reject)=>{requestTimer=setTimeout(()=>reject(Error('Delivery is unconfirmed. Check your mailbox Sent folder before another send; this request will not be submitted again.')),60000);});
      const result=await Promise.race([action.call(b,payload),deadline]);clearTimeout(requestTimer);requestTimer=null;
      if(!result?.ok)return {ok:false,submissionUncertain:Boolean(result?.code==='DELIVERY_UNCONFIRMED'||result?.reconciliation_required||result?.message?.status==='sending'),error:result?.code==='CRM_COMPANY_SUPPRESSED'?'Suppressed companies cannot receive normal outreach':result?.error||'The sending provider rejected the request.'};
      if(!matchingSentReceipt(result,payload,provider))return {ok:false,submissionUncertain:true,error:'Delivery is unconfirmed. Check your mailbox Sent folder before another send; this request will not be submitted again.'};
      confirmedResult=result;
      if(activeSend!==operation||!authority.current())return confirmedWarning(provider,email);
      sessionStorage.setItem(receiptKey,JSON.stringify({key,workspaceId:authority.workspace,provider,status:'sent',at:new Date().toISOString()}));
      let recorded=null,syncResult=null;
      if(delivery){
        const activityId=`${provider}-send-${key}`.replace(/[^A-Za-z0-9._:-]/g,'-').slice(0,128);sessionStorage.setItem('leadintel_email_crm_activity_key',activityId);sessionStorage.setItem('leadintel_email_crm_channel',provider);if(provider==='gmail')sessionStorage.setItem('leadintel_gmail_crm_activity_key',activityId);
        if(root.LeadIntelDeliveryUI?.confirmSent)recorded=await root.LeadIntelDeliveryUI.confirmSent({deliveryChannel:provider,threadId:result.message.gmail_thread_id,providerMessageId:result.message.gmail_message_id||result.message.id});else {q('confirm-delivery-sent')?.click();recorded={ok:false};}
      }else{
        const d=root.LeadIntelDelivery,record=d.confirmSend(d.normalizeDeliveryState(read(DELIVERY)),pkg,email,result.message.sent_at||new Date().toISOString(),{deliveryChannel:provider,threadId:result.message.gmail_thread_id,providerMessageId:result.message.gmail_message_id||result.message.id});
        if(record.error)return confirmedWarning(provider,email,record.error);
        write(DELIVERY,record.state);updatePipeline(pkg.domain,'Contacted');
        const state=Outreach.normalizeOutreachState(read(OUTREACH)),contacted=[...state.items,...Object.values(state.buyerDrafts||{})].find(row=>row.domain===pkg.domain&&row.selectedPersonId===pkg.selectedPersonId&&row.approvedAt===pkg.approvedAt);if(contacted){contacted.contactedAt=contacted.contactedAt||record.record.sentAt;write(OUTREACH,state);}
      }
      if(activeSend!==operation||!authority.current({afterRecord:true}))return confirmedWarning(provider,email);
      syncResult=await b.saveNow?.();
      if(activeSend!==operation||!authority.current({afterRecord:true}))return confirmedWarning(provider,email);
      if(!delivery)root.dispatchEvent(new root.CustomEvent('leadintel:outreach-sent',{detail:{domain:pkg.domain,recipient:email,provider}}));
      return {ok:true,providerConfirmed:true,duplicate:Boolean(result.duplicate),provider,recipient:email,crmSynced:!result.sync_warning&&recorded?.ok!==false&&Boolean(syncResult?.saved),syncWarning:Boolean(result.sync_warning||recorded?.ok===false||!syncResult?.saved)};
    }catch(error){if(confirmedResult)return confirmedWarning(provider,email,String(error?.message||error));return {ok:false,submissionUncertain:dispatched,error:dispatched?'Delivery is unconfirmed. Check your mailbox Sent folder before another send; this request will not be submitted again. '+String(error?.message||error):String(error?.message||error)};}
    finally{clearTimeout(requestTimer);if(activeSend===operation){activeSend=null;if(button&&authority.accountCurrent()){button.disabled=false;button.textContent=`Send with ${label}`;}}}
  }
  async function send(provider='gmail'){
    const quality=root.LeadIntelPageQuality,ticket=quality?.capture('delivery','send');if(quality&&!ticket){toast(quality.getReport('delivery').message);return {ok:false,error:'Review Delivery first.'};}
    const selected=provider==='microsoft'?'microsoft':'gmail',b=bridge(),connection=selected==='microsoft'?b?.microsoftMail:b?.gmail,pkg=approvedPackage(),recipient=root.LeadIntelDelivery?.normalizeEmail(q('delivery-recipient')?.value||'');
    if(!connection?.connected){toast(`Connect ${selected==='microsoft'?'Microsoft mail':'Gmail'} first`);return {ok:false};}if(!pkg||!recipient){toast('Choose an approved outreach package and its exact recipient');return {ok:false};}
    const outcome=await submitApproved(pkg,recipient,selected,{delivery:true,quality,ticket});
    if(outcome.cancelled)return outcome;
    toast(outcome.warning||outcome.error||(outcome.syncWarning?`Email ${selected==='microsoft'?'accepted by Microsoft':'sent with Gmail'} · CRM or activity sync needs attention`:outcome.duplicate?'This approved send was already recorded · no duplicate email sent':selected==='microsoft'?'Email accepted by Microsoft · Pipeline Contacted':'Email sent with Gmail · Pipeline Contacted'));return outcome;
  }
  async function sendApprovedFromMessages({domain,recipient,approvedAt,personId}={}){
    const quality=root.LeadIntelPageQuality,ticket=quality?.capture('messages','send');if(quality&&!ticket)return {ok:false,error:quality.getReport('messages').message};
    const b=bridge(),d=root.LeadIntelDelivery;if(!b?.session?.authenticated||!d)return {ok:false,error:'Sign in to the workspace and open Delivery setup first.'};
    const email=d.normalizeEmail(recipient),pkg=approvedPackages().find(row=>row.domain===domain&&row.approvedAt===approvedAt&&(!personId||row.selectedPersonId===personId)&&approvedRecipient(row)===String(email||'').toLowerCase());if(!pkg||pkg.channel==='linkedin'||!email)return {ok:false,error:'An approved email for this exact recipient is required.'};
    const previous=d.findDeliveryRecord?.(read(DELIVERY),pkg,email)||(!d.findDeliveryRecord?d.normalizeDeliveryState(read(DELIVERY)).opportunities.find(row=>row.domain===domain):null);if(previous?.sentAt)return {ok:false,error:'This approved email already has a recorded send for this recipient. Review Delivery before another direct email.'};
    const provider=b.gmail?.connected?'gmail':b.microsoftMail?.connected?'microsoft':null;if(!provider)return {ok:false,error:'Connect Gmail or Microsoft in Delivery settings first.'};
    return submitApproved(pkg,email,provider,{quality,ticket});
  }
  const mailboxOperations=new Map();let mailboxReloadOwner=null;
  async function sync(){
    const authority=captureMailboxAuthority('gmail');if(!authority.current()){toast('Connect Gmail first');return;}
    if(mailboxOperations.get('sync')?.current())return;
    const operation={current:authority.current};mailboxOperations.set('sync',operation);mailboxReloadOwner=operation;const current=()=>mailboxOperations.get('sync')===operation&&authority.current(),button=q('sync-gmail-replies');button.disabled=true;button.textContent='Syncing…';
    try{const result=await authority.bridge.syncReplies();if(!current())return;if(!result.ok){toast(result.error||'Gmail reply sync failed');return;}const count=recordSyncedReplies(result.replies);if(!current())return;if(count){await authority.bridge.saveNow?.();if(!current())return;sessionStorage.setItem('leadintel_reopen_delivery','1');toast(`${count} new repl${count===1?'y':'ies'} synced`);setTimeout(()=>{if(mailboxReloadOwner===operation&&authority.current())location.reload();},350);}else toast('No new replies found');}
    catch(error){if(current())toast(error.message||'Gmail reply sync failed');}
    finally{if(mailboxOperations.get('sync')===operation){if(authority.current()){button.disabled=false;button.textContent='Sync replies';}mailboxOperations.delete('sync');}}
  }
  async function disconnect(provider='gmail'){
    const selected=provider==='microsoft'?'microsoft':'gmail',label=selected==='microsoft'?'Microsoft mail':'Gmail',authority=captureMailboxAuthority(selected),key='disconnect:'+selected;
    if(!authority.current()||mailboxOperations.get(key)?.current())return;
    const operation={current:authority.current};mailboxOperations.set(key,operation);const current=()=>mailboxOperations.get(key)===operation&&authority.current();
    try{if(!(await (root.LeadIntelDialogs?.confirm(`Disconnect ${label} from this LeadIntel workspace?`)??false)))return;if(!current())return;const result=selected==='microsoft'?await authority.bridge.disconnectMicrosoftMail():await authority.bridge.disconnectGmail();if(mailboxOperations.get(key)!==operation||!authority.accountCurrent())return;if(result?.ok){render();toast(`${label} disconnected`);}else toast(result?.error||`Unable to disconnect ${label}`);}
    catch(error){if(current())toast(error.message||`Unable to disconnect ${label}`);}
    finally{if(mailboxOperations.get(key)===operation)mailboxOperations.delete(key);}
  }
  function maybeReopen(){if(sessionStorage.getItem('leadintel_reopen_delivery')==='1'&&q('continue-to-delivery')){sessionStorage.removeItem('leadintel_reopen_delivery');q('continue-to-delivery').click();}}
  function init(){inject();render();maybeReopen();root.addEventListener('leadintel:server-ready',()=>{render();maybeReopen();});root.addEventListener('leadintel:gmail-status',render);root.addEventListener('leadintel:microsoft-mail-status',render);}
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
  root.LeadIntelProductionMail={buildProviderSendRequest,sendApprovedFromMessages,render};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.LeadIntelProductionMail;
})(typeof window!=='undefined'?window:globalThis);
