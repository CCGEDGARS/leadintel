import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// /admin/ (CTO decision 2026-10-25): the two platform administrators invite customers, revoke invitations and see
// every account from one light page. The server enforces the admin list; the page only shows it. Nobody else sees it.
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const read=(...parts)=>fs.readFileSync(path.join(root,...parts),'utf8');
const escaped=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

test('the admin page ships with the static artifact, has a slash redirect, triggers CI and is proven by release integrity',()=>{
  const build=read('scripts','build-vercel-static.sh');
  assert.match(build,/mkdir -p \.vercel-static\/v2 \.vercel-static\/customer \.vercel-static\/demo \.vercel-static\/admin/);
  assert.match(build,/cp -R admin\/\. \.vercel-static\/admin\//);
  const live=JSON.parse(read('customer','vercel.json'));
  const redirect=(live.redirects||[]).find(rule=>rule.source==='/admin');
  assert.ok(redirect,'the live config must redirect /admin to /admin/ so admin.js resolves relatively');assert.equal(redirect.destination,'/admin/');
  assert.match(read('.github','workflows','customer-ci.yml'),/- 'admin\/\*\*'/);
  const config=JSON.parse(read('release-integrity.config.json'));
  const smoke=id=>config.smokeChecks.find(item=>item.id===id);
  const page=smoke('admin-page');assert.ok(page);assert.equal(page.url,'/admin/');assert.equal(page.status,200);
  const html=read('admin','index.html');for(const marker of page.contains)assert.match(html,new RegExp(escaped(marker)),marker);
  const script=smoke('admin-page-script');assert.ok(script);assert.equal(script.url,'/admin/admin.js');
  const source=read('admin','admin.js');for(const marker of script.contains)assert.match(source,new RegExp(escaped(marker)),marker);
  const entry=smoke('topbar-admin-entry');assert.ok(entry);assert.equal(entry.url,'/customer/topbar.js');
  const topbar=read('customer','topbar.js');for(const marker of entry.contains)assert.match(topbar,new RegExp(escaped(marker)),marker);
  const token=smoke('workspace-topbar-admin-token');assert.ok(token);assert.equal(token.url,'/customer/');
  const workspace=read('customer','index.html');for(const marker of token.contains)assert.match(workspace,new RegExp(escaped(marker)),marker);
});

test('the page is private, loads its own module with a version token, uses a <dialog> and never a native popup',()=>{
  const html=read('admin','index.html');
  assert.match(html,/<title>Admin · LeadIntel<\/title>/);
  assert.match(html,/<meta name="robots" content="noindex">/);
  assert.match(html,/<script defer src="admin\.js\?v=\d{8}-v\d+"><\/script>/);
  assert.match(html,/<dialog id="revoke-dialog"/);
  assert.match(html,/href="\/customer\/"/);
  // v2 (CTO, 2026-10-25 evening): full width, and the top bar IS the workspace top bar — same stylesheets with the same
  // cache tokens as customer/index.html (so a token bump there must be mirrored here), same markup, same account menu.
  const workspace=read('customer','index.html');
  for(const sheet of ['styles.css','app-shell.css']){
    const token=workspace.match(new RegExp('href="('+sheet.replace('.','\\.')+'\\?v=[^"]+)"'))[1];
    assert.ok(html.includes(`href="../customer/${token}"`),`admin page must load ../customer/${token}`);
  }
  assert.match(html,/<div class="page-shell">\s*<header class="topbar">\s*<a class="brand" href="\.\.\/" aria-label="LeadIntel home">/);
  assert.match(html,/<span class="brand-mark" aria-hidden="true"><i><\/i><i><\/i><i><\/i><\/span>/);
  assert.match(html,/<div class="top-actions">/);
  assert.match(html,/<main class="content[^"]*"/);
  assert.doesNotMatch(html,/width:min\(1040px/);
  assert.doesNotMatch(html,/<main>\s*<header class="head">/);
  for(const id of ['admin-gate','admin-app','topbar-account','topbar-account-btn','topbar-account-panel','invite-form','invite-email','invite-note','invite-status','invitations-table','users-table','revoke-email','revoke-confirm','revoke-cancel'])assert.match(html,new RegExp(`id="${id}"`),id);
  const source=read('admin','admin.js');
  for(const forbidden of [/\bconfirm\(/,/\balert\(/,/\bprompt\(/,/innerHTML\s*=\s*[^'"`]/])assert.doesNotMatch(source,forbidden);
});

test('gate decision: 401 sends to sign-in, a non-admin session is forbidden, an admin opens the page, outages stay',()=>{
  const win={};new Function('window',read('admin','admin.js'))(win);
  const {decide,shortDate,providerLabel}=win.LeadIntelAdmin;
  assert.equal(decide(401,{authenticated:false}),'sign-in');
  assert.equal(decide(200,{authenticated:true,user:{platform_admin:false}}),'forbidden');
  assert.equal(decide(200,{authenticated:true,user:{}}),'forbidden');
  assert.equal(decide(200,{authenticated:true,user:{platform_admin:true}}),'admin');
  assert.equal(decide(503,null),'outage');assert.equal(decide(0,null),'outage');
  assert.equal(shortDate('2026-10-25 17:57:12'),'2026-10-25 17:57');assert.equal(shortDate(null),'');
  assert.equal(providerLabel(['google','microsoft']),'Google · Microsoft');assert.equal(providerLabel([]),'—');
});

const PAGE=()=>read('admin','index.html');
function jsonResponse(status,payload){return {status,ok:status>=200&&status<300,async json(){return payload;}};}
async function mount({session,invitations=[],users=[]}){
  const {JSDOM}=await import('jsdom');
  const dom=new JSDOM(PAGE(),{url:'https://example.test/admin/'});
  const win=dom.window;const calls=[];const replaced=[];
  const state={invitations:[...invitations],users:[...users]};
  win.fetch=async(url,options={})=>{
    const method=options.method||'GET';calls.push({url:String(url),method,body:options.body?JSON.parse(options.body):null,credentials:options.credentials});
    if(url==='/api/session')return jsonResponse(session.status,session.payload);
    if(url==='/api/logout'&&method==='POST')return jsonResponse(200,{ok:true});
    if(url==='/api/access/invitations'&&method==='GET')return jsonResponse(200,{invitations:state.invitations,admins:['cto@example.lv']});
    if(url==='/api/access/users'&&method==='GET')return jsonResponse(200,{users:state.users,admins:['cto@example.lv']});
    if(url==='/api/access/invitations'&&method==='POST'){const body=JSON.parse(options.body);if(!/@/.test(body.email))return jsonResponse(400,{error:'Enter one valid e-mail address to invite'});state.invitations.unshift({email:body.email.toLowerCase(),note:body.note,invited_by:'cto@example.lv',created_at:'2026-10-26 09:00:00',accepted_at:null,revoked_at:null});return jsonResponse(201,{invitation:state.invitations[0]});}
    if(String(url).startsWith('/api/access/invitations?email=')&&method==='DELETE'){const email=decodeURIComponent(String(url).split('email=')[1]);const row=state.invitations.find(r=>r.email===email);if(row)row.revoked_at='2026-10-26 09:05:00';return jsonResponse(200,{ok:true,email});}
    return jsonResponse(404,{error:'unknown '+url});
  };
  new Function('window',read('admin','admin.js'))(win);
  win.LeadIntelAdmin.navigate=url=>replaced.push(url); // the gate decides after its first await, so the hook is in place in time
  await win.LeadIntelAdmin.ready;
  return {win,doc:win.document,calls,replaced,state};
}
const ADMIN={status:200,payload:{authenticated:true,user:{id:'u0',email:'cto@example.lv',name:'CTO',providers:['google'],platform_admin:true}}};
const INVITATIONS=[
  {email:'guest@example.com',note:'pilot',invited_by:'cto@example.lv',created_at:'2026-10-25 08:00:00',accepted_at:'2026-10-25 08:18:00',revoked_at:null},
  {email:'new@example.com',note:'',invited_by:'cto@example.lv',created_at:'2026-10-26 07:00:00',accepted_at:null,revoked_at:null},
  {email:'old@example.com',note:'left',invited_by:'cto@example.lv',created_at:'2026-10-20 07:00:00',accepted_at:null,revoked_at:'2026-10-24 07:00:00'}
];
const USERS=[
  {id:'u0',email:'cto@example.lv',display_name:'CTO',role:'owner',created_at:'2026-07-20 10:00:00',last_login_at:'2026-10-25 17:57:00',providers:['google'],workspaces:2,invited_by:null,invitation_note:null,platform_admin:true},
  {id:'u1',email:'guest@example.com',display_name:'Guest Person',role:'owner',created_at:'2026-10-25 08:18:00',last_login_at:null,providers:['google','microsoft'],workspaces:1,invited_by:'cto@example.lv',invitation_note:'pilot',platform_admin:false}
];

test('an administrator sees who they are, every invitation with its status and every account with providers, workspaces and the admin mark',async()=>{
  const {doc,calls}=await mount({session:ADMIN,invitations:INVITATIONS,users:USERS});
  assert.equal(doc.getElementById('admin-app').hidden,false);assert.equal(doc.getElementById('admin-gate').hidden,true);
  assert.equal(doc.querySelector('#topbar-account .account-menu-head small').textContent,'Google · cto@example.lv');
  assert.ok(calls.every(call=>call.credentials==='include'),'every request carries the session cookie');
  const rows=[...doc.querySelectorAll('#invitations-table tbody tr')];
  assert.equal(rows.length,3);
  const cells=row=>[...row.querySelectorAll('td')].map(td=>td.textContent.trim());
  assert.deepEqual(cells(rows[0]).slice(0,5),['guest@example.com','pilot','cto@example.lv','2026-10-25 08:00','Accepted 2026-10-25 08:18']);
  assert.equal(cells(rows[1])[4],'Invited');
  assert.equal(cells(rows[2])[4],'Revoked 2026-10-24 07:00');
  assert.ok(rows[0].querySelector('button[data-revoke="guest@example.com"]'),'active invitations can be revoked');
  assert.ok(rows[1].querySelector('button[data-revoke="new@example.com"]'));
  assert.equal(rows[2].querySelector('button[data-revoke]'),null,'a revoked invitation has no revoke action');
  const users=[...doc.querySelectorAll('#users-table tbody tr')];
  assert.equal(users.length,2);
  assert.deepEqual(cells(users[0]),['cto@example.lv CTO','Google','2','2026-10-25 17:57','2026-07-20 10:00','Admin']);
  assert.deepEqual(cells(users[1]),['guest@example.com Guest Person','Google · Microsoft','1','Never','2026-10-25 08:18','']);
});

test('inviting a customer posts the address and note, confirms in words and refreshes the list; a server refusal is shown verbatim',async()=>{
  const {win,doc,calls}=await mount({session:ADMIN,invitations:INVITATIONS,users:USERS});
  doc.getElementById('invite-email').value=' New.Customer@Example.com ';doc.getElementById('invite-note').value='Ercon pilot';
  doc.getElementById('invite-form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  await win.LeadIntelAdmin.last;
  const post=calls.find(call=>call.method==='POST');
  assert.deepEqual(post.body,{email:'New.Customer@Example.com',note:'Ercon pilot'});
  assert.equal(doc.getElementById('invite-status').textContent,'new.customer@example.com is invited. They can sign in with Google or Microsoft now.');
  assert.equal(doc.querySelectorAll('#invitations-table tbody tr').length,4);
  assert.equal(doc.getElementById('invite-email').value,'');
  doc.getElementById('invite-email').value='nope';doc.getElementById('invite-form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  await win.LeadIntelAdmin.last;
  assert.equal(doc.getElementById('invite-status').textContent,'Enter one valid e-mail address to invite');
});

test('revoking asks in a dialog first; Cancel or Escape changes nothing, Revoke deletes exactly that address and refreshes',async()=>{
  const {win,doc,calls}=await mount({session:ADMIN,invitations:INVITATIONS,users:USERS});
  const dialog=doc.getElementById('revoke-dialog');
  doc.querySelector('button[data-revoke="new@example.com"]').click();
  assert.equal(dialog.open,true);assert.equal(doc.getElementById('revoke-email').textContent,'new@example.com');
  doc.getElementById('revoke-cancel').click();await win.LeadIntelAdmin.last;
  assert.equal(dialog.open,false);assert.equal(calls.filter(call=>call.method==='DELETE').length,0);
  doc.querySelector('button[data-revoke="new@example.com"]').click();
  doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(dialog.open,false);assert.equal(calls.filter(call=>call.method==='DELETE').length,0);
  doc.querySelector('button[data-revoke="new@example.com"]').click();doc.getElementById('revoke-confirm').click();await win.LeadIntelAdmin.last;
  const del=calls.filter(call=>call.method==='DELETE');
  assert.deepEqual(del.map(call=>call.url),['/api/access/invitations?email=new%40example.com']);
  assert.equal(dialog.open,false);
  const row=[...doc.querySelectorAll('#invitations-table tbody tr')].find(tr=>tr.textContent.includes('new@example.com'));
  assert.match(row.textContent,/Revoked 2026-10-26 09:05/);assert.equal(row.querySelector('button[data-revoke]'),null);
});

test('a signed-in non-administrator is told so and gets no form or tables; an anonymous visitor goes to the sign-in page',async()=>{
  const member=await mount({session:{status:200,payload:{authenticated:true,user:{id:'u1',email:'guest@example.com',platform_admin:false}}}});
  assert.equal(member.doc.getElementById('admin-app').hidden,true);
  assert.equal(member.doc.getElementById('admin-gate').textContent,'Only platform administrators can open this page.');
  assert.equal(member.calls.length,1,'no admin data is requested for a non-administrator');
  const anonymous=await mount({session:{status:401,payload:{authenticated:false}}});
  assert.deepEqual(anonymous.replaced,['/']);
  const outage=await mount({session:{status:503,payload:null}});
  assert.equal(outage.doc.getElementById('admin-gate').textContent,'We couldn’t check your access just now. Reload to try again.');
  assert.deepEqual(outage.replaced,[]);
});

test('the top bar is the workspace account menu: avatar initial and name, provider · e-mail, Workspace link, Sign out that logs out and leaves for the sign-in page',async()=>{
  const {win,doc,calls,replaced}=await mount({session:ADMIN,invitations:INVITATIONS,users:USERS});
  const account=doc.getElementById('topbar-account');
  assert.ok(account,'the account menu exists with the workspace id');assert.equal(account.hidden,false);
  assert.equal(account.querySelector('.account-menu-btn [data-topbar-initial]').textContent,'C');
  assert.equal(account.querySelector('.account-menu-btn [data-topbar-name]').textContent,'CTO');
  assert.equal(account.querySelector('.account-menu-head strong').textContent,'CTO');
  assert.equal(account.querySelector('.account-menu-head small').textContent,'Google · cto@example.lv');
  const btn=doc.getElementById('topbar-account-btn'),panel=doc.getElementById('topbar-account-panel');
  assert.equal(panel.hidden,true);btn.click();assert.equal(panel.hidden,false);assert.equal(btn.getAttribute('aria-expanded'),'true');
  const items=[...panel.querySelectorAll('[data-admin-action]')].map(e=>e.tagName+':'+e.dataset.adminAction+':'+e.textContent.trim());
  assert.deepEqual(items,['A:workspace:Workspace','BUTTON:signout:Sign out']);
  assert.equal(panel.querySelector('[data-admin-action="workspace"]').getAttribute('href'),'/customer/');
  doc.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(panel.hidden,true);
  btn.click();panel.querySelector('[data-admin-action="signout"]').click();await win.LeadIntelAdmin.last;
  assert.deepEqual(calls.filter(c=>c.url==='/api/logout').map(c=>c.method),['POST']);
  assert.deepEqual(replaced,['/?access=signed-out']);
  assert.equal(doc.querySelector('.top-actions a.ghost-btn[href="/customer/"]').textContent.trim(),'Back to workspace');
});

test('a non-administrator still sees who they are in the top bar but no admin content',async()=>{
  const member=await mount({session:{status:200,payload:{authenticated:true,user:{id:'u1',email:'guest@example.com',name:'Guest Person',providers:['microsoft'],platform_admin:false}}}});
  assert.equal(member.doc.getElementById('admin-app').hidden,true);
  assert.equal(member.doc.querySelector('#topbar-account .account-menu-head small').textContent,'Microsoft · guest@example.com');
});
