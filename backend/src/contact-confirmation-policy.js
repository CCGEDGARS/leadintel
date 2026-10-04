import '../../customer/contact-confirmation-policy.js';
export async function loadConfirmationLevel(env,workspaceId){
  try{
    const row=await env.DB.prepare('SELECT config_json FROM approved_workflows WHERE workspace_id=?').bind(workspaceId).first();
    if(row)return globalThis.LeadIntelContactPolicy.level(JSON.parse(row.config_json).buyers?.confirmationLevel);
    // An existing standalone delivery approval must retain its former verified-email rule.
    const delivery=await env.DB.prepare('SELECT mode,enabled FROM outreach_automation_policies WHERE workspace_id=?').bind(workspaceId).first();
    return delivery?.enabled&&delivery.mode==='automatic'?'provider_verified':'public_confirmed';
  }catch{return 'provider_verified';}
}
