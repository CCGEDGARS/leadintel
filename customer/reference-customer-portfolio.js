(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelReferenceCustomerPortfolio=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  'use strict';
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const Ref=root?.LeadIntelReferenceCustomers||(typeof require==='function'?require('./reference-customers.js'):null);
  const Lib=root?.LeadIntelReferenceCustomerLibrary||(typeof require==='function'?(()=>{try{return require('./reference-customer-library.js');}catch{return null;}})():null);
  function idFor(name='list'){let h=2166136261;for(const ch of `${clean(name)}|${Date.now()}|${Math.random()}`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return `rcl-${(h>>>0).toString(36)}`;}
  function normalizeReference(value={}){return Ref?.normalizeReferenceState?Ref.normalizeReferenceState(value||{}):clone(value||{});}
  function emptyReference(){return normalizeReference({rows:[],analyses:{},segments:[],activeSegmentIds:[],activeIds:[],activated:false,fingerprint:'',dna:null,publishedModel:null,draftDirty:false});}
  function normalizeList(value={}){
    const reference=normalizeReference(value.reference||value.referenceCustomers||{});
    return {
      id:clean(value.id)||idFor(value.name),
      name:clean(value.name)||'Untitled customer list',
      markets:[...new Set((Array.isArray(value.markets)?value.markets:String(value.markets||'').split(/\n|;|,/)).map(clean).filter(Boolean))].slice(0,12),
      purpose:clean(value.purpose),
      active:Boolean(value.active&&reference.publishedModel?.active),
      reference,
      createdAt:clean(value.createdAt)||new Date().toISOString(),
      updatedAt:clean(value.updatedAt)||new Date().toISOString()
    };
  }
  function normalizePortfolio(value={}){
    const raw=value&&typeof value==='object'?value:{};
    const seen=new Set(),lists=[];
    for(const item of Array.isArray(raw.lists)?raw.lists:[]){const list=normalizeList(item);if(seen.has(list.id))continue;seen.add(list.id);lists.push(list);}
    const selected=clean(raw.selectedListId);return {version:1,selectedListId:lists.some(x=>x.id===selected)?selected:'',lists};
  }
  function ensurePortfolio(state={}){
    const next=clone(state||{});next.referenceCustomerPortfolio=normalizePortfolio(next.referenceCustomerPortfolio||{});
    if(!next.referenceCustomers)next.referenceCustomers=emptyReference();else next.referenceCustomers=normalizeReference(next.referenceCustomers);
    return next;
  }
  function saveCurrentList(state={},meta={}){
    const next=ensurePortfolio(state),portfolio=next.referenceCustomerPortfolio,selected=portfolio.lists.find(x=>x.id===portfolio.selectedListId)||null;
    const now=new Date().toISOString();
    const list=normalizeList({
      ...(selected||{}),
      id:selected?.id||idFor(meta.name||'customer-list'),
      name:clean(meta.name)||selected?.name||'Untitled customer list',
      markets:meta.markets!==undefined?meta.markets:(selected?.markets||[]),
      purpose:meta.purpose!==undefined?meta.purpose:(selected?.purpose||''),
      active:selected?.active||false,
      reference:next.referenceCustomers,
      createdAt:selected?.createdAt||now,
      updatedAt:now
    });
    const index=portfolio.lists.findIndex(x=>x.id===list.id);if(index>=0)portfolio.lists[index]=list;else portfolio.lists.push(list);
    portfolio.selectedListId=list.id;next.referenceCustomerPortfolio=normalizePortfolio(portfolio);return next;
  }
  function selectList(state={},listId=''){
    const next=ensurePortfolio(state),id=clean(listId),list=next.referenceCustomerPortfolio.lists.find(x=>x.id===id);if(!list)return next;
    next.referenceCustomerPortfolio.selectedListId=id;next.referenceCustomers=clone(list.reference);return next;
  }
  function newList(state={}){const next=ensurePortfolio(state);next.referenceCustomerPortfolio.selectedListId='';next.referenceCustomers=emptyReference();return next;}
  function setListActive(state={},listId='',active=true){
    const next=ensurePortfolio(state),list=next.referenceCustomerPortfolio.lists.find(x=>x.id===clean(listId));if(!list)return next;
    list.active=Boolean(active&&list.reference?.publishedModel?.active);list.updatedAt=new Date().toISOString();
    next.referenceCustomerPortfolio=normalizePortfolio(next.referenceCustomerPortfolio);return next;
  }
  function syncCurrentList(state={}){
    const next=ensurePortfolio(state),id=next.referenceCustomerPortfolio.selectedListId;if(!id)return next;
    const list=next.referenceCustomerPortfolio.lists.find(x=>x.id===id);if(!list)return next;
    list.reference=normalizeReference(next.referenceCustomers);list.updatedAt=new Date().toISOString();
    if(list.active&&!list.reference?.publishedModel?.active)list.active=false;
    next.referenceCustomerPortfolio=normalizePortfolio(next.referenceCustomerPortfolio);return next;
  }
  function getActiveModels(state={}){
    const next=ensurePortfolio(state);return next.referenceCustomerPortfolio.lists.filter(x=>x.active&&x.reference?.publishedModel?.active).map(list=>({
      listId:list.id,listName:list.name,markets:[...list.markets],purpose:list.purpose,
      ...clone(list.reference.publishedModel),active:true
    }));
  }
  function mergeDimensions(models=[]){
    const byKey=new Map();
    for(const model of models)for(const dim of model?.dna?.dimensions||[]){
      const key=clean(dim.key);if(!key)continue;let entry=byKey.get(key);if(!entry){entry={key,values:[],weight:0,confidence:'low',evidenceCount:0};byKey.set(key,entry);}
      for(const value of dim.values||[])if(clean(value)&&!entry.values.includes(clean(value)))entry.values.push(clean(value));
      entry.values=entry.values.slice(0,8);entry.weight=Math.max(entry.weight,Number(dim.weight)||1);entry.evidenceCount+=Number(dim.evidenceCount)||0;
      if(clean(dim.confidence)==='high'||(clean(dim.confidence)==='medium'&&entry.confidence==='low'))entry.confidence=clean(dim.confidence);
    }
    return [...byKey.values()];
  }
  function getCombinedActiveModel(state={}){
    const models=getActiveModels(state);if(!models.length)return null;
    const activeCount=models.reduce((sum,m)=>sum+(Number(m.activeCount||m.dna?.activeCount)||0),0);
    const confidence=models.some(m=>clean(m.confidence||m.dna?.confidence)==='high')?'high':models.some(m=>clean(m.confidence||m.dna?.confidence)==='medium')?'medium':'low';
    const fingerprint=`multi-${models.map(m=>clean(m.fingerprint)).sort().join('+')}`;
    return {active:true,fingerprint,activeCount,confidence,models,dna:{active:true,activeCount,confidence,fingerprint,dimensions:mergeDimensions(models)}};
  }
  function migrateLegacy(state={}){
    let next=ensurePortfolio(state);if(next.referenceCustomerPortfolio.lists.length)return next;
    const reference=next.referenceCustomers;if(!reference?.rows?.length&&!reference?.publishedModel?.active)return next;
    next=saveCurrentList(next,{name:'Reference Customers',markets:next.targetMarkets||[],purpose:'Legacy reference customer model'});
    const id=next.referenceCustomerPortfolio.selectedListId;if(reference?.publishedModel?.active)next=setListActive(next,id,true);return next;
  }
  return {normalizePortfolio,ensurePortfolio,saveCurrentList,selectList,newList,setListActive,syncCurrentList,getActiveModels,getCombinedActiveModel,migrateLegacy};
});
