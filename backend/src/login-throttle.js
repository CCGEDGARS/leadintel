import {sha256} from './security.js';
// Owner sign-in throttle: after MAX_FAILURES failed attempts from the same client for the same email
// within WINDOW_MS, further attempts are refused for LOCK_MS. Every storage problem fails open so an
// infrastructure error can never lock the real owner out.
export const LOGIN_MAX_FAILURES=10;
export const LOGIN_WINDOW_MS=15*60*1000;
export const LOGIN_LOCK_MS=15*60*1000;
const clean=value=>String(value??'').trim().toLowerCase().slice(0,200);
export async function loginThrottleKey(request,email){
  const ip=clean(request?.headers?.get?.('CF-Connecting-IP')||request?.headers?.get?.('X-Forwarded-For')||'')||'unknown';
  return sha256(`${ip}|${clean(email)}`);
}
export async function checkLoginThrottle(env,key,{now=Date.now()}={}){
  try{
    const row=await env.DB.prepare('SELECT failures,window_started_at,locked_until FROM login_attempts WHERE key=?').bind(key).first();
    const lockedUntil=row?.locked_until?Date.parse(row.locked_until):NaN;
    if(Number.isFinite(lockedUntil)&&lockedUntil>now)return {allowed:false,retryAfterSeconds:Math.max(1,Math.ceil((lockedUntil-now)/1000))};
    return {allowed:true,retryAfterSeconds:0};
  }catch{return {allowed:true,retryAfterSeconds:0};}
}
export async function recordLoginFailure(env,key,{now=Date.now()}={}){
  try{
    const row=await env.DB.prepare('SELECT failures,window_started_at FROM login_attempts WHERE key=?').bind(key).first();
    const started=row?Date.parse(row.window_started_at):NaN;
    const inWindow=Number.isFinite(started)&&now-started<LOGIN_WINDOW_MS;
    const failures=inWindow?Number(row.failures||0)+1:1;
    const windowStartedAt=inWindow?row.window_started_at:new Date(now).toISOString();
    const lockedUntil=failures>=LOGIN_MAX_FAILURES?new Date(now+LOGIN_LOCK_MS).toISOString():null;
    if(row)await env.DB.prepare('UPDATE login_attempts SET failures=?,window_started_at=?,locked_until=? WHERE key=?').bind(failures,windowStartedAt,lockedUntil,key).run();
    else await env.DB.prepare('INSERT INTO login_attempts(key,failures,window_started_at,locked_until) VALUES(?,?,?,?)').bind(key,failures,windowStartedAt,lockedUntil).run();
    await env.DB.prepare('DELETE FROM login_attempts WHERE window_started_at<? AND (locked_until IS NULL OR locked_until<?)').bind(new Date(now-24*60*60*1000).toISOString(),new Date(now).toISOString()).run();
    return {failures,locked:Boolean(lockedUntil)};
  }catch{return {failures:0,locked:false};}
}
export async function clearLoginThrottle(env,key){
  try{await env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();}catch{}
}
