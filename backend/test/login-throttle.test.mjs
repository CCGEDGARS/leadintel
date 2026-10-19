import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {D1Fixture} from './writing-reference-fixture.mjs';
import {loginThrottleKey,reserveLoginAttempt,clearLoginThrottle,LOGIN_MAX_FAILURES,LOGIN_WINDOW_MS,LOGIN_LOCK_MS} from '../src/login-throttle.js';
function env(){const DB=new D1Fixture();DB.raw.exec(fs.readFileSync(new URL('../migrations/0040_login_attempts.sql',import.meta.url),'utf8'));return {DB};}
const req=(ip='203.0.113.5')=>new Request('https://api.test/api/login',{method:'POST',headers:{'CF-Connecting-IP':ip}});
test('throttle key separates clients and e-mails and ignores case and spacing',async()=>{
  const a=await loginThrottleKey(req(),'Owner@Example.com'),b=await loginThrottleKey(req(),' owner@example.com '),c=await loginThrottleKey(req('203.0.113.6'),'owner@example.com');
  assert.equal(a,b);assert.notEqual(a,c);
});
test('the limit admits exactly LOGIN_MAX_FAILURES attempts, refuses the next with a retry delay, and reopens after the lock',async()=>{
  const e=env();const key=await loginThrottleKey(req(),'owner@example.com');const now=Date.parse('2026-10-19T12:00:00Z');
  for(let i=1;i<=LOGIN_MAX_FAILURES;i++){const r=await reserveLoginAttempt(e,key,{now:now+i*1000});assert.equal(r.allowed,true,`attempt ${i}`);assert.equal(r.failures,i);}
  const refused=await reserveLoginAttempt(e,key,{now:now+(LOGIN_MAX_FAILURES+1)*1000});
  assert.equal(refused.allowed,false);assert.ok(refused.retryAfterSeconds>0&&refused.retryAfterSeconds<=LOGIN_LOCK_MS/1000);
  const stillRefused=await reserveLoginAttempt(e,key,{now:now+(LOGIN_MAX_FAILURES+2)*1000});assert.equal(stillRefused.allowed,false,'locked rows do not grow or reset');
  const later=await reserveLoginAttempt(e,key,{now:now+(LOGIN_MAX_FAILURES+1)*1000+LOGIN_LOCK_MS+1});assert.equal(later.allowed,true,'lock expires');assert.equal(later.failures,1,'fresh window after the lock');
});
test('concurrent attempts are all counted: a burst cannot slip past the limit',async()=>{
  const e=env();const key=await loginThrottleKey(req(),'owner@example.com');const now=Date.parse('2026-10-19T12:00:00Z');
  const results=await Promise.all(Array.from({length:LOGIN_MAX_FAILURES*3},(_,i)=>reserveLoginAttempt(e,key,{now:now+i})));
  assert.equal(results.filter(r=>r.allowed).length,LOGIN_MAX_FAILURES);
  assert.equal(results.filter(r=>!r.allowed).length,LOGIN_MAX_FAILURES*2);
});
test('attempts outside the window start a fresh count and a successful sign-in clears the record',async()=>{
  const e=env();const key=await loginThrottleKey(req(),'owner@example.com');const now=Date.parse('2026-10-19T12:00:00Z');
  for(let i=1;i<=5;i++)await reserveLoginAttempt(e,key,{now:now+i*1000});
  const fresh=await reserveLoginAttempt(e,key,{now:now+LOGIN_WINDOW_MS+10000});assert.equal(fresh.failures,1);
  await clearLoginThrottle(e,key,{now:now+LOGIN_WINDOW_MS+11000});
  assert.equal((await e.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts').first()).n,0);
});
test('storage problems fail open instead of locking the owner out',async()=>{
  const broken={DB:{prepare(){throw new Error('D1 unavailable');}}};const key=await loginThrottleKey(req(),'owner@example.com');
  assert.deepEqual(await reserveLoginAttempt(broken,key),{allowed:true,retryAfterSeconds:0,failures:0});await clearLoginThrottle(broken,key);
});
test('the owner login route reserves the attempt before comparing credentials and clears it on success',()=>{
  const source=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
  const login=source.slice(source.indexOf('/api/login'),source.indexOf('/api/session'));
  assert.ok(login.indexOf('reserveLoginAttempt(')<login.indexOf('constantTimeEqual('),'the attempt is counted before the credential compare');
  assert.match(login,/429/);assert.match(login,/Retry-After/);assert.match(login,/clearLoginThrottle\(env,throttleKey\)/);assert.doesNotMatch(login,/recordLoginFailure/);
});
