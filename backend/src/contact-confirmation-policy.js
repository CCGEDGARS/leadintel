import '../../customer/contact-confirmation-policy.js';
export async function loadConfirmationLevel(env,workspaceId){
  try{
    const row=await env.DB.prepare('SELECT config_json FROM approved_workflows WHERE workspace_id=?').bind(workspaceId).first();
    if(row)return globalThis.LeadIntelContactPolicy.level(JSON.parse(row.config_json).buyers?.confirmationLevel);
    return 'public_confirmed';
  }catch{return 'provider_verified';}
}
