const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export function storagePreferences(row){return {auto_report_copies:row.auto_report_copies!==0,revision:Number(row.storage_policy_revision||0)};}
export async function listStorageFiles(env,workspace){
 const materials=await stmt(env,`SELECT id,filename,revision,status,created_at,original_key,text_key FROM company_materials WHERE workspace_id=?`,workspace).all();
 const books=await stmt(env,`SELECT id,filename,revision,status,created_at,original_key,text_key,catalogue_key FROM writing_reference_sources WHERE workspace_id=? AND status<>'Deleted'`,workspace).all();
 const objects=await stmt(env,'SELECT object_key,byte_size,state FROM workspace_storage_objects WHERE workspace_id=?',workspace).all();
 const sizes=new Map(objects.results.map(row=>[row.object_key,row]));
 const card=(row,kind)=>{
  const keys=[row.original_key,row.text_key,row.catalogue_key].filter(Boolean),measured=keys.every(key=>sizes.get(key)?.state==='ready');
  return {id:row.id,kind,name:row.filename,status:row.status,revision:row.revision,created_at:row.created_at,measured,bytes:keys.reduce((n,key)=>n+Number(sizes.get(key)?.byte_size||0),0)};
 };
 return {workspace_id:workspace,files:[...materials.results.map(row=>card(row,'material')),...books.results.map(row=>card(row,'book'))].sort((a,b)=>b.bytes-a.bytes||a.name.localeCompare(b.name)),note:'Uploaded company files and books. Other saved content is included in the usage bars.'};
}
