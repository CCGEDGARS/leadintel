// Top bar (CTO, 2026-10-25): CRM · save status · Workspace status · account menu.
// The server bridge keeps rendering its own account/sync elements; this module reads them (and the workspace
// attention trigger) and presents three controls instead of seven texts. The original buttons stay in the DOM
// and are what the menu items click, so every existing behaviour and test contract is untouched.
(function(root){
  'use strict';
  const doc=root.document;if(!doc)return;
  const text=el=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
  function statusFor(syncText,persistenceText){
    // The persistence layer knows about local edits before the bridge does; its label wins whenever it reports work pending.
    const p=String(persistenceText||'').toUpperCase();
    if(/CONFLICT|FAILED|TIMED OUT|KEPT IN THIS BROWSER/.test(p))return {label:'Needs attention',tone:'attention'};
    if(/UNSAVED|SYNC PENDING/.test(p))return {label:'Unsynced changes',tone:'busy'};
    if(/SAVING/.test(p))return {label:'Saving…',tone:'busy'};
    const t=String(syncText||'').toUpperCase();
    if(/SAVING/.test(t))return {label:'Saving…',tone:'busy'};
    if(/CONFLICT|ERROR|FAILED|OFFLINE|UNAVAILABLE/.test(t))return {label:'Needs attention',tone:'attention'};
    if(/UNSYNCED|NOT SAVED/.test(t))return {label:'Unsynced changes',tone:'busy'};
    if(/SYNCED|SAVED/.test(t))return {label:'Saved',tone:'ok'};
    return {label:'Local only',tone:'busy'};
  }
  // The Admin entry exists only for a platform administrator (CTO decision 2026-10-25): /api/session says so
  // (platform_admin) and every admin route re-checks the list server-side. Everyone else has no such element at all.
  function isPlatformAdmin(){return root.LeadIntelServerBridge?.session?.user?.platform_admin===true;}
  function syncAdminEntry(account){
    const panel=account.querySelector('.account-menu-panel');if(!panel)return;
    const existing=panel.querySelector('[data-topbar-action="admin"]');
    if(!isPlatformAdmin()){existing?.remove();return;}
    if(existing)return;
    const link=doc.createElement('a');link.setAttribute('role','menuitem');link.setAttribute('data-topbar-action','admin');link.href='/admin/';link.textContent='Admin';
    panel.querySelector('[data-topbar-action="settings"]')?.before(link);
  }
  function signedIn(){if(root.LeadIntelServerBridge?.session)return Boolean(root.LeadIntelServerBridge.session.authenticated);return Boolean(text(doc.getElementById('server-account-label')));}
  function update(){
    const status=doc.getElementById('topbar-status');
    if(status){
      const persistence=text(doc.querySelector('.top-actions>.autosave'))||text(doc.getElementById('workspace-save-state'));
      const state=statusFor(text(doc.getElementById('server-sync-status')),persistence);status.textContent=state.label;status.dataset.tone=state.tone;
      const save=doc.getElementById('topbar-save');
      if(save){save.hidden=!(state.label==='Unsynced changes'||state.label==='Needs attention');save.textContent=text(doc.getElementById('save-workspace'))||'Save now';}
    }
    const attention=doc.getElementById('workspace-attention');const ws=doc.getElementById('topbar-workspace-status');
    if(ws){const count=Number(text(attention?.querySelector('[data-attention-count]')))||0;const badge=ws.querySelector('[data-topbar-badge]');badge.textContent=String(count);badge.hidden=count===0;ws.hidden=!attention;ws.title=text(attention?.querySelector('[data-attention-summary]'))||'Workspace status';}
    const account=doc.getElementById('topbar-account');
    if(account){const name=text(doc.getElementById('server-account-label'))||'Account';const provider=text(doc.getElementById('server-auth-provider'));account.querySelector('[data-topbar-name]').textContent=name;account.querySelector('[data-topbar-initial]').textContent=name.slice(0,1).toUpperCase();account.querySelector('[data-topbar-provider]').textContent=provider;account.hidden=!signedIn();syncAdminEntry(account);}
  }
  function build(){
    const actions=doc.querySelector('.top-actions');if(!actions)return null;
    if(!actions.dataset.topbarBuilt){
      actions.dataset.topbarBuilt='1';
      const anchor=doc.getElementById('open-crm')||actions.firstElementChild;
      const status=doc.createElement('span');status.id='topbar-status';status.className='topbar-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      const save=doc.createElement('button');save.type='button';save.id='topbar-save';save.className='topbar-save';save.hidden=true;save.textContent='Save now';
      save.addEventListener('click',()=>doc.getElementById('save-workspace')?.click());
      const ws=doc.createElement('button');ws.type='button';ws.id='topbar-workspace-status';ws.className='topbar-ws';ws.setAttribute('aria-haspopup','dialog');ws.innerHTML='<span>Workspace status</span><span class="topbar-badge" data-topbar-badge hidden>0</span>';
      ws.addEventListener('click',()=>doc.getElementById('workspace-attention')?.click());
      const account=doc.createElement('div');account.id='topbar-account';account.className='account-menu';
      account.innerHTML='<button type="button" class="account-menu-btn" id="topbar-account-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="topbar-account-panel"><span class="account-avatar" data-topbar-initial aria-hidden="true"></span><span data-topbar-name></span><span class="account-chev" aria-hidden="true">▾</span></button><div class="account-menu-panel" id="topbar-account-panel" role="menu" hidden><div class="account-menu-head"><strong data-topbar-name></strong><small data-topbar-provider></small></div><button type="button" role="menuitem" data-topbar-action="settings">Settings</button><button type="button" role="menuitem" data-topbar-action="signout">Sign out</button><button type="button" role="menuitem" class="danger" data-topbar-action="reset">Reset workspace…</button></div>';
      const btn=account.querySelector('.account-menu-btn'),panel=account.querySelector('.account-menu-panel');
      const close=()=>{panel.hidden=true;btn.setAttribute('aria-expanded','false');};
      btn.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;btn.setAttribute('aria-expanded',String(open));});
      doc.addEventListener('click',event=>{if(!account.contains(event.target))close();});
      doc.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
      panel.addEventListener('click',event=>{const item=event.target.closest('[data-topbar-action]');if(!item)return;close();const target={settings:'open-settings',signout:'server-signout',reset:'reset-workspace'}[item.dataset.topbarAction];doc.getElementById(target)?.click();});
      if(anchor&&anchor.parentElement===actions)anchor.after(status,save,ws,account);else actions.append(status,save,ws,account);
      if(typeof root.MutationObserver==='function'){
        const observe=el=>{if(el)new root.MutationObserver(update).observe(el,{childList:true,characterData:true,subtree:true,attributes:true});};
        observe(doc.getElementById('server-account'));observe(doc.getElementById('workspace-attention'));observe(doc.querySelector('.top-actions>.autosave'));observe(doc.getElementById('save-workspace'));
      }
    }
    update();return actions;
  }
  root.LeadIntelTopbar={build,update,statusFor};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',build,{once:true});else build();
})(typeof window==='object'?window:globalThis);
