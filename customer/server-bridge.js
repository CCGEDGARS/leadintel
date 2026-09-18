(function(root){
  'use strict';
  if(root.LeadIntelServerBridge)return;
  const API_BASE='https://leadintel-api.edgars-7e7.workers.dev';
  const ASSET_VERSION='20260918-account-provider-v1';
  const API_REQUEST_TIMEOUT_MS=15000;
  const asset=path=>`${path}?v=${ASSET_VERSION}`;
  const KEYS={main:'leadintel_customer_v2_state',discovery:'leadintel_customer_v2_discovery',outreach:'leadintel_customer_v2_outreach',delivery:'leadintel_customer_v2_delivery',meta:'leadintel_customer_v2_discovery_meta'};
  const WORKSPACE_KEY='leadintel_customer_v2_workspace';
  const AUTH_PROVIDER_KEY='leadintel_auth_provider';
  const HYDRATION_KEY='leadintel_customer_v2_server_hydration';
  const CONFLICT_KEY='leadintel_customer_v2_server_conflict';
  const DIRTY_KEY='leadintel_customer_v2_server_dirty';
  const VERSION_KEY='leadintel_customer_v2_server_versions';
  const CRM_MIGRATION_KEY='leadintel_customer_v2_crm_migrations';
  const BRAND_ASSET_CLEANUP_KEY='leadintel_customer_v2_brand_asset_cleanup_v1';
  const SERVER_RESET_PENDING_KEY='leadintel_customer_v2_reset_pending_v1';
  const ASSET_RESET_CLEANUP_KEY='leadintel_customer_v2_brand_asset_reset_cleanup_v1';
  const BRAND_ASSET_KINDS=new Set(['logo','headshot','banner']);
  const BRAND_ASSET_ID=/^[A-Za-z0-9_-]{43}$/;
  const BRAND_ASSET_URL_PREFIX=`${API_BASE}/api/customer/brand-assets/`;
  const BRAND_IDENTITY_STRING_FIELDS=['companyDisplayName','senderName','senderTitle','website','phone','linkedinUrl','primaryColor','signatureText','legalFooter','postalAddress','updatedAt'];
  let saveTimer=null;let suppress=false;let initialized=false;const brandAssetTransactions=new Map(),workspaceSaveTransactions=new Map(),brandAssetResetGenerations=new Map();
  const bridge={session:null,authProvider:localStorage.getItem(AUTH_PROVIDER_KEY)||'',workspaces:[],workspace:null,stateVersion:0,gmail:{configured:false,connected:false,email:'',role:''},microsoftMail:{configured:false,connected:false,email:'',role:''},status:'local',conflict:false,conflictState:null,saveNow,refreshGmailStatus,refreshMicrosoftMailStatus,syncReplies,sendGmail,sendMicrosoftMail,connectGmail,connectMicrosoftMail,disconnectGmail,disconnectMicrosoftMail,uploadBrandAsset,importBrandAsset,deleteBrandAsset,deleteAllBrandAssets,flushBrandAssetCleanup,invalidateBrandAssetTransactions,signIn,signOut,selectWorkspace,resolveConflictKeepLocal,resolveConflictUseServer,listCrmCompanies,getCrmCompany,saveCrmCompany,addCrmToPipeline,removeCrmFromPipeline,archiveCrmCompany,restoreCrmCompany,suppressCrmCompany,markCrmCustomer,saveCrmContacts,enrichCrmContact,recordCrmActivity,deleteCrmCompany,migrateLocalPipeline,switchProvider};
  root.LeadIntelServerBridge=bridge;
  if(!root.LeadIntelServer)root.LeadIntelServer=bridge;

  function parse(key){try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}}
  function isDataImagePayload(value){return typeof value==='string'&&/^data[\u0000-\u0020]*:[\u0000-\u0020]*image(?:[\u0000-\u0020]*\/|[\u0000-\u0020]*[;,]|$)/i.test(value.trim());}
  function isIsoTimestamp(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return false;const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))return false;const canonical=value.includes('.')?value:value.replace('Z','.000Z');return parsed.toISOString()===canonical;}
  function safeBrandAsset(value){
    const normalized=root.LeadIntelBrandIdentity?.safeAssetReference?.(value);
    const source=normalized||value;
    if(!source||typeof source!=='object'||Array.isArray(source)||!BRAND_ASSET_ID.test(String(source.id||'')))return null;
    const id=String(source.id),url=String(source.url||''),mimeType=String(source.mimeType||'').toLowerCase();
    if(url!==`${BRAND_ASSET_URL_PREFIX}${id}`||!['image/png','image/jpeg','image/webp'].includes(mimeType))return null;
    if(!Number.isSafeInteger(source.width)||source.width<1||source.width>6000||!Number.isSafeInteger(source.height)||source.height<1||source.height>6000)return null;
    if(typeof source.updatedAt!=='string'||!Number.isFinite(Date.parse(source.updatedAt)))return null;
    const rawAlt=typeof value?.altText==='string'?value.altText:'';const altText=typeof source.altText==='string'&&!isDataImagePayload(rawAlt)&&!isDataImagePayload(source.altText)?source.altText.trim().slice(0,300):'';
    return {id,url,mimeType,width:source.width,height:source.height,altText,updatedAt:source.updatedAt};
  }
  function safeBrandIdentity(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const normalized=root.LeadIntelBrandIdentity?.normalize?.(value);
    const source=normalized&&typeof normalized==='object'?normalized:value;
    const validUpdatedAt=isIsoTimestamp(typeof source.updatedAt==='string'?source.updatedAt.trim():'');
    const output={schemaVersion:1,status:source.status==='ready'&&validUpdatedAt?'ready':'draft',revision:Number.isSafeInteger(source.revision)&&source.revision>0?source.revision:1};
    for(const key of BRAND_IDENTITY_STRING_FIELDS){const raw=value[key],candidate=typeof source[key]==='string'?source[key].trim():'';output[key]=isDataImagePayload(raw)||isDataImagePayload(candidate)?'':candidate;}
    if(!validUpdatedAt)output.updatedAt='';
    const options=value.options&&typeof value.options==='object'&&!Array.isArray(value.options)?value.options:{};
    output.options={includeLogo:options.includeLogo!==false,includeHeadshot:options.includeHeadshot===true,includeBanner:options.includeBanner===true};
    const assets=value.assets&&typeof value.assets==='object'&&!Array.isArray(value.assets)?value.assets:{};
    output.assets={logo:safeBrandAsset(assets.logo),headshot:safeBrandAsset(assets.headshot),banner:safeBrandAsset(assets.banner)};
    return output;
  }
  function safeMainState(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||!Object.prototype.hasOwnProperty.call(value,'brandIdentity'))return value;
    return {...value,brandIdentity:safeBrandIdentity(value.brandIdentity)};
  }
  function bundle(){return {main:safeMainState(parse(KEYS.main)),discovery:parse(KEYS.discovery),outreach:parse(KEYS.outreach),delivery:parse(KEYS.delivery),meta:{discovery:parse(KEYS.meta)}};}
  function sameWorkspacePayload(left,right){try{return JSON.stringify(left)===JSON.stringify(right);}catch{return false;}}
  function isEmptyObject(value){return !value||typeof value!=='object'||Object.keys(value).length===0;}
  function hasLocalData(value=bundle()){return ['main','discovery','outreach','delivery'].some(key=>!isEmptyObject(value[key]));}
  function readVersionMap(){try{const value=JSON.parse(localStorage.getItem(VERSION_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
  function readRememberedVersion(workspaceId){const value=Number(readVersionMap()[String(workspaceId||'')]);return Number.isFinite(value)&&value>=0?value:0;}
  function rememberServerVersion(workspaceId,version){if(!workspaceId)return;const map=readVersionMap();map[String(workspaceId)]=Math.max(0,Number(version)||0);localStorage.setItem(VERSION_KEY,JSON.stringify(map));}
  function readDirtyLocalState(){try{const value=JSON.parse(localStorage.getItem(DIRTY_KEY)||'null');return value&&typeof value==='object'?value:null;}catch{return null;}}
  function localWorkspaceId(){return bridge.workspace?.id||localStorage.getItem(WORKSPACE_KEY)||'';}
  function hasDirtyLocalState(){const value=readDirtyLocalState();return Boolean(value&&bridge.workspace&&(value.workspace_id===bridge.workspace.id||!value.workspace_id));}
  function markDirtyLocalState(){const workspaceId=localWorkspaceId();const current=readDirtyLocalState();if(current&&current.workspace_id===workspaceId)return;const baseVersion=bridge.workspace?bridge.stateVersion:readRememberedVersion(workspaceId);localStorage.setItem(DIRTY_KEY,JSON.stringify({workspace_id:workspaceId,base_version:baseVersion,updated_at:Date.now()}));}
  function rebaseDirtyLocalState(){if(!bridge.workspace)return;localStorage.setItem(DIRTY_KEY,JSON.stringify({workspace_id:bridge.workspace.id,base_version:bridge.stateVersion,updated_at:Date.now()}));}
  function clearDirtyLocalState(){const current=readDirtyLocalState();if(!current||!bridge.workspace||current.workspace_id===bridge.workspace.id||!current.workspace_id)localStorage.removeItem(DIRTY_KEY);}
  function clearCustomerCache(){suppress=true;try{for(const key of Object.values(KEYS))localStorage.removeItem(key);}finally{suppress=false;}}
  function endpoint(path){return `${API_BASE}${path}`;}
  async function api(path,options={}){
    const {headers={},body,signal:externalSignal,...rest}=options;
    const multipart=typeof FormData!=='undefined'&&body instanceof FormData;
    const Controller=typeof AbortController==='function'?AbortController:null;
    const controller=Controller?new Controller():null;
    const forwardAbort=()=>controller?.abort(externalSignal?.reason);
    if(externalSignal?.aborted)forwardAbort();
    else externalSignal?.addEventListener?.('abort',forwardAbort,{once:true});
    const timeout=controller?setTimeout(()=>controller.abort(new DOMException('LeadIntel request timed out','TimeoutError')),API_REQUEST_TIMEOUT_MS):null;
    try{
      const request={credentials:'include',...rest,body,headers:{'Accept':'application/json',...(body&&!multipart?{'Content-Type':'application/json'}:{}),...headers},...(controller?{signal:controller.signal}:{})};
      const response=await fetch(endpoint(path),request);
      const payload=await response.json().catch(()=>({}));
      return {response,payload};
    }catch(cause){
      if(controller?.signal.aborted&&!externalSignal?.aborted)throw new Error('LeadIntel server request timed out');
      throw cause;
    }finally{
      clearTimeout(timeout);
      externalSignal?.removeEventListener?.('abort',forwardAbort);
    }
  }
  function returnTo(){const url=new URL(location.href);url.searchParams.delete('auth');url.searchParams.delete('gmail');url.searchParams.delete('microsoft_mail');url.searchParams.delete('reason');url.searchParams.delete('workspace_id');return url.toString();}
  function setStatus(text,kind=''){bridge.status=kind||text;const existing=document.querySelector('.autosave');if(existing){existing.innerHTML=`<i></i>${text}`;existing.dataset.serverStatus=kind||'';}const status=document.getElementById('server-sync-status');if(status){status.textContent=text;status.dataset.state=kind||'';}}
  function showToast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove('show'),3000);}
  function injectCss(){if(document.querySelector('link[data-leadintel-asset="server-css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=asset('server.css');link.dataset.leadintelAsset='server-css';document.head.appendChild(link);}
  function injectAccountUi(){
    const actions=document.querySelector('.top-actions');if(!actions||document.getElementById('server-account'))return;
    actions.insertAdjacentHTML('afterbegin','<div class="server-account" id="server-account"><div class="server-signin-options" id="server-signin-options"><button class="ghost-btn server-signin" id="server-google-signin" type="button">Sign in with Google</button><button class="ghost-btn server-signin server-microsoft-signin" id="server-microsoft-signin" type="button">Sign in with Microsoft</button></div><select id="server-workspace-select" aria-label="LeadIntel workspace" hidden></select><span id="server-account-label" hidden></span><span class="server-auth-provider" id="server-auth-provider" hidden></span><span class="server-sync" id="server-sync-status">Local workspace</span><div class="server-conflict-actions" id="server-conflict-actions" hidden><button class="ghost-btn" id="server-use-server" type="button">Use server version</button><button class="ghost-btn" id="server-keep-local" type="button">Keep my local changes</button></div><button class="server-signout" id="server-signout" type="button" hidden>Sign out</button></div>');
    document.getElementById('server-google-signin')?.addEventListener('click',()=>signIn('google'));document.getElementById('server-microsoft-signin')?.addEventListener('click',()=>signIn('microsoft'));document.getElementById('server-signout')?.addEventListener('click',signOut);document.getElementById('server-workspace-select')?.addEventListener('change',e=>selectWorkspace(e.target.value));document.getElementById('server-use-server')?.addEventListener('click',resolveConflictUseServer);document.getElementById('server-keep-local')?.addEventListener('click',resolveConflictKeepLocal);
  }
  function renderConflictActions(){const actions=document.getElementById('server-conflict-actions');if(actions)actions.hidden=!bridge.conflict;}
  function renderAccount(){injectAccountUi();const signin=document.getElementById('server-signin-options');const select=document.getElementById('server-workspace-select');const label=document.getElementById('server-account-label');const provider=document.getElementById('server-auth-provider');const signout=document.getElementById('server-signout');if(!signin)return;
    const authenticated=Boolean(bridge.session?.authenticated);signin.hidden=authenticated;select.hidden=!authenticated||bridge.workspaces.length<2;label.hidden=!authenticated;signout.hidden=!authenticated;
    const providerName=bridge.authProvider==='google'?'Google':bridge.authProvider==='microsoft'?'Microsoft':'';
    const identity=bridge.session?.user?.email||bridge.session?.user?.name||'workspace user';
    if(provider){provider.hidden=!authenticated||!providerName;provider.textContent=authenticated&&providerName?`${providerName} · ${identity}`:'';provider.title=authenticated&&providerName?`Signed in with ${providerName} as ${identity}`:'';provider.dataset.provider=providerName.toLowerCase();provider.setAttribute('aria-label',provider.title);}
    if(authenticated){label.textContent=bridge.session.user?.name||bridge.session.user?.email||'Signed in';select.innerHTML=bridge.workspaces.map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===bridge.workspace?.id?'selected':''}>${escapeHtml(item.name)} · ${escapeHtml(item.role)}</option>`).join('');}renderConflictActions();
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function patchStorage(){if(Storage.prototype.__leadintelServerPatched)return;const set=Storage.prototype.setItem;const remove=Storage.prototype.removeItem;Storage.prototype.setItem=function(key,value){set.call(this,key,value);if(this===localStorage&&Object.values(KEYS).includes(key)&&!suppress){markDirtyLocalState();scheduleSave();}};Storage.prototype.removeItem=function(key){remove.call(this,key);if(this===localStorage&&Object.values(KEYS).includes(key)&&!suppress){markDirtyLocalState();scheduleSave();}};Storage.prototype.__leadintelServerPatched=true;}
  function scheduleSave(){if(!bridge.session?.authenticated||!bridge.workspace||bridge.conflict)return;markDirtyLocalState();clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveNow(),1200);}
  function applyPayload(payload){suppress=true;try{const p=payload&&typeof payload==='object'?payload:{};for(const key of ['main','discovery','outreach','delivery']){if(p[key]&&typeof p[key]==='object')localStorage.setItem(KEYS[key],JSON.stringify(p[key]));else localStorage.removeItem(KEYS[key]);}if(p.meta?.discovery)localStorage.setItem(KEYS.meta,JSON.stringify(p.meta.discovery));else localStorage.removeItem(KEYS.meta);}finally{suppress=false;}}
  async function fetchSession(){const {response,payload}=await api('/api/session');bridge.session=response.ok?payload:{authenticated:false};return bridge.session;}
  async function fetchWorkspaces(){const {response,payload}=await api('/api/workspaces');bridge.workspaces=response.ok&&Array.isArray(payload.workspaces)?payload.workspaces:[];return bridge.workspaces;}
  async function fetchWorkspaceState(){if(!bridge.workspace)return null;const {response,payload}=await api(`/api/customer/state?workspace_id=${encodeURIComponent(bridge.workspace.id)}`);if(!response.ok)throw new Error(payload.error||'Unable to load workspace state');bridge.stateVersion=Number(payload.version)||0;return payload;}
  function pickWorkspace(){const preferred=localStorage.getItem(WORKSPACE_KEY);const dirty=readDirtyLocalState();const dirtyWorkspace=dirty?.workspace_id?bridge.workspaces.find(item=>item.id===dirty.workspace_id):null;bridge.workspace=dirtyWorkspace||bridge.workspaces.find(item=>item.id===preferred)||bridge.workspaces[0]||null;if(bridge.workspace)localStorage.setItem(WORKSPACE_KEY,bridge.workspace.id);}
  function enterConflict(state,message){bridge.conflict=true;bridge.conflictState=state&&typeof state==='object'?state:null;renderConflictActions();setStatus('Sync conflict · local changes preserved','error');showToast(message||'Server state changed in another session. Your local changes are still safe in this browser.');}
  async function hydrateAuthenticated(){const state=await fetchWorkspaceState();const marker=`${bridge.workspace.id}:${state.version}`;const dirty=readDirtyLocalState();if(hasDirtyLocalState()){if(!dirty.workspace_id&&Number(state.version)===0)rebaseDirtyLocalState();else if(Number(dirty.base_version)!==Number(state.version)){enterConflict(state,'LeadIntel preserved your local changes because the server workspace changed in another session.');return true;}setStatus('Unsynced changes · retrying','saving');scheduleSave();return true;}if(state.version>0&&sessionStorage.getItem(HYDRATION_KEY)!==marker){applyPayload(state.payload);clearDirtyLocalState();rememberServerVersion(bridge.workspace.id,state.version);sessionStorage.setItem(HYDRATION_KEY,marker);setStatus('Synced to LeadIntel','synced');location.reload();return false;}if(state.version===0&&hasLocalData()){markDirtyLocalState();setStatus('Unsynced changes · saving','saving');scheduleSave();return true;}rememberServerVersion(bridge.workspace.id,state.version);setStatus('Synced to LeadIntel','synced');return true;}
  async function init(){if(initialized)return;initialized=true;injectCss();injectAccountUi();patchStorage();const conflictNote=sessionStorage.getItem(CONFLICT_KEY);if(conflictNote){sessionStorage.removeItem(CONFLICT_KEY);showToast(conflictNote);}
    try{await fetchSession();if(!bridge.session?.authenticated){setStatus('Local workspace · Sign in to sync','local');renderAccount();root.dispatchEvent(new CustomEvent('leadintel:server-ready',{detail:bridge}));return;}await fetchWorkspaces();pickWorkspace();renderAccount();if(!bridge.workspace){setStatus('Signed in · No workspace','error');return;}const stay=await hydrateAuthenticated();if(!stay)return;const migration=await migrateLocalPipeline();if(!migration.ok)console.warn('LeadIntel CRM migration:',migration.error||'migration unavailable');await flushBrandAssetCleanup();await Promise.all([refreshGmailStatus(),refreshMicrosoftMailStatus()]);root.dispatchEvent(new CustomEvent('leadintel:server-ready',{detail:bridge}));}catch(cause){console.warn('LeadIntel server bridge:',cause);setStatus('Local cache · Server unavailable','error');renderAccount();root.dispatchEvent(new CustomEvent('leadintel:server-ready',{detail:bridge}));}
  }
  function runWorkspaceSave(context,operation){const key=String(context.workspaceId),previous=workspaceSaveTransactions.get(key)||Promise.resolve();const run=previous.catch(()=>{}).then(()=>operation());const tracked=run.then(value=>{if(workspaceSaveTransactions.get(key)===tracked)workspaceSaveTransactions.delete(key);return value;},cause=>{if(workspaceSaveTransactions.get(key)===tracked)workspaceSaveTransactions.delete(key);throw cause;});workspaceSaveTransactions.set(key,tracked);return tracked;}
  async function saveNow(options={}){if(!bridge.session?.authenticated||!bridge.workspace||bridge.conflict)return {saved:false};clearTimeout(saveTimer);const context={workspaceId:bridge.workspace.id,saveIntent:options?.saveIntent===true,explicitSave:options?.explicitSave===true};return runWorkspaceSave(context,()=>saveWorkspaceState(context));}
  async function saveWorkspaceState(context){if(!bridge.session?.authenticated||!bridge.workspace||bridge.workspace.id!==context.workspaceId||bridge.conflict)return {saved:false};markDirtyLocalState();setStatus('Saving to LeadIntel…','saving');const payload={schema_version:1,version:bridge.stateVersion,payload:bundle()};const {response,payload:result}=await api(`/api/customer/state?workspace_id=${encodeURIComponent(context.workspaceId)}`,{method:'PUT',body:JSON.stringify(payload),leadintelSaveIntent:context.saveIntent,leadintelExplicitSave:context.explicitSave});
    if(response.status===409){bridge.stateVersion=Number(result.current?.version)||bridge.stateVersion;sessionStorage.setItem(CONFLICT_KEY,'Server state changed in another session. Your local changes were preserved and were not overwritten.');enterConflict(result.current);return {saved:false,conflict:true};}
    if(!response.ok){setStatus('Sync failed · Local cache safe','error');throw new Error(result.error||'Workspace save failed');}if(result?.saved===false){setStatus('Sync skipped · Local cache safe','error');return {saved:false,version:bridge.stateVersion};}const savedWorkspaceId=context.workspaceId;bridge.stateVersion=Number(result.version)||bridge.stateVersion+1;rememberServerVersion(savedWorkspaceId,bridge.stateVersion);sessionStorage.setItem(HYDRATION_KEY,`${savedWorkspaceId}:${bridge.stateVersion}`);const hasNewerLocalState=!sameWorkspacePayload(bundle(),payload.payload);if(hasNewerLocalState)rebaseDirtyLocalState();else clearDirtyLocalState();bridge.conflict=false;bridge.conflictState=null;renderConflictActions();setStatus(hasNewerLocalState?'Unsaved changes · click Save workspace':'Synced to LeadIntel',hasNewerLocalState?'saving':'synced');const afterSave=root.LeadIntelWorkspaceResetHygiene?.afterWorkspaceSaved;if(typeof afterSave==='function')void Promise.resolve(afterSave(savedWorkspaceId)).catch(cause=>console.warn('LeadIntel brand asset reset cleanup:',cause));return {saved:true,version:bridge.stateVersion,dirty:hasNewerLocalState};
  }
  async function resolveConflictUseServer(){if(!bridge.workspace||!bridge.conflictState)return {resolved:false};const state=bridge.conflictState;applyPayload(state.payload);bridge.stateVersion=Number(state.version)||0;rememberServerVersion(bridge.workspace.id,bridge.stateVersion);bridge.conflict=false;bridge.conflictState=null;clearDirtyLocalState();sessionStorage.removeItem(CONFLICT_KEY);sessionStorage.setItem(HYDRATION_KEY,`${bridge.workspace.id}:${bridge.stateVersion}`);renderConflictActions();setStatus('Synced to LeadIntel','synced');showToast('Server version restored.');location.reload();return {resolved:true,source:'server'};}
  async function resolveConflictKeepLocal(){if(!bridge.workspace||!bridge.conflictState)return {resolved:false};bridge.stateVersion=Number(bridge.conflictState.version)||bridge.stateVersion;bridge.conflict=false;bridge.conflictState=null;sessionStorage.removeItem(CONFLICT_KEY);rebaseDirtyLocalState();renderConflictActions();setStatus('Saving local changes…','saving');const result=await saveNow({saveIntent:true});if(result.saved)showToast('Your local changes are now saved to LeadIntel.');return {resolved:Boolean(result.saved),source:'local',...result};}
  function signIn(provider='google'){const routes={google:'/api/auth/google/start',microsoft:'/api/auth/microsoft/start'},selected=provider==='microsoft'?'microsoft':'google';bridge.authProvider=selected;localStorage.setItem?.(AUTH_PROVIDER_KEY,selected);location.href=endpoint(`${routes[selected]}?return_to=${encodeURIComponent(returnTo())}`);}
  async function signOut(){await api('/api/logout',{method:'POST'});bridge.authProvider='';localStorage.removeItem?.(AUTH_PROVIDER_KEY);sessionStorage.removeItem(HYDRATION_KEY);location.reload();}
  async function switchProvider(provider='google'){const routes={google:'/api/auth/google/start',microsoft:'/api/auth/microsoft/start'},selected=provider==='microsoft'?'microsoft':'google';const {response}=await api('/api/logout',{method:'POST'});if(!response.ok){showToast('Unable to switch workspace account.');return {ok:false};}bridge.authProvider=selected;localStorage.setItem?.(AUTH_PROVIDER_KEY,selected);location.href=endpoint(`${routes[selected]}?return_to=${encodeURIComponent(returnTo())}`);return {ok:true};}
  async function selectWorkspace(id){if(!bridge.workspaces.some(item=>item.id===id)||id===bridge.workspace?.id)return;if(hasDirtyLocalState()||bridge.conflict){const message=bridge.conflict?'Resolve the current sync conflict before switching workspaces.':'Finish syncing before switching workspaces.';setStatus(message,bridge.conflict?'error':'saving');showToast(message);const select=document.getElementById('server-workspace-select');if(select&&bridge.workspace)select.value=bridge.workspace.id;return;}clearCustomerCache();localStorage.setItem(WORKSPACE_KEY,id);sessionStorage.removeItem(HYDRATION_KEY);location.reload();}
  function brandAssetContext(kind){
    if(!bridge.session?.authenticated)throw new Error('Sign in to manage brand assets');
    if(!bridge.workspace?.id)throw new Error('No workspace selected');
    const normalized=String(kind||'').trim().toLowerCase();
    if(!BRAND_ASSET_KINDS.has(normalized))throw new TypeError('Brand asset kind must be logo, headshot, or banner');
    return {kind:normalized,workspaceId:bridge.workspace.id};
  }
  function assetError(response,payload,fallback){const error=new Error(payload?.error||fallback);error.status=response.status;return error;}
  function emitBrandAssetEvent(type,detail){try{root.dispatchEvent?.(new CustomEvent(type,{detail}));}catch{}}
  function brandAssetResetGeneration(workspaceId){return Number(brandAssetResetGenerations.get(String(workspaceId||'')))||0;}
  function invalidateBrandAssetTransactions(workspaceId=localWorkspaceId()){
    const key=String(workspaceId||'');if(!key)return 0;const generation=brandAssetResetGeneration(key)+1;brandAssetResetGenerations.set(key,generation);emitBrandAssetEvent('leadintel:brand-asset-reset-generation',{workspaceId:key,generation});return generation;
  }
  function resetRecordMatchesWorkspace(key,workspaceId){try{const raw=localStorage.getItem(key);if(!raw)return false;if(raw==='1')return true;const value=JSON.parse(raw),intended=String(value?.workspace_id||'');return intended?intended===String(workspaceId):bridge.workspaces.length===1;}catch{return false;}}
  function brandAssetResetPending(workspaceId){return resetRecordMatchesWorkspace(SERVER_RESET_PENDING_KEY,workspaceId)||resetRecordMatchesWorkspace(ASSET_RESET_CLEANUP_KEY,workspaceId);}
  function captureBrandAssetOperation(context){const main=parse(KEYS.main);return {generation:brandAssetResetGeneration(context.workspaceId),identityPresent:Object.prototype.hasOwnProperty.call(main,'brandIdentity')&&main.brandIdentity!==null};}
  function brandAssetOperationCancelled(context,operation){const main=parse(KEYS.main),identityPresent=Object.prototype.hasOwnProperty.call(main,'brandIdentity')&&main.brandIdentity!==null;return brandAssetResetGeneration(context.workspaceId)!==operation.generation||brandAssetResetPending(context.workspaceId)||(operation.identityPresent&&!identityPresent);}
  function readBrandAssetCleanup(){try{const value=JSON.parse(localStorage.getItem(BRAND_ASSET_CLEANUP_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
  function writeBrandAssetCleanup(value){if(value.length)localStorage.setItem(BRAND_ASSET_CLEANUP_KEY,JSON.stringify(value));else localStorage.removeItem(BRAND_ASSET_CLEANUP_KEY);}
  function queueBrandAssetCleanup({workspaceId,kind,id,reason}){try{const queue=readBrandAssetCleanup();if(!queue.some(item=>item.workspace_id===workspaceId&&item.id===id))queue.push({workspace_id:workspaceId,kind,id,reason,queued_at:Date.now(),attempts:0});writeBrandAssetCleanup(queue);return {queued:true,warning:false};}catch(error){const detail={workspaceId,kind,id,reason,queued:false,message:String(error?.message||error)};emitBrandAssetEvent('leadintel:brand-asset-cleanup-warning',detail);try{console.warn('LeadIntel brand asset cleanup could not be queued',detail);}catch{}return {queued:false,warning:true,error};}}
  function runBrandAssetTransaction(context,operation){
    const key=String(context.workspaceId),previous=brandAssetTransactions.get(key)||Promise.resolve();
    const run=previous.catch(()=>{}).then(()=>operation());
    const tracked=run.then(value=>{if(brandAssetTransactions.get(key)===tracked)brandAssetTransactions.delete(key);return value;},cause=>{if(brandAssetTransactions.get(key)===tracked)brandAssetTransactions.delete(key);throw cause;});
    brandAssetTransactions.set(key,tracked);return tracked;
  }
  async function deleteBrandAssetRequest(context,id){
    const {response,payload}=await api(`/api/customer/brand-assets/${encodeURIComponent(id)}?workspace_id=${encodeURIComponent(context.workspaceId)}`,{method:'DELETE'});
    if(response.status===409&&payload?.retained===true)return {ok:true,status:409,...payload};
    if(!response.ok&&response.status!==404)throw assetError(response,payload,'Brand asset removal failed');
    return {ok:true,status:response.status,...payload};
  }
  async function cleanupManagedAsset(context,asset,reason){
    if(!asset?.id||!BRAND_ASSET_ID.test(String(asset.id)))return {deleted:true,queued:false};
    try{const result=await deleteBrandAssetRequest(context,String(asset.id));return {deleted:result.status!==409,retained:result.status===409,queued:false,result};}
    catch(error){const queue=queueBrandAssetCleanup({workspaceId:context.workspaceId,kind:context.kind,id:String(asset.id),reason});return {deleted:false,queued:queue.queued,warning:queue.warning,error,queueError:queue.error};}
  }
  async function flushBrandAssetCleanup(){
    if(!bridge.session?.authenticated||!bridge.workspace?.id){const detail={attempted:0,deleted:0,failed:0};emitBrandAssetEvent('leadintel:brand-asset-cleanup',detail);return detail;}
    const queue=readBrandAssetCleanup(),remaining=[];let attempted=0,deleted=0,failed=0;
    for(const item of queue){
      if(item?.workspace_id!==bridge.workspace.id){remaining.push(item);continue;}
      if(!BRAND_ASSET_KINDS.has(item.kind)||!BRAND_ASSET_ID.test(String(item.id||'')))continue;
      attempted++;
      try{await deleteBrandAssetRequest({workspaceId:item.workspace_id,kind:item.kind},item.id);deleted++;}
      catch{failed++;remaining.push({...item,attempts:(Number(item.attempts)||0)+1,last_attempt_at:Date.now()});}
    }
    writeBrandAssetCleanup(remaining);const detail={attempted,deleted,failed};emitBrandAssetEvent('leadintel:brand-asset-cleanup',detail);return detail;
  }
  function writeMainRaw(value){suppress=true;try{if(value===null)localStorage.removeItem(KEYS.main);else localStorage.setItem(KEYS.main,value);}finally{suppress=false;}}
  function requestedBrandIdentity(current,kind,asset){return {...current,status:'draft',assets:{...current.assets,[kind]:asset}};}
  function assetTransactionResult(options,asset,identity,cleanup){return options?.returnTransaction?{asset,identity,cleanupQueued:Boolean(cleanup?.queued),cleanupWarning:Boolean(cleanup?.warning)}:asset;}
  async function cancelBrandAssetReplacement(context,asset){const cleanup=await cleanupManagedAsset(context,asset,'reset-cancelled');const result={cancelled:true,reset:true,asset:null,identity:null,cleanupQueued:Boolean(cleanup.queued),cleanupWarning:Boolean(cleanup.warning)};emitBrandAssetEvent('leadintel:brand-asset-transaction',{workspaceId:context.workspaceId,kind:context.kind,committed:false,cancelled:true,reset:true,rollbackDeleted:cleanup.deleted,cleanupQueued:cleanup.queued,cleanupWarning:Boolean(cleanup.warning)});return result;}
  function sameBrandAsset(left,right){const a=safeBrandAsset(left),b=safeBrandAsset(right);return a&&b?a.id===b.id:!a&&!b;}
  function rollbackBrandAssetMutation(context,failedAsset,previousAsset){try{const currentMain=parse(KEYS.main),currentIdentity=safeBrandIdentity(currentMain.brandIdentity)||safeBrandIdentity({});if(!sameBrandAsset(currentIdentity.assets?.[context.kind],failedAsset))return false;const restored={...currentIdentity,assets:{...currentIdentity.assets,[context.kind]:previousAsset||null}};writeMainRaw(JSON.stringify({...currentMain,brandIdentity:restored}));return true;}catch(cause){emitBrandAssetEvent('leadintel:brand-asset-restore-failed',{message:String(cause?.message||cause)});return false;}}
  async function commitBrandAssetReplacement(context,nextAsset,options={},operation){
    if(brandAssetOperationCancelled(context,operation))return cancelBrandAssetReplacement(context,nextAsset);
    let previousAsset=null,safeNext=null,nextIdentity=null;
    try{
      const previousMain=parse(KEYS.main),previousIdentity=safeBrandIdentity(previousMain.brandIdentity)||safeBrandIdentity({});
      previousAsset=safeBrandAsset(previousIdentity.assets?.[context.kind]);
      safeNext=safeBrandAsset(nextAsset);
      if(!safeNext)throw new Error('Brand asset upload returned an invalid managed asset');
      nextIdentity=requestedBrandIdentity(previousIdentity,context.kind,safeNext);
      writeMainRaw(JSON.stringify({...previousMain,brandIdentity:nextIdentity}));
      const saved=await saveNow({saveIntent:true});
      if(!saved?.saved)throw new Error(saved?.conflict?'Workspace save conflict':'Workspace save failed');
    }catch(cause){
      rollbackBrandAssetMutation(context,safeNext,previousAsset);
      const rollback=await cleanupManagedAsset(context,safeNext||nextAsset,safeNext?'rollback':'invalid-response');
      emitBrandAssetEvent('leadintel:brand-asset-transaction',{workspaceId:context.workspaceId,kind:context.kind,committed:false,rollbackDeleted:rollback.deleted,cleanupQueued:rollback.queued,cleanupWarning:Boolean(rollback.warning)});
      throw cause;
    }
    const retired=previousAsset?.id&&previousAsset.id!==safeNext.id
      ?await cleanupManagedAsset(context,previousAsset,'replaced')
      :{deleted:false,queued:false,retained:false};
    emitBrandAssetEvent('leadintel:brand-asset-transaction',{workspaceId:context.workspaceId,kind:context.kind,committed:true,rollbackDeleted:false,cleanupQueued:retired.queued,cleanupWarning:Boolean(retired.warning)});
    return assetTransactionResult(options,safeNext,nextIdentity,retired);
  }
  async function uploadBrandAsset(kind,file,options={}){
    const context=brandAssetContext(kind);
    const operation=captureBrandAssetOperation(context);
    if(!file||typeof file!=='object')throw new TypeError('A brand image file is required');
    return runBrandAssetTransaction(context,async()=>{
      const form=new FormData();form.append('kind',context.kind);form.append('file',file);
      if(typeof options.altText==='string'&&options.altText.trim())form.append('alt_text',options.altText.trim());
      const {response,payload}=await api(`/api/customer/brand-assets?workspace_id=${encodeURIComponent(context.workspaceId)}`,{method:'POST',body:form});
      if(!response.ok)throw assetError(response,payload,'Brand asset upload failed');
      if(!payload?.asset)throw new Error('Brand asset upload returned no managed asset');
      return commitBrandAssetReplacement(context,payload.asset,options,operation);
    });
  }
  async function importBrandAsset(kind,url,options={}){
    const context=brandAssetContext(kind);
    const fallback='Automatic logo copy was blocked by the website or browser. Download the image and upload it using the Logo field.';
    let source,website;
    try{source=new URL(String(url||''));website=new URL(String(options.expectedWebsite||''));}catch{throw new Error(fallback);}
    if(source.protocol!=='https:'||website.protocol!=='https:'||source.origin!==website.origin)throw new Error(fallback);
    let response;
    try{response=await fetch(source.href,{method:'GET',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',headers:{Accept:'image/png,image/jpeg,image/webp'}});}
    catch{throw new Error(fallback);}
    if(!response.ok||!response.url||new URL(response.url).origin!==source.origin)throw new Error(fallback);
    const mimeType=String(response.headers.get('Content-Type')||'').split(';',1)[0].trim().toLowerCase();
    const limit=context.kind==='logo'?2*1024*1024:5*1024*1024;
    const declaredSize=Number(response.headers.get('Content-Length'));
    if(!['image/png','image/jpeg','image/webp'].includes(mimeType)||(Number.isFinite(declaredSize)&&declaredSize>limit))throw new Error(fallback);
    const blob=await response.blob();
    if(blob.size<1||blob.size>limit||String(blob.type||'').split(';',1)[0].toLowerCase()!==mimeType)throw new Error(fallback);
    const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mimeType];
    const file=typeof File==='function'?new File([blob],`website-${context.kind}.${extension}`,{type:mimeType}):blob;
    return uploadBrandAsset(context.kind,file,{...options,altText:options.altText||'Company logo'});
  }
  function removalResult(options,deleted,identity,cleanup){return options?.returnTransaction?{asset:null,identity,cleanupQueued:Boolean(cleanup?.queued),cleanupWarning:Boolean(cleanup?.warning)}:deleted;}
  function cancelBrandAssetRemoval(context){const result={cancelled:true,reset:true,asset:null,identity:null,cleanupQueued:false,cleanupWarning:false};emitBrandAssetEvent('leadintel:brand-asset-transaction',{workspaceId:context.workspaceId,kind:context.kind,committed:false,cancelled:true,reset:true,removed:false,cleanupQueued:false,cleanupWarning:false});return result;}
  async function commitBrandAssetRemoval(context,asset,options={},operation){
    if(brandAssetOperationCancelled(context,operation))return cancelBrandAssetRemoval(context);
    const previousMain=parse(KEYS.main),previousIdentity=safeBrandIdentity(previousMain.brandIdentity)||safeBrandIdentity({});
    const previousAsset=safeBrandAsset(previousIdentity.assets?.[context.kind])||safeBrandAsset(asset)||(BRAND_ASSET_ID.test(String(asset||''))?{id:String(asset)}:null);
    if(!previousAsset)throw new TypeError('A valid managed brand asset is required');
    const nextIdentity=requestedBrandIdentity(previousIdentity,context.kind,null);
    try{
      writeMainRaw(JSON.stringify({...previousMain,brandIdentity:nextIdentity}));
      const saved=await saveNow({saveIntent:true});
      if(!saved?.saved)throw new Error(saved?.conflict?'Workspace save conflict':'Workspace save failed');
    }catch(cause){rollbackBrandAssetMutation(context,null,previousAsset);throw cause;}
    const cleanup=await cleanupManagedAsset(context,previousAsset,'removed');
    emitBrandAssetEvent('leadintel:brand-asset-transaction',{workspaceId:context.workspaceId,kind:context.kind,committed:true,removed:true,cleanupQueued:cleanup.queued,cleanupWarning:Boolean(cleanup.warning)});
    return removalResult(options,cleanup.result||{ok:cleanup.deleted,status:cleanup.deleted?200:0,asset_id:previousAsset.id,queued:cleanup.queued,cleanup_warning:Boolean(cleanup.warning)},nextIdentity,cleanup);
  }
  async function deleteBrandAsset(kind,asset,options={}){
    const context=brandAssetContext(kind);const id=typeof asset==='string'?asset:String(asset?.id||'');
    if(!BRAND_ASSET_ID.test(id))throw new TypeError('A valid managed brand asset is required');
    if(options?.cleanupOnly===true)return runBrandAssetTransaction(context,async()=>{const cleanup=await cleanupManagedAsset(context,{id},'reset');return cleanup.result||{ok:cleanup.deleted,status:cleanup.deleted?200:0,asset_id:id,queued:cleanup.queued,cleanup_warning:Boolean(cleanup.warning)};});
    const operation=captureBrandAssetOperation(context);
    return runBrandAssetTransaction(context,()=>commitBrandAssetRemoval(context,asset,options,operation));
  }
  async function deleteAllBrandAssets(){
    if(!bridge.session?.authenticated||!bridge.workspace?.id)return {ok:false,status:401,error:'Sign in to reset brand assets'};
    const workspaceId=bridge.workspace.id;
    const {response,payload}=await api(`/api/customer/brand-assets?workspace_id=${encodeURIComponent(workspaceId)}`,{method:'DELETE'});
    if(!response.ok)throw assetError(response,payload,'Workspace brand asset reset failed');
    return {ok:true,status:response.status,deleted:Number(payload?.deleted)||0};
  }
  function crmPath(path=''){if(!bridge.workspace)throw new Error('No workspace selected');const join=path.includes('?')?'&':'?';return `/api/crm${path}${join}workspace_id=${encodeURIComponent(bridge.workspace.id)}`;}
  async function crmRequest(path,options={}){if(!bridge.session?.authenticated||!bridge.workspace)return {ok:false,status:401,error:'Sign in to use Master CRM'};const {response,payload}=await api(crmPath(path),options);if(!response.ok)return {ok:false,status:response.status,...payload};return {ok:true,status:response.status,...payload};}
  async function listCrmCompanies(filters={}){const params=new URLSearchParams();if(filters.q)params.set('q',filters.q);if(filters.lifecycle)params.set('lifecycle',filters.lifecycle);if(filters.pipeline_stage||filters.pipelineStage)params.set('pipeline_stage',filters.pipeline_stage||filters.pipelineStage);if(filters.limit)params.set('limit',filters.limit);if(filters.cursor)params.set('cursor',filters.cursor);const suffix=params.toString()?`?${params.toString()}`:'';return crmRequest(`/companies${suffix}`);}
  async function getCrmCompany(id){return crmRequest(`/companies/${encodeURIComponent(id)}`);}
  async function saveCrmCompany(payload){return crmRequest('/companies',{method:'POST',body:JSON.stringify(payload||{})});}
  async function addCrmToPipeline(id,stage='Discovered'){return crmRequest(`/companies/${encodeURIComponent(id)}/pipeline`,{method:'POST',body:JSON.stringify({stage})});}
  async function removeCrmFromPipeline(id){return crmRequest(`/companies/${encodeURIComponent(id)}/pipeline`,{method:'DELETE'});}
  async function archiveCrmCompany(id){return crmRequest(`/companies/${encodeURIComponent(id)}/archive`,{method:'POST'});}
  async function restoreCrmCompany(id){return crmRequest(`/companies/${encodeURIComponent(id)}/restore`,{method:'POST'});}
  async function suppressCrmCompany(id){return crmRequest(`/companies/${encodeURIComponent(id)}/suppress`,{method:'POST'});}
  async function markCrmCustomer(id){return crmRequest(`/companies/${encodeURIComponent(id)}/mark-customer`,{method:'POST'});}
  async function saveCrmContacts(companyId,contacts){return crmRequest(`/companies/${encodeURIComponent(companyId)}/contacts`,{method:'POST',body:JSON.stringify({contacts:Array.isArray(contacts)?contacts:[]})});}
  async function enrichCrmContact(companyId,person,options={}){const selected=person&&typeof person==='object'?person:{};return crmRequest(`/companies/${encodeURIComponent(companyId)}/enrich-contact`,{method:'POST',body:JSON.stringify({person_id:String(selected.id||''),name:String(selected.name||''),title:String(selected.title||''),phone_lookup:Boolean(options.phoneLookup),allow_personal_email:Boolean(options.allowPersonalEmail)})});}
  async function recordCrmActivity(companyId,activity){return crmRequest(`/companies/${encodeURIComponent(companyId)}/activities`,{method:'POST',body:JSON.stringify(activity||{})});}
  async function deleteCrmCompany(id){return crmRequest(`/companies/${encodeURIComponent(id)}`,{method:'DELETE'});}
  function crmMigrationMap(){try{const value=JSON.parse(localStorage.getItem(CRM_MIGRATION_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
  function markCrmMigrated(workspaceId){const map=crmMigrationMap();map[String(workspaceId)]=new Date().toISOString();localStorage.setItem(CRM_MIGRATION_KEY,JSON.stringify(map));}
  async function migrateLocalPipeline(){if(!bridge.session?.authenticated||!bridge.workspace)return {ok:false,migrated:0};const workspaceId=bridge.workspace.id;if(crmMigrationMap()[workspaceId])return {ok:true,migrated:0,already:true};const local=parse(KEYS.discovery);const pipeline=Array.isArray(local.pipeline)?local.pipeline:[];if(!pipeline.length){markCrmMigrated(workspaceId);return {ok:true,migrated:0};}const mapper=root.LeadIntelCrm?.mapLocalPipelineItemToCrm;if(typeof mapper!=='function')return {ok:false,migrated:0,error:'CRM migration mapper unavailable'};let migrated=0;for(const item of pipeline){const result=await saveCrmCompany(mapper(item));if(!result.ok)return {ok:false,migrated,error:result.error||'CRM migration failed'};migrated++;}markCrmMigrated(workspaceId);root.dispatchEvent(new CustomEvent('leadintel:crm-migrated',{detail:{workspace_id:workspaceId,migrated}}));return {ok:true,migrated};}
  async function refreshGmailStatus(){if(!bridge.session?.authenticated||!bridge.workspace){bridge.gmail={configured:false,connected:false,email:'',role:''};return bridge.gmail;}const {response,payload}=await api(`/api/integrations/gmail/status?workspace_id=${encodeURIComponent(bridge.workspace.id)}`);bridge.gmail=response.ok?payload:{configured:false,connected:false,email:'',role:''};root.dispatchEvent(new CustomEvent('leadintel:gmail-status',{detail:bridge.gmail}));return bridge.gmail;}
  async function refreshMicrosoftMailStatus(){if(!bridge.session?.authenticated||!bridge.workspace){bridge.microsoftMail={configured:false,connected:false,email:'',role:''};return bridge.microsoftMail;}const {response,payload}=await api(`/api/integrations/microsoft-mail/status?workspace_id=${encodeURIComponent(bridge.workspace.id)}`);bridge.microsoftMail=response.ok?payload:{configured:false,connected:false,email:'',role:''};root.dispatchEvent(new CustomEvent('leadintel:microsoft-mail-status',{detail:bridge.microsoftMail}));return bridge.microsoftMail;}
  function connectGmail(){if(!bridge.workspace)return;location.href=endpoint(`/api/integrations/gmail/start?workspace_id=${encodeURIComponent(bridge.workspace.id)}&return_to=${encodeURIComponent(returnTo())}`);}
  function connectMicrosoftMail(){if(!bridge.workspace)return;location.href=endpoint(`/api/integrations/microsoft-mail/start?workspace_id=${encodeURIComponent(bridge.workspace.id)}&return_to=${encodeURIComponent(returnTo())}`);}
  async function disconnectGmail(){if(!bridge.workspace)return {ok:false};const {response,payload}=await api(`/api/integrations/gmail/disconnect?workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{method:'POST'});await refreshGmailStatus();return {ok:response.ok,...payload};}
  async function disconnectMicrosoftMail(){if(!bridge.workspace)return {ok:false};const {response,payload}=await api(`/api/integrations/microsoft-mail/disconnect?workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{method:'POST'});await refreshMicrosoftMailStatus();return {ok:response.ok,...payload};}
  function mailPayload({domain,recipient,subject,body,idempotencyKey,textBody,htmlBody}){const payload={idempotency_key:idempotencyKey,domain,recipient,subject,body};if(typeof textBody==='string')payload.text_body=textBody;if(typeof htmlBody==='string')payload.html_body=htmlBody;return payload;}
  async function sendGmail(input){if(!bridge.workspace)return {ok:false,error:'No workspace selected'};const {idempotencyKey}=input;const {response,payload}=await api(`/api/integrations/gmail/send?workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:JSON.stringify(mailPayload(input))});return {ok:response.ok,status:response.status,...payload};}
  async function sendMicrosoftMail(input){if(!bridge.workspace)return {ok:false,error:'No workspace selected'};const {idempotencyKey}=input;const {response,payload}=await api(`/api/integrations/microsoft-mail/send?workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:JSON.stringify(mailPayload(input))});return {ok:response.ok,status:response.status,...payload};}
  async function syncReplies(){if(!bridge.workspace)return {ok:false,replies:[]};const {response,payload}=await api(`/api/integrations/gmail/sync?workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{method:'POST'});return {ok:response.ok,status:response.status,replies:Array.isArray(payload.replies)?payload.replies:[],...payload};}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
