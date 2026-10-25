// Invitation-only admission for new sign-ins (CTO decision, 2026-10-25).
// Rule: an identity that already maps to a user signs in as before. A NEW identity is admitted only when
// access_invitations holds an active (non-revoked) row for its e-mail address; otherwise the sign-in
// bounces to the public sign-in page with ?access=invite-required and nothing is created.
import {sha256,cookieValue} from './security.js';

export function normalizeInviteEmail(value){return String(value||'').trim().toLowerCase().slice(0,254);}
export function validInviteEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeInviteEmail(value));}

// Only the accounts listed in PLATFORM_ADMIN_EMAILS administer the platform (CTO decision 2026-10-25). The legacy
// owner password login (ADMIN_EMAIL) is a sign-in method, not an administrator grant.
export function platformAdminEmails(env={}){
  return String(env.PLATFORM_ADMIN_EMAILS||'').split(',').map(normalizeInviteEmail).filter(Boolean);
}
export function isPlatformAdmin(env,user){return Boolean(user?.email)&&platformAdminEmails(env).includes(normalizeInviteEmail(user.email));}

export async function findInvitation(env,email){
  const normalized=normalizeInviteEmail(email);if(!normalized)return null;
  return env.DB.prepare('SELECT email,invited_by,note,created_at,accepted_at,accepted_user_id,revoked_at FROM access_invitations WHERE email=? AND revoked_at IS NULL').bind(normalized).first();
}

// Creates the user for an invited identity and stamps the invitation. Returns null when no invitation exists.
export async function admitInvitedUser(env,identity){
  const email=normalizeInviteEmail(identity?.email);
  const invitation=await findInvitation(env,email);if(!invitation)return null;
  const id=`user-${(await sha256(email)).slice(0,24)}`;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users(id,email,display_name,role,last_login_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)').bind(id,email,identity.name||email,'owner'),
    env.DB.prepare('UPDATE access_invitations SET accepted_at=COALESCE(accepted_at,CURRENT_TIMESTAMP),accepted_user_id=? WHERE email=?').bind(id,email)
  ]);
  return {id,email,display_name:identity.name||email,role:'owner'};
}

// The public sign-in page lives at the app origin root (/), outside the signed-in workspace.
export function inviteRequiredUrl(env,reason='invite-required'){
  const origin=new URL(String(env.CUSTOMER_APP_URL||'').split(',')[0].trim()).origin;
  return `${origin}/?access=${encodeURIComponent(reason)}`;
}

async function sessionUser(request,env){
  const token=cookieValue(request,'leadintel_session');if(!token)return null;
  return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(await sha256(token)).first();
}
function json(body,status,cors){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});}
function error(message,status,cors){return json({error:message},status,cors);}
async function audit(env,{userId=null,type,entityId=null,metadata={}}){
  await env.DB.prepare('INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),null,userId,type,'access_invitation',entityId,JSON.stringify(metadata)).run();
}

// GET    /api/access/invitations          → list (platform admins only)
// POST   /api/access/invitations {email,note} → create or re-activate
// DELETE /api/access/invitations?email=   → revoke (the person keeps any account already created)
// GET    /api/access/users                → every account with sign-in providers, workspace count and the admin flag
export async function handleAccessRoute(request,env,cors){
  const url=new URL(request.url);if(url.pathname!=='/api/access/invitations'&&url.pathname!=='/api/access/users')return null;
  const user=await sessionUser(request,env);if(!user)return error('Authentication required',401,cors);
  if(!isPlatformAdmin(env,user))return error('Only platform administrators manage invitations',403,cors);
  if(url.pathname==='/api/access/users'){
    if(request.method!=='GET')return error('Method not allowed',405,cors);
    const {results=[]}=await env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,users.created_at,users.last_login_at,
      (SELECT group_concat(provider) FROM user_identities WHERE user_identities.user_id=users.id) AS providers,
      (SELECT count(*) FROM workspace_members WHERE workspace_members.user_id=users.id) AS workspaces,
      access_invitations.invited_by,access_invitations.note AS invitation_note
      FROM users LEFT JOIN access_invitations ON access_invitations.email=users.email
      ORDER BY users.created_at DESC LIMIT 500`).all();
    const users=results.map(row=>({...row,providers:String(row.providers||'').split(',').filter(Boolean),workspaces:Number(row.workspaces||0),platform_admin:isPlatformAdmin(env,row)}));
    return json({users,admins:platformAdminEmails(env)},200,cors);
  }
  if(request.method==='GET'){
    const {results=[]}=await env.DB.prepare('SELECT email,invited_by,note,created_at,accepted_at,accepted_user_id,revoked_at FROM access_invitations ORDER BY created_at DESC LIMIT 500').all();
    return json({invitations:results,admins:platformAdminEmails(env)},200,cors);
  }
  if(request.method==='POST'){
    const body=await request.json().catch(()=>null);const email=normalizeInviteEmail(body?.email);
    if(!validInviteEmail(email))return error('Enter one valid e-mail address to invite',400,cors);
    const note=String(body?.note||'').trim().slice(0,200);
    await env.DB.prepare('INSERT INTO access_invitations(email,invited_by,note) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET revoked_at=NULL,note=excluded.note,invited_by=excluded.invited_by').bind(email,user.email,note).run();
    await audit(env,{userId:user.id,type:'access.invitation_created',entityId:email,metadata:{note}});
    return json({invitation:await findInvitation(env,email)},201,cors);
  }
  if(request.method==='DELETE'){
    const email=normalizeInviteEmail(url.searchParams.get('email'));if(!validInviteEmail(email))return error('Name the invited e-mail address to revoke',400,cors);
    const result=await env.DB.prepare('UPDATE access_invitations SET revoked_at=CURRENT_TIMESTAMP WHERE email=? AND revoked_at IS NULL').bind(email).run();
    if(!Number(result?.meta?.changes||0))return error('No active invitation for this address',404,cors);
    await audit(env,{userId:user.id,type:'access.invitation_revoked',entityId:email});
    return json({ok:true,email},200,cors);
  }
  return error('Method not allowed',405,cors);
}
