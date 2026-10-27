export const BOOK_CONCURRENCY=3;
export const BOOK_BATCH_SIZE=60;
export const BOOK_WINDOW_MS=240000;
export const BOOK_LEASE_MS=420000;
export async function boundedBookWork(items,perform,{concurrency=BOOK_CONCURRENCY,clock=Date.now,deadline=Infinity}={}){
 const errors=[];let started=0,completed=0,next=0;
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>BOOK_CONCURRENCY)throw Error('Invalid book concurrency');
 async function worker(){while(!errors.length&&next<items.length&&clock()<deadline){
  const item=items[next++];started++;
  try{await perform(item);completed++;}catch(error){errors.push(error);}
 }}
 // Each slot takes the next section immediately; an error stops new launches,
 // while already-started requests finish and retain their checkpoints.
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},worker));
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
