(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.LeadIntelPersonalLinkedIn=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function normalize(value){
  const raw=String(value||'').trim();if(!raw||raw.length>2048)return '';
  try{const url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);
   if(url.protocol!=='https:'||url.username||url.password||url.port||! /^(?:(?:[a-z]{2,3}|www)\.)?linkedin\.com$/i.test(url.hostname))return '';
   const match=decodeURIComponent(url.pathname).match(/^\/in\/([a-zA-Z0-9_\-\u00C0-\uFFFF]+)\/?$/);if(!match)return '';
   return 'https://www.linkedin.com/in/'+encodeURIComponent(match[1])+'/';
  }catch{return '';}
 }
 function save(sender,value){
  if(!sender?.get||!sender?.setLinkedIn)throw new Error('Sender profile is still loading. Please retry.');
  const raw=String(value||'').trim(),url=normalize(raw);if(raw&&!url)throw new Error('Enter your personal LinkedIn profile: https://www.linkedin.com/in/your-name/');
  sender.setLinkedIn(url);return {url};
 }
 return {normalize,save};
});
