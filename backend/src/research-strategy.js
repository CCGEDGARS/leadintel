export async function allowFullResearch(env,workspaceId){
 const settings=await env.DB.prepare('SELECT full_research_policy FROM workspace_research_settings WHERE workspace_id=?').bind(workspaceId).first();
 if(settings?.full_research_policy==='free_only'){
  throw Object.assign(Error('Metered research is disabled in Settings → AI engines → Search strategy.'),{status:403,code:'FULL_RESEARCH_DISABLED'});
 }
}
