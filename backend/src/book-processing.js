export const BOOK_CONCURRENCY=3;
export const BOOK_BATCH_SIZE=24;
export const BOOK_WINDOW_MS=240000;
export const BOOK_LEASE_MS=420000;
export async function boundedBookWork(items,perform,{concurrency=BOOK_CONCURRENCY,clock=Date.now,deadline=Infinity}={}){
 const errors=[];let started=0,completed=0;
 for(let at=0;at<items.length&&clock()<deadline;at+=concurrency){
  const wave=items.slice(at,at+concurrency);started+=wave.length;
  const settled=await Promise.allSettled(wave.map(perform));
  for(const result of settled)if(result.status==='fulfilled')completed++;else errors.push(result.reason);
  if(errors.length)break; // Drain the current wave; do not launch more paid work after a failure.
 }
 return {started,completed,errors};
}
export async function acquireBookLock(env,workspaceId,ownerId,now,until){
 const row=await env.DB.prepare(`INSERT INTO book_processing_locks(workspace_id,owner_id,lease_until) VALUES(?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET owner_id=excluded.owner_id,lease_until=excluded.lease_until WHERE book_processing_locks.lease_until<? RETURNING owner_id`).bind(workspaceId,ownerId,until,now).first();return row?.owner_id===ownerId;
}
export async function releaseBookLock(env,workspaceId,ownerId){await env.DB.prepare('DELETE FROM book_processing_locks WHERE workspace_id=? AND owner_id=?').bind(workspaceId,ownerId).run();}
export function processingProgress(row,completed,total,now=Date.now()){
 const startedAt=Number(row?.started_at)||0,lastProgressAt=Number(row?.last_progress_at)||0,newCount=Math.max(0,completed-(Number(row?.progress_baseline)||0)),elapsed=now-startedAt;
 const rate=startedAt&&elapsed>=10000&&newCount>=3?newCount/elapsed*60000:null;
 return {completed,total,percent:total?Math.min(100,Math.floor(completed/total*100)):0,startedAt,lastProgressAt,ratePerMinute:rate?Math.round(rate*10)/10:null,etaSeconds:rate?Math.ceil(Math.max(0,total-completed)/rate*60):null};
}
