// Platform administration page (CTO decision, 2026-10-25). The two platform administrators invite customers,
// revoke invitations and see every account from here. The server decides who is an administrator
// (/api/session answers platform_admin and every /api/access/* route re-checks the list); this page only shows it.
// Nothing here uses native confirm/alert/prompt: the revoke question is an in-page <dialog>.
(function(root){
  'use strict';
  const api={session:'/api/session',invitations:'/api/access/invitations',users:'/api/access/users'};
  function decide(status,payload){
    if(Number(status)===401)return 'sign-in';
    if(Number(status)===200)return payload?.user?.platform_admin===true?'admin':'forbidden';
    return 'outage';
  }
  function shortDate(value){const text=String(value||'').trim();return text?text.slice(0,16):'';}
  function providerLabel(list){
    const names={google:'Google',microsoft:'Microsoft'};
    const out=(Array.isArray(list)?list:[]).map(item=>names[item]||String(item||'')).filter(Boolean);
    return out.length?out.join(' · '):'—';
  }
  const admin={decide,shortDate,providerLabel,ready:Promise.resolve(),last:Promise.resolve(),navigate:url=>root.location.replace(url)};
  root.LeadIntelAdmin=admin;
  const doc=root.document;
  if(!doc||typeof root.fetch!=='function'||admin.disabled)return;

  const el=id=>doc.getElementById(id);
  const node=(tag,content,className)=>{const out=doc.createElement(tag);if(className)out.className=className;out.textContent=content==null?'':String(content);return out;};
  const request=(url,options={})=>root.fetch(url,{credentials:'include',cache:'no-store',...options});
  async function readJson(response){try{return await response.json();}catch{return null;}}
  function status(message){const out=el('invite-status');if(out)out.textContent=message||'';}
  function invitationStatus(row){
    if(row.revoked_at)return 'Revoked '+shortDate(row.revoked_at);
    if(row.accepted_at)return 'Accepted '+shortDate(row.accepted_at);
    return 'Invited';
  }
  function renderInvitations(list){
    const body=doc.querySelector('#invitations-table tbody');if(!body)return;
    body.replaceChildren();
    for(const row of list){
      const tr=doc.createElement('tr');
      tr.append(node('td',row.email),node('td',row.note||''),node('td',row.invited_by||''),node('td',shortDate(row.created_at)),node('td',invitationStatus(row)));
      const actions=node('td','','actions');
      if(!row.revoked_at){const button=node('button','Revoke','admin-link-btn');button.type='button';button.dataset.revoke=row.email;actions.append(button);}
      tr.append(actions);body.append(tr);
    }
    const empty=el('invitations-empty');if(empty)empty.hidden=list.length>0;
  }
  function renderUsers(list){
    const body=doc.querySelector('#users-table tbody');if(!body)return;
    body.replaceChildren();
    for(const row of list){
      const tr=doc.createElement('tr');
      const account=doc.createElement('td');account.append(node('strong',row.email),' ',node('span',row.display_name||'','muted'));
      const role=doc.createElement('td');if(row.platform_admin===true)role.append(node('span','Admin','badge'));
      tr.append(account,node('td',providerLabel(row.providers)),node('td',String(row.workspaces??0)),node('td',row.last_login_at?shortDate(row.last_login_at):'Never'),node('td',shortDate(row.created_at)),role);
      body.append(tr);
    }
  }
  async function refresh(){
    const [invitations,users]=await Promise.all([request(api.invitations),request(api.users)]);
    const a=await readJson(invitations),b=await readJson(users);
    if(invitations.status===200)renderInvitations(Array.isArray(a?.invitations)?a.invitations:[]);
    if(users.status===200)renderUsers(Array.isArray(b?.users)?b.users:[]);
    if(invitations.status!==200||users.status!==200)status('The lists could not be loaded just now. Reload to try again.');
  }
  admin.refresh=refresh;

  const dialog=el('revoke-dialog');let pendingEmail='';
  function openDialog(email){
    pendingEmail=email;const label=el('revoke-email');if(label)label.textContent=email;
    if(!dialog)return;if(typeof dialog.showModal==='function'){if(!dialog.open)dialog.showModal();}else dialog.setAttribute('open','');
  }
  function closeDialog(){
    pendingEmail='';if(!dialog)return;
    if(typeof dialog.close==='function'){if(dialog.open)dialog.close();}else dialog.removeAttribute('open');
  }
  dialog?.addEventListener('close',()=>{pendingEmail='';});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog?.open)closeDialog();});
  el('revoke-cancel')?.addEventListener('click',()=>{closeDialog();admin.last=Promise.resolve();});
  el('revoke-confirm')?.addEventListener('click',()=>{
    const email=pendingEmail;closeDialog();if(!email)return;
    admin.last=(async()=>{
      const response=await request(api.invitations+'?email='+encodeURIComponent(email),{method:'DELETE'});
      const payload=await readJson(response);
      status(response.status===200?'Invitation for '+email+' revoked.':(payload?.error||'The invitation could not be revoked just now.'));
      await refresh();
    })();
  });
  el('invitations-table')?.addEventListener('click',event=>{const button=event.target.closest('button[data-revoke]');if(button)openDialog(button.dataset.revoke);});
  el('invite-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    const emailInput=el('invite-email'),noteInput=el('invite-note');
    const email=String(emailInput?.value||'').trim(),note=String(noteInput?.value||'').trim();
    admin.last=(async()=>{
      const response=await request(api.invitations,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,note})});
      const payload=await readJson(response);
      if(response.status===201){
        status((payload?.invitation?.email||email.toLowerCase())+' is invited. They can sign in with Google or Microsoft now.');
        if(emailInput)emailInput.value='';if(noteInput)noteInput.value='';
        await refresh();
      }else status(payload?.error||'The invitation could not be saved just now.');
    })();
  });

  // The top bar is the workspace top bar: the same account menu (ids and classes from topbar.js), fed by /api/session.
  const PROVIDERS={google:'Google',microsoft:'Microsoft'};
  function renderTopbar(user){
    const account=el('topbar-account');if(!account)return;
    const name=String(user?.name||user?.email||'Account');const provider=(Array.isArray(user?.providers)?user.providers:[])[0];
    for(const slot of account.querySelectorAll('[data-topbar-name]'))slot.textContent=name;
    const initial=account.querySelector('[data-topbar-initial]');if(initial)initial.textContent=name.slice(0,1).toUpperCase();
    const label=account.querySelector('[data-topbar-provider]');if(label)label.textContent=(provider?PROVIDERS[provider]||provider:'Signed in')+' · '+String(user?.email||'');
    account.hidden=false;
  }
  (function wireTopbar(){
    const account=el('topbar-account'),btn=el('topbar-account-btn'),panel=el('topbar-account-panel');if(!account||!btn||!panel)return;
    const close=()=>{panel.hidden=true;btn.setAttribute('aria-expanded','false');};
    btn.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;btn.setAttribute('aria-expanded',String(open));});
    doc.addEventListener('click',event=>{if(!account.contains(event.target))close();});
    doc.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    panel.addEventListener('click',event=>{
      const item=event.target.closest('[data-admin-action]');if(!item)return;close();
      if(item.dataset.adminAction==='signout'){
        event.preventDefault();
        admin.last=(async()=>{try{await request('/api/logout',{method:'POST'});}catch{}admin.navigate('/?access=signed-out');})();
      }
    });
  })();

  admin.ready=(async()=>{
    let response=null,payload=null;
    try{response=await request(api.session);payload=await readJson(response);}catch{response=null;}
    const verdict=decide(response?response.status:0,payload);
    const gate=el('admin-gate'),app=el('admin-app');
    if(verdict==='sign-in'){admin.navigate('/');return;}
    if(verdict==='forbidden'){renderTopbar(payload.user);if(gate)gate.textContent='Only platform administrators can open this page.';return;}
    if(verdict==='outage'){if(gate)gate.textContent='We couldn’t check your access just now. Reload to try again.';return;}
    renderTopbar(payload.user);
    if(gate)gate.hidden=true;if(app)app.hidden=false;
    await refresh();
  })();
})(typeof window==='object'?window:globalThis);
