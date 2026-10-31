import {sha256,cookieValue} from './security.js';

// A submitted charge belongs to its receipt; permission to change CRM remains
// bound to the original session and membership at every later boundary.
export async function contactRequestGuard(request,env,context){
 const token=cookieValue(request,'leadintel_session'),hash=token?await sha256(token):'';
 const guard=async()=>{
  if(request.signal.aborted)throw Object.assign(Error('Contact research was cancelled.'),{status:499,code:'ADDITIONAL_CONTACT_CANCELLED'});
  const session=hash?await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>datetime('now')").bind(hash,context.userId).first():null;
  if(!session)throw Object.assign(Error('Authentication required'),{status:401,code:'CONTACT_SESSION_REVOKED'});
  const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(context.workspaceId,context.userId).first();
  if(!member||member.role!==context.role)throw Object.assign(Error('Workspace permission changed; reload before continuing.'),{status:403,code:'CONTACT_MEMBERSHIP_CHANGED'});
  if(request.signal.aborted)throw Object.assign(Error('Contact research was cancelled.'),{status:499,code:'ADDITIONAL_CONTACT_CANCELLED'});
 };
 guard.writeAuthority=()=>({sql:"EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>datetime('now')) AND EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=? AND user_id=? AND role=?)",args:[hash,context.userId,context.workspaceId,context.userId,context.role]});
 return guard;
}
