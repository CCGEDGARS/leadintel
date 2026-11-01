import {sha256} from './security.js';
// Owner sign-in throttle, reserve-then-verify: every attempt is counted in ONE atomic statement before the
// credentials are compared, so concurrent attempts cannot slip past the limit. After LOGIN_MAX_FAILURES
// attempts from the same client for the same e-mail within LOGIN_WINDOW_MS, further attempts are refused
// for LOGIN_LOCK_MS. Every storage problem fails open so an infrastructure error can never lock the real
// owner out; a successful sign-in clears the record.
export const LOGIN_MAX_FAILURES=10;
export const LOGIN_WINDOW_MS=15*60*1000;
export const LOGIN_LOCK_MS=15*60*1000;
const clean=value=>String(value??'').trim().toLowerCase().slice(0,200);
const iso=ms=>new Date(ms).toISOString();
export async function loginThrottleKey(request,email){
  const ip=clean(request?.headers?.get?.('CF-Connecting-IP')||request?.headers?.get?.('X-Forwarded-For')||'')||'unknown';
  return sha256(`${ip}|${clean(email)}`);
}
const RESERVE_SQL=`INSERT INTO login_attempts(key,failures,window_started_at,locked_until) VALUES(?,1,?,NULL)
ON CONFLICT(key) DO UPDATE SET
 failures=CASE WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until>excluded.window_started_at THEN login_attempts.failures
               WHEN login_attempts.window_started_at>=? THEN login_attempts.failures+1 ELSE 1 END,
 window_started_at=CASE WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until>excluded.window_started_at THEN login_attempts.window_started_at
                        WHEN login_attempts.window_started_at>=? THEN login_attempts.window_started_at ELSE excluded.window_started_at END,
 locked_until=CASE WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until>excluded.window_started_at THEN login_attempts.locked_until
                   WHEN (CASE WHEN login_attempts.window_started_at>=? THEN login_attempts.failures+1 ELSE 1 END)>? THEN ? ELSE NULL END
RETURNING failures,locked_until`;
// Counts this attempt atomically and says whether it may proceed. Returns {allowed,retryAfterSeconds,failures}.
export async function reserveLoginAttempt(env,key,{now=Date.now(),failClosed=false}={}){
  try{
    const windowStart=iso(now-LOGIN_WINDOW_MS);
    const row=await env.DB.prepare(RESERVE_SQL).bind(key,iso(now),windowStart,windowStart,windowStart,LOGIN_MAX_FAILURES,iso(now+LOGIN_LOCK_MS)).first();
    const lockedUntil=row?.locked_until?Date.parse(row.locked_until):NaN;
    if(Number.isFinite(lockedUntil)&&lockedUntil>now)return {allowed:false,retryAfterSeconds:Math.max(1,Math.ceil((lockedUntil-now)/1000)),failures:Number(row?.failures)||0};
    return {allowed:true,retryAfterSeconds:0,failures:Number(row?.failures)||0};
  }catch{return {allowed:!failClosed,retryAfterSeconds:failClosed?60:0,failures:0};}
}
export async function clearLoginThrottle(env,key,{now=Date.now()}={}){
  try{
    await env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
    await env.DB.prepare('DELETE FROM login_attempts WHERE window_started_at<? AND (locked_until IS NULL OR locked_until<?)').bind(iso(now-24*60*60*1000),iso(now)).run();
  }catch{}
}
