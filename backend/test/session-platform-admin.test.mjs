import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {sha256} from '../src/security.js';

// /api/session tells the client whether the signed-in account is a platform administrator, so the account menu
// can show the Admin entry to exactly the configured accounts (CTO decision 2026-10-25). The server keeps enforcing it.
function envFor({user,tokenHash}){
  const stmt=(sql)=>({bind:(...args)=>({
    async first(){if(sql.startsWith('SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at'))return tokenHash===args[0]?user:null;return null;},
    async all(){if(sql.startsWith('SELECT provider FROM user_identities'))return {results:[{provider:'google'}]};return {results:[]};},
    async run(){return {meta:{changes:0}};}
  })});
  return {APP_ORIGIN:'https://example.test',PLATFORM_ADMIN_EMAILS:'cto@example.lv,Owner@Example.com',DB:{prepare:stmt,async batch(){}}};
}
async function session(email){
  const token='session-token',tokenHash=await sha256(token);
  const env=envFor({tokenHash,user:{id:'u-'+email,email,display_name:'Person',role:'owner',expires_at:'2099-01-01'}});
  const response=await app.fetch(new Request('https://example.test/api/session',{headers:{Cookie:`leadintel_session=${token}`}}),env,{});
  assert.equal(response.status,200);return response.json();
}
test('the session answer carries platform_admin: true only for a configured administrator, false for everyone else',async()=>{
  const admin=await session('CTO@example.lv');
  assert.equal(admin.authenticated,true);assert.equal(admin.user.platform_admin,true);assert.deepEqual(admin.user.providers,['google']);
  const member=await session('member@example.com');
  assert.equal(member.authenticated,true);assert.equal(member.user.platform_admin,false);
});
test('an anonymous session check stays 401 and names no administrators',async()=>{
  const response=await app.fetch(new Request('https://example.test/api/session'),envFor({tokenHash:'none',user:null}),{});
  assert.equal(response.status,401);assert.deepEqual(await response.json(),{authenticated:false});
});
