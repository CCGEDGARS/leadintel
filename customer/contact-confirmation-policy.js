(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.LeadIntelContactPolicy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const domain=value=>{try{return new URL(/^https?:\/\//i.test(value)?value:'https://'+value).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}};
  function level(value){return value==='public_confirmed'?'public_confirmed':'provider_verified';}
  function publicSource(email,name,url,companyDomain){
    try{const source=new URL(url);return source.protocol==='https:'&&!source.username&&!source.password&&domain(source.href)===domain(companyDomain)&&String(name||'').trim().split(/\s+/).length>=2&&/^[a-z0-9]+(?:[._+-][a-z0-9]+)*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)&&String(email).toLowerCase().endsWith('@'+domain(companyDomain))&&!/^(info|sales|contact|support|office|admin|team|noreply|hr|press)@/i.test(email);}catch{return false;}
  }
  function accepted(contact={},companyDomain='',confirmationLevel='provider_verified',now=Date.now()){
    const email=String(contact.normalized_email||contact.work_email||contact.email||'').toLowerCase();
    if(!publicSource(email,contact.name,'https://'+domain(companyDomain),companyDomain)||contact.archived_at)return false;
    if(String(contact.email_status).toLowerCase()==='verified')return [contact.verification_provider,contact.source].some(value=>['apollo','hunter'].includes(String(value||'').toLowerCase()));
    const age=now-Date.parse(contact.verified_at||'');
    return level(confirmationLevel)==='public_confirmed'&&contact.email_status==='public_confirmed'&&contact.verification_provider==='Public source'&&publicSource(email,contact.name,contact.public_email_url,companyDomain)&&age>=0&&age<30*86400000;
  }
  return {level,publicSource,accepted};
});
