import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeInviteEmail,validInviteEmail,platformAdminEmails,isPlatformAdmin,findInvitation,admitInvitedUser,inviteRequiredUrl,handleAccessRoute} from '../src/access-invitations.js';
import {sha256} from '../src/security.js';

// Minimal D1 stand-in: routes by SQL prefix, records writes, no SQL engine.
function fakeDb({invitations={},users={},session=null}={}){
  const writes=[];
  const stmt=(sql)=>({bind:(...args)=>({
    async first(){
      if(sql.startsWith('SELECT email,invited_by'))return invitations[args[0]]&&!invitations[args[0]].revoked_at?invitations[args[0]]:null;
      if(sql.startsWith('SELECT users.id'))return session&&session.tokenHash===args[0]?session.user:null;
      return null;
    },
    async run(){writes.push({sql,args});if(sql.startsWith('UPDATE access_invitations SET revoked_at')){const row=invitations[args[0]];const changes=row&&!row.revoked_at?1:0;if(changes)row.revoked_at='now';return {meta:{changes}};}if(sql.startsWith('INSERT INTO access_invitations')){invitations[args[0]]={email:args[0],invited_by:args[1],note:args[2],revoked_at:null};}return {meta:{changes:1}};},
    async all(){return {results:Object.values(invitations)};}
  }),
  async all(){return {results:Object.values(invitations)};}});
  return {DB:{prepare:stmt,async batch(statements){for(const s of statements)await s.run();}},writes,invitations};
}
const env=(db,extra={})=>({...db,CUSTOMER_APP_URL:'https://leadintel.ccgroup.lv/customer/',PLATFORM_ADMIN_EMAILS:'cto@example.lv, Owner@Example.com',...extra});

test('e-mail normalisation and admin list are case- and whitespace-insensitive',()=>{
  assert.equal(normalizeInviteEmail('  New.Person@Example.COM '),'new.person@example.com');
  assert.ok(validInviteEmail('a@b.lv'));assert.ok(!validInviteEmail('not an address'));assert.ok(!validInviteEmail(''));
  assert.deepEqual(platformAdminEmails({PLATFORM_ADMIN_EMAILS:'cto@example.lv, Owner@Example.com',ADMIN_EMAIL:'root@example.com'}),['cto@example.lv','owner@example.com','root@example.com']);
  assert.ok(isPlatformAdmin({PLATFORM_ADMIN_EMAILS:'cto@example.lv'},{email:'CTO@example.lv'}));
  assert.ok(!isPlatformAdmin({PLATFORM_ADMIN_EMAILS:'cto@example.lv'},{email:'stranger@example.lv'}));
});

test('a new identity without an invitation is not admitted and nothing is written',async()=>{
  const db=fakeDb();
  assert.equal(await admitInvitedUser(env(db),{email:'Stranger@Example.com',name:'Stranger'}),null);
  assert.equal(db.writes.length,0);
  assert.equal(inviteRequiredUrl(env(db)),'https://leadintel.ccgroup.lv/?access=invite-required');
});

test('an invited identity is admitted once: user created, invitation stamped, revoked invitation refused',async()=>{
  const db=fakeDb({invitations:{'guest@example.com':{email:'guest@example.com',revoked_at:null}}});
  const user=await admitInvitedUser(env(db),{email:'Guest@Example.com',name:'Guest Person'});
  assert.equal(user.email,'guest@example.com');assert.equal(user.role,'owner');assert.equal(user.display_name,'Guest Person');
  assert.ok(db.writes.some(w=>w.sql.startsWith('INSERT INTO users')&&w.args[1]==='guest@example.com'));
  assert.ok(db.writes.some(w=>w.sql.startsWith('UPDATE access_invitations SET accepted_at')&&w.args[1]==='guest@example.com'));
  db.invitations['guest@example.com'].revoked_at='2026-10-25';
  assert.equal(await findInvitation(env(db),'guest@example.com'),null);
});

test('invitation routes: anonymous 401, member 403, admin can list, create, re-activate and revoke',async()=>{
  const token='session-token',tokenHash=await sha256(token);const cookie={Cookie:`leadintel_session=${token}`};
  const member=fakeDb({session:{tokenHash,user:{id:'u1',email:'member@example.com'}}});
  assert.equal((await handleAccessRoute(new Request('https://api/api/access/invitations'),env(member),{})).status,401);
  assert.equal((await handleAccessRoute(new Request('https://api/api/access/invitations',{headers:cookie}),env(member),{})).status,403);
  const admin=fakeDb({session:{tokenHash,user:{id:'u0',email:'cto@example.lv'}}});
  const created=await handleAccessRoute(new Request('https://api/api/access/invitations',{method:'POST',headers:{...cookie,'Content-Type':'application/json'},body:JSON.stringify({email:' Guest@Example.com ',note:'pilot'})}),env(admin),{});
  assert.equal(created.status,201);assert.equal((await created.json()).invitation.email,'guest@example.com');
  assert.equal((await handleAccessRoute(new Request('https://api/api/access/invitations',{method:'POST',headers:{...cookie,'Content-Type':'application/json'},body:JSON.stringify({email:'nope'})}),env(admin),{})).status,400);
  const listed=await handleAccessRoute(new Request('https://api/api/access/invitations',{headers:cookie}),env(admin),{});
  assert.equal(listed.status,200);assert.equal((await listed.json()).invitations.length,1);
  assert.equal((await handleAccessRoute(new Request('https://api/api/access/invitations?email=guest@example.com',{method:'DELETE',headers:cookie}),env(admin),{})).status,200);
  assert.equal((await handleAccessRoute(new Request('https://api/api/access/invitations?email=guest@example.com',{method:'DELETE',headers:cookie}),env(admin),{})).status,404);
  assert.equal(await findInvitation(env(admin),'guest@example.com'),null);
  assert.equal(await handleAccessRoute(new Request('https://api/api/other'),env(admin),{}),null);
});
