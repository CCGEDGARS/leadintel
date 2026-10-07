(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelWorkspaceSync=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const object=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
  function equal(a,b){
    if(a===b)return true;
    if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
    if(!object(a)||!object(b))return false;
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&equal(a[k],b[k]));
  }
  function project(payload={}){return {main:payload.main||{},discovery:payload.discovery||{},outreach:payload.outreach||{},delivery:payload.delivery||{},meta:{discovery:payload.meta?.discovery||{}}};}
  const RECORD_LISTS=new Set(['people','pool','buyers','selectedProspects','candidates','pipeline','items','companies','reports','documents','signals','icps']);
  const BUYER_GROUPS=[
    ['name','firstName','organization','title','publicName','publicNameUrl','publicLinkedinUrl','linkedin_url','identityEvidenceDate','identitySource','identityStatus','nameVerification','linkedinConfirmedUrl','linkedinConfirmedAt','linkedinConfirmationMethod','linkedinIdentityEvidence','opportunityScope'],
    ['publicEmail','publicEmailUrl','publicEmailSourceCheck','patternFindings','hunterChecks','hunterFound','flowEmailCompletedFor'],
    ['publicPhone','publicPhoneUrl','flowPhoneCompletedFor']
  ];
  const ATOMIC_FIELDS=new Set(['selectedEmailBuyer','scriptBuyer','contactVerification','publicEmailSourceCheck','messageStudioDraft']);
  // These fields remember the page a tab is viewing, not commercial progress.
  // Concurrent navigation should keep this tab's view and merge business data.
  const NAVIGATION_PATHS=new Set(['main.step','meta.discovery.visibleStep','meta.discovery.activeJourneyStage']);
  function subset(value,keys){return Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(value||{},key)).map(key=>[key,value[key]]));}
  function recordMaps(arrays,path){
    if(!RECORD_LISTS.has(path.split('.').at(-1))||!arrays.every(Array.isArray))return null;
    const rows=arrays.flat();if(!rows.length||!rows.every(object))return null;
    const field=rows.every(row=>typeof row.id==='string'&&row.id.trim())?'id':rows.every(row=>typeof row.domain==='string'&&row.domain.trim())?'domain':null;
    if(!field)return null;
    const maps=arrays.map(rows=>new Map(rows.map(row=>[field==='domain'?row.domain.trim().toLowerCase().replace(/^www\./,''):row.id,row])));
    return maps.every((map,i)=>map.size===arrays[i].length)?maps:null;
  }
  function merge(base,local,server,options={}){
    const conflicts=[];
    const preference=['local','server'].includes(options.conflictPreference)?options.conflictPreference:null;
    function choose(path,l,r){conflicts.push(path);return preference==='server'?r:l;}
    function visit(bl,l,br,r,path){
      if(equal(l,r))return l;
      // Compare each representation to its own acknowledged baseline. A full
      // browser research body and a cloud excerpt are not competing user edits.
      if(equal(r,br))return l;
      if(equal(l,bl))return r;
      if(NAVIGATION_PATHS.has(path))return l;
      const field=path.split('.').at(-1);
      if(field==='buyerQualification')return undefined; // Recomputed from preserved buyer evidence.
      if(ATOMIC_FIELDS.has(field)||/^(?:template-[1-5]|linkedin-template-[1-3]|buyer-draft:.*)$/.test(field))return choose(path,l,r);
      const maps=recordMaps([bl,l,br,r],path);
      if(maps){
        const [bm,lm,sm,rm]=maps,output=[];
        for(const key of new Set([...lm.keys(),...rm.keys(),...bm.keys(),...sm.keys()])){
          const value=visit(bm.get(key),lm.get(key),sm.get(key),rm.get(key),path+'['+key+']');
          if(value!==undefined)output.push(value);
        }
        return output;
      }
      // Unknown or duplicate identities and unkeyed evidence stay indivisible.
      // A deletion versus an edit to the same record must still require review.
      if((object(bl)||bl===undefined)&&(object(br)||br===undefined)&&object(l)&&object(r)){
        const output={},grouped=new Set();
        if(/(?:people|pool|buyers)\[[^\]]+\]$/.test(path))for(const keys of BUYER_GROUPS){
          keys.forEach(key=>grouped.add(key));
          const bv=subset(bl,keys),lv=subset(l,keys),sv=subset(br,keys),rv=subset(r,keys);
          const chosen=equal(lv,rv)||equal(rv,sv)?lv:equal(lv,bv)?rv:null;
          if(chosen)Object.assign(output,chosen);else Object.assign(output,choose(path+'.'+(keys.includes('publicEmail')?'emailEvidence':keys.includes('publicPhone')?'phoneEvidence':'identityEvidence'),lv,rv));
        }
        for(const key of new Set([...Object.keys(bl||{}),...Object.keys(l),...Object.keys(br||{}),...Object.keys(r)])){
          if(grouped.has(key))continue;
          const value=visit(bl?.[key],l[key],br?.[key],r[key],path?`${path}.${key}`:key);
          if(value!==undefined)Object.defineProperty(output,key,{value,enumerable:true,configurable:true,writable:true});
        }
        return output;
      }
      return choose(path,l,r);
    }
    const payload=visit(project(options.localBase||base),project(local),project(base),project(server),'');
    return {safe:conflicts.length===0||Boolean(preference),payload,conflicts};
  }
  return {equal,project,merge};
});
