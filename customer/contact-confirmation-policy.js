(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.LeadIntelContactPolicy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const domain=value=>{try{return new URL(/^https?:\/\//i.test(value)?value:'https://'+value).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}};
  function level(value='public_confirmed'){return value==='public_confirmed'?'public_confirmed':'provider_verified';}
  function publicSource(email,name,url,companyDomain){
    try{const source=new URL(url);return source.protocol==='https:'&&!source.username&&!source.password&&domain(source.href)===domain(companyDomain)&&String(name||'').trim().split(/\s+/).length>=2&&/^[a-z0-9]+(?:[._+-][a-z0-9]+)*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)&&String(email).toLowerCase().endsWith('@'+domain(companyDomain))&&!/^(info|sales|contact|support|office|admin|team|noreply|hr|press)@/i.test(email);}catch{return false;}
  }
  function accepted(contact={},companyDomain='',confirmationLevel='public_confirmed',now=Date.now()){
    const addresses=[contact.normalized_email,contact.work_email,contact.email].filter(value=>value!==undefined&&value!==null&&String(value).trim()!=='').map(value=>String(value).trim().toLowerCase());
    if(new Set(addresses).size!==1)return false;
    const email=addresses[0]||'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||String(contact.name||'').trim().split(/\s+/).length<2||/^(info|sales|contact|support|office|admin|team|noreply|hr|press)@/i.test(email)||contact.archived_at)return false;
    const personal=contact.email_type==='personal'&&Boolean(contact.external_person_id);
    if(!email.endsWith('@'+domain(companyDomain))&&!personal)return false;
    if(String(contact.email_status).toLowerCase()==='verified')return [contact.verification_provider,contact.source].some(value=>['apollo','hunter','treg'].includes(String(value||'').toLowerCase()));
    const stamp=String(contact.verified_at||''),age=now-Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(stamp)?stamp.replace(' ','T')+'Z':stamp);
    return level(confirmationLevel)==='public_confirmed'&&contact.email_status==='public_confirmed'&&contact.verification_provider==='Public source'&&publicSource(email,contact.name,contact.public_email_url,companyDomain)&&age>=0&&age<30*86400000;
  }
  return {level,publicSource,accepted};
});
