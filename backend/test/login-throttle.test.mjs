import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {D1Fixture} from './writing-reference-fixture.mjs';
import {loginThrottleKey,checkLoginThrottle,recordLoginFailure,clearLoginThrottle,LOGIN_MAX_FAILURES,LOGIN_WINDOW_MS,LOGIN_LOCK_MS} from '../src/login-throttle.js';
function env(){const DB=new D1Fixture();DB.raw.exec(fs.readFileSync(new URL('../migrations/0040_login_attempts.sql',import.meta.url),'utf8'));return {DB};}
const req=(ip='203.0.113.5')=>new Request('https://api.test/api/login',{method:'POST',headers:{'CF-Connecting-IP':ip}});
test('throttle key separates clients and emails and ignores case and spacing',async()=>{
  const a=await loginThrottleKey(req(),'Owner@Example.com'),b=await loginThrottleKey(req(),' owner@example.com '),c=await loginThrottleKey(req('203.0.113.6'),'owner@example.com');
  assert.equal(a,b);assert.notEqual(a,c);
});
test('attempts stay allowed below the limit and are refused with a retry delay once the limit is reached',async()=>{
  const e=env();const key=await loginThrottleKey(req(),'owner@example.com');const now=Date.parse('2026-10-19T12:00:00Z');
  for(let i=1;i<LOGIN_MAX_FAILURES;i++){await recordLoginFailure(e,key,{now:now+i*1000});assert.equal((await checkLoginThrottle(e,key,{now:now+i*1000})).allowed,true,`attempt ${i}`);}
  const last=await recordLoginFailure(e,key,{now:now+LOGIN_MAX_FAILURES*1000});assert.equal(last.locked,true);
  const refused=await checkLoginThrottle(e,key,{now:now+LOGIN_MAX_FAILURES*1000+1});assert.equal(refused.allowed,false);assert.ok(refused.retryAfterSeconds>0&&refused.retryAfterSeconds<=LOGIN_LOCK_MS/1000);
  const later=await checkLoginThrottle(e,key,{now:now+LOGIN_MAX_FAILURES*1000+LOGIN_LOCK_MS+1});assert.equal(later.allowed,true,'lock expires');
});
test('failures outside the window start a fresh count and a successful sign-in clears the record',async()=>{
  const e=env();const key=await loginThrottleKey(req(),'owner@example.com');const now=Date.parse('2026-10-19T12:00:00Z');
  for(let i=1;i<=5;i++)await recordLoginFailure(e,key,{now:now+i*1000});
  const fresh=await recordLoginFailure(e,key,{now:now+LOGIN_WINDOW_MS+10000});assert.equal(fresh.failures,1);
  await clearLoginThrottle(e,key);assert.equal(await e.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts').first().then(r=>r.n),0);
});
test('storage problems fail open instead of locking the owner out',async()=>{
  const broken={DB:{prepare(){throw new Error('D1 unavailable');}}};const key=await loginThrottleKey(req(),'owner@example.com');
  assert.equal((await checkLoginThrottle(broken,key)).allowed,true);assert.deepEqual(await recordLoginFailure(broken,key),{failures:0,locked:false});await clearLoginThrottle(broken,key);
});
test('the owner login route checks the throttle before comparing credentials and records the outcome',()=>{
  const source=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  const login=source.slice(source.indexOf('/api/login'),source.indexOf('/api/session'));
  assert.ok(login.indexOf('checkLoginThrottle(')<login.indexOf('constantTimeEqual('),'throttle check precedes the credential compare');
  assert.match(login,/429/);assert.match(login,/Retry-After/);assert.match(login,/recordLoginFailure\(env,throttleKey\)/);assert.match(login,/clearLoginThrottle\(env,throttleKey\)/);
});
