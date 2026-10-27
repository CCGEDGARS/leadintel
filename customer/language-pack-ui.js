(function(root){
 'use strict';
 const endpoint='https://leadintel-api.edgars-7e7.workers.dev',cache=new Map(),pending=new Map(),attempted=new Set();let owner='',timer=null,pollTimer=null,selected=[];
 const catalogue=()=>root.LeadIntelLanguagePackCatalogue;
 function workspace(){return root.LeadIntelServerBridge?.session?.authenticated?String(root.LeadIntelServerBridge.workspace?.id||''):'';}
 function scope(){const id=workspace();if(owner!==id){owner=id;cache.clear();pending.clear();attempted.clear();clearTimeout(pollTimer);}return id;}
 function baseline(language){return {language,status:'baseline',revision:0,rules:[],sources:[],checks:[],error:''};}
 function status(language){scope();return cache.get(language)||baseline(language);}
 function announce(){root.dispatchEvent(new root.CustomEvent('leadintel:language-pack-updated'));renderSetup();}
 async function request(path,{method='GET',body,workspaceId=scope()}={}){
  const controller=new root.AbortController(),timeout=root.setTimeout(()=>controller.abort(),20000);
  try{const r=await root.fetch(endpoint+path+(path.includes('?')?'&':'?')+'workspace_id='+encodeURIComponent(workspaceId),{method,credentials:'include',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});const value=await r.json();if(!r.ok)throw Error(value.error||'Language service unavailable');return value;}finally{root.clearTimeout(timeout);}
 }
 function schedulePoll(){clearTimeout(pollTimer);if([...cache.values()].some(p=>['queued','preparing'].includes(p.status)))pollTimer=root.setTimeout(async()=>{const id=scope();await Promise.allSettled([...cache.keys()].map(async language=>{if(!['queued','preparing'].includes(status(language).status))return;try{const result=await request('/api/language-packs?language='+encodeURIComponent(language),{workspaceId:id});if(id!==scope())return;cache.set(language,result.pack||baseline(language));}catch(error){if(id===scope())cache.set(language,{...status(language),status:'unavailable',error:error.message});}}));announce();schedulePoll();},8000);}
 async function ensure(language,{country='',retry=false}={}){
  const id=scope();if(!id||!catalogue()?.languages[language]||language==='en')return status(language);
  const key=id+':'+language;if(pending.has(key))return pending.get(key);if(attempted.has(key)&&!retry)return status(language);
  attempted.add(key);cache.set(language,{...status(language),status:'queued',error:''});announce();
  const operation=(async()=>{try{const result=await request('/api/language-packs/prepare',{method:'POST',body:{country:country||language,language},workspaceId:id});if(id!==scope())return baseline(language);const pack=result.pack||baseline(language);cache.set(language,pack);return pack;}catch(error){if(id===scope())cache.set(language,{...baseline(language),status:'unavailable',error:error.name==='AbortError'?'Preparation request timed out. Retry.':error.message});return baseline(language);}finally{pending.delete(key);if(id===scope()){announce();schedulePoll();}}})();pending.set(key,operation);return operation;
 }
 async function prepareMarkets(markets){selected=[...new Set((markets||[]).filter(x=>typeof x==='string'))].slice(0,50);const pairs=new Map();for(const country of selected){const hint=catalogue()?.resolveCountry(country);if(hint?.language&&!hint.requiresConfirmation&&hint.language!=='en')pairs.set(hint.language,country);}renderSetup();return Promise.allSettled([...pairs].map(([language,country])=>ensure(language,{country})));}
 function suggestion(item={},markets=[],settings={}){
  if(settings.targetSource==='manual'&&catalogue()?.languages[settings.targetLanguage])return {language:settings.targetLanguage,choices:[settings.targetLanguage],requiresConfirmation:false,source:'manual'};
  const explicit=settings.targetLanguage&&settings.targetLanguage!=='en'?settings.targetLanguage:settings.defaultLanguage&&settings.defaultLanguage!=='en'?settings.defaultLanguage:null;
  if(explicit&&catalogue()?.languages[explicit])return {language:explicit,choices:[explicit],requiresConfirmation:false,source:'manual'};
  const country=item.country||item.dossier?.country||'';const countries=country?[country]:markets;
  const hints=countries.map(value=>catalogue()?.resolveCountry(value)).filter(Boolean),choices=[...new Set(hints.flatMap(h=>h.choices||[h.language]).filter(Boolean))];
  if(hints.length===1)return {...hints[0],source:'market'};
  const unique=[...new Set(hints.map(h=>h.language).filter(Boolean))];return {language:unique.length===1&&!hints.some(h=>h.requiresConfirmation)?unique[0]:null,choices,requiresConfirmation:unique.length!==1||hints.some(h=>h.requiresConfirmation),source:'market'};
 }
 function renderSetup(){const anchor=root.document?.getElementById('selected-target-markets');if(!anchor)return;let panel=root.document.getElementById('country-language-preparation');if(!panel){panel=root.document.createElement('p');panel.id='country-language-preparation';panel.className='country-language-preparation';panel.setAttribute('role','status');anchor.after(panel);}const codes=[...new Set(selected.flatMap(c=>catalogue()?.resolveCountry(c)?.choices||[]).filter(c=>c!=='en'))];panel.textContent='English stays the main language.'+(selected.some(c=>catalogue()?.resolveCountry(c)?.requiresConfirmation)?' Choose an outreach language in Messages for multilingual or unrecognized markets.':'')+(codes.length?' Language support: '+codes.map(code=>{const pack=status(code);return (catalogue()?.languages[code]||code)+' · '+({ai_tested:'AI-tested',queued:'queued',preparing:'preparing',unavailable:'needs attention',baseline:workspace()?'not prepared':'sign in to prepare'}[pack.status]||pack.status);}).join('; ')+'. Translation starts only when you choose Translate.':'');}
 function schedule(markets){selected=markets||[];clearTimeout(timer);renderSetup();timer=root.setTimeout(()=>void prepareMarkets(selected),450);}
 function resume(){scope();let main={};try{main=JSON.parse(root.localStorage.getItem('leadintel_customer_v2_state')||'{}');}catch{}schedule(main.targetMarkets||[]);}
 root.addEventListener('leadintel:target-markets-changed',event=>schedule(event.detail?.markets||[]));root.addEventListener('leadintel:server-ready',resume);root.addEventListener('leadintel:workspace-changed',resume);root.addEventListener('leadintel:workspace-reset',resume);
 root.LeadIntelLanguagePacks={prepareMarkets,ensure,status,suggestion,request,renderSetup};if(root.LeadIntelServerBridge?.ready)resume();
})(typeof window==='object'?window:globalThis);
