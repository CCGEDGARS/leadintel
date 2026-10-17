(function(root){
'use strict';
let pending=false;
function labels(message){
 if(/\b(?:delete|remove)\b/i.test(message))return {title:'Remove this item?',action:'Delete',danger:true};
 if(/\bdisconnect\b/i.test(message))return {title:'Disconnect service?',action:'Disconnect',danger:true};
 if(/\bsuppress\b/i.test(message))return {title:'Suppress company?',action:'Suppress',danger:true};
 if(/\bsend\b/i.test(message))return {title:'Confirm sending',action:'Send email'};
 if(/\b(?:activate|enable)\b/i.test(message))return {title:'Confirm activation',action:'Activate'};
 if(/\b(?:replace|rebuild|regenerate|discard|switch)\b/i.test(message))return {title:'Replace the working copy?',action:'Continue'};
 return {title:'Confirm action',action:'Continue'};
}
function confirm(message,options={}){
 const d=root.document;if(!d?.body||pending)return Promise.resolve(false);pending=true;
 const originalFocus=d.activeElement,parent=originalFocus?.closest('dialog');
 const account=()=>JSON.stringify([root.LeadIntelServerBridge?.workspace?.id||'',root.LeadIntelServerBridge?.session?.user?.id||'']);const captured=account();
 const dialog=d.createElement('dialog');dialog.className='li-confirm';dialog.dataset.liConfirm='';dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','li-confirm-title');dialog.setAttribute('aria-describedby','li-confirm-message');
 const copy={...labels(String(message)),...options},card=d.createElement('section');card.className='li-confirm-card';
 const brand=d.createElement('span');brand.className='li-confirm-brand';brand.textContent='LeadIntel';
 const title=d.createElement('h2');title.id='li-confirm-title';title.textContent=copy.title;
 const text=d.createElement('p');text.id='li-confirm-message';text.textContent=String(message);
 const actions=d.createElement('div');actions.className='li-confirm-actions';
 const cancel=d.createElement('button');cancel.type='button';cancel.dataset.liCancel='';cancel.textContent='Cancel';cancel.className='li-confirm-cancel';
 const accept=d.createElement('button');accept.type='button';accept.dataset.liAccept='';accept.textContent=copy.action;accept.className=copy.danger?'li-confirm-danger':'li-confirm-accept';
 actions.append(cancel,accept);card.append(brand,title,text,actions);dialog.append(card);d.body.append(dialog);
 return new Promise(resolve=>{
  let finished=false;
  function finish(value){if(finished)return;finished=true;pending=false;const valid=account()===captured&&(!parent||parent.open)&&originalFocus?.isConnected!==false;root.removeEventListener('leadintel:workspace-changed',cancelAction);root.removeEventListener('leadintel:server-conflict',cancelAction);if(dialog.open&&typeof dialog.close==='function')dialog.close();dialog.remove();if(originalFocus?.isConnected)originalFocus.focus();resolve(Boolean(value&&valid));}
  const cancelAction=()=>finish(false);cancel.onclick=cancelAction;accept.onclick=()=>finish(true);
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});dialog.addEventListener('close',()=>finish(false));
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish(false);}if(e.key==='Tab'){if(e.shiftKey&&d.activeElement===cancel){e.preventDefault();accept.focus();}else if(!e.shiftKey&&d.activeElement===accept){e.preventDefault();cancel.focus();}}});
  root.addEventListener('leadintel:workspace-changed',cancelAction);root.addEventListener('leadintel:server-conflict',cancelAction);
  try{if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');cancel.focus();}catch{finish(false);}
 });
}
root.LeadIntelDialogs=Object.freeze({confirm});
})(typeof window==='object'?window:globalThis);
