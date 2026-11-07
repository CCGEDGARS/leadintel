// One explicit start/resume owns a bounded elapsed-time window. A pause is
// incomplete work, never a completion receipt. Checkpoints survive resumption.
export const BUYER_RUN_WINDOW_MS=30*60*1000;
export const BUYER_RUN_WINDOW_REASON='Research paused after 30 minutes. Saved checks and contacts are retained. Resume unfinished research when ready.';
export function buyerRunWindow(row,input={},now=Date.now()){
 const raw=input.executionWindowStartedAt||row.created_at;
 const parsed=Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(String(raw))?raw.replace(' ','T')+'Z':raw);
 const start=Number.isFinite(parsed)?Math.min(parsed,now):now;
 return {startedAt:new Date(start).toISOString(),deadlineAt:new Date(start+BUYER_RUN_WINDOW_MS).toISOString(),expired:now>=start+BUYER_RUN_WINDOW_MS,remainingMs:Math.max(0,start+BUYER_RUN_WINDOW_MS-now)};
}
