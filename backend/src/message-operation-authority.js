// Current authority is asserted inside the same transaction as message writes.
// Snapshots are captured from trusted database columns, never request keys.
export function messageRowAssertion(db,table,where,args,row){
 if(!/^[a-z_]+$/.test(table))throw Error('Invalid message authority table');
 const entries=row?Object.entries(row).filter(([key,value])=>/^[a-z_]+$/.test(key)&&(value===null||['string','number'].includes(typeof value))):[];
 const predicate=`${where}${entries.length?' AND '+entries.map(([key])=>key+' IS ?').join(' AND '):''}`;
 return db.prepare(`SELECT CASE WHEN ${row?'':'NOT '}EXISTS(SELECT 1 FROM ${table} WHERE ${predicate}) THEN 1 ELSE json('MESSAGE_CONTEXT_CHANGED') END`).bind(...args,...entries.map(([,value])=>value));
}
export async function messageAuthorityAssertions(env,context){
 await context.guard?.();const authority=context.writeAuthority?.()||context.guard?.writeAuthority?.();
 return authority?[env.DB.prepare(`SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE json('MESSAGE_AUTHORITY_CHANGED') END`).bind(...authority.args)]:[];
}
export async function messageBatch(env,context,writes,assertions=[]){
 try{return await env.DB.batch([...await messageAuthorityAssertions(env,context),...assertions,...writes]);}
 catch(cause){await context.guard?.();if(/MESSAGE_(?:CONTEXT|AUTHORITY)_CHANGED|malformed JSON/i.test(String(cause.message)))throw Object.assign(Error('Message context changed. Reload and review; your draft is preserved.'),{status:409});throw cause;}
}
// One aggregate assertion pins a bounded, ordered read set, including new rows.
export function messageSetAssertion(db,query,args,rows){
 const keys=Object.keys(rows[0]||{}).filter(key=>/^[a-z_]+$/.test(key));
 if(!keys.length)return db.prepare(`SELECT CASE WHEN NOT EXISTS(${query}) THEN 1 ELSE json('MESSAGE_CONTEXT_CHANGED') END`).bind(...args);
 const expression=keys.map(key=>"'"+key+"',"+key).join(','),expected=JSON.stringify(rows.slice().sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0).map(row=>Object.fromEntries(keys.map(key=>[key,row[key]]))));
 return db.prepare(`SELECT CASE WHEN (SELECT json_group_array(json_object(${expression})) FROM (${query} ORDER BY id))=? THEN 1 ELSE json('MESSAGE_CONTEXT_CHANGED') END`).bind(...args,expected);
}
