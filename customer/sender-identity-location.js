(function(root){
 'use strict';
 const fields={sender:'senderName',senderRole:'senderTitle',company:'companyDisplayName'};
 function migrate(main,essentials={}){
  if(main.senderIdentityVersion===1)return false;
  const identity={...(main.brandIdentity||{})};
  for(const [key,field] of Object.entries(fields))if(!identity[field])identity[field]=essentials[key]||'';
  main.brandIdentity=identity;main.senderIdentityVersion=1;return true;
 }
 function mount(document){
  const host=document.getElementById('brand-identity'),destination=document.getElementById('message-sender-identity');
  if(!host||!destination)return false;
  if(host.parentElement!==destination)destination.append(host);
  return true;
 }
 const api=Object.freeze({mount,migrate,fields});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.LeadIntelSenderIdentityLocation=api;
})(typeof globalThis!=='undefined'?globalThis:this);
