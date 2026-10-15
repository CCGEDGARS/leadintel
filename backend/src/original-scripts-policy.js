function originals(payload){return payload?.outreach?.messageStudio?.originalScripts||{};}
export function validateOriginalScriptsWrite(before,after,role){const old=originals(before),next=originals(after);for(const id of new Set([...Object.keys(old),...Object.keys(next)])){const a=old[id],b=next[id];if(JSON.stringify(a)===JSON.stringify(b))continue;if(role!=='owner')throw Error('Only the workspace owner can manage original scripts');if(!/^(email:(professional|curiosity|friendly|brutal)|linkedin:(professional|curiosity|friendly)):[a-z]{2}$/.test(id)||id.endsWith(':en'))throw Error('Invalid original script');if(!b||typeof b.body!=='string'||!b.body.trim()||b.body.length>12000||!Array.isArray(b.history))throw Error('Original scripts cannot be deleted or emptied');if(!a){if(b.revision!==1||b.locked!==true||b.history.length)throw Error('New original must be saved and locked');continue;}if(a.locked){if(b.locked!==false||JSON.stringify({...b,locked:true})!==JSON.stringify(a))throw Error('Unlock the original before revising it');continue;}if(b.locked!==true||b.revision!==a.revision+1||b.history.length!==a.history.length+1||JSON.stringify(b.history.slice(0,-1))!==JSON.stringify(a.history)||JSON.stringify(b.history.at(-1))!==JSON.stringify({body:a.body,revision:a.revision,updatedAt:a.updatedAt}))throw Error('Save & lock must preserve the previous original revision');}}

// Workspace ownership is not platform authorship. These legacy language references
// are retained for reading, but only the configured platform owner may revise them.
export async function validatePlatformOriginalScriptsWrite(env,before,after,userId){
 if(JSON.stringify(originals(before))===JSON.stringify(originals(after)))return;
 const user=await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(userId).first();
 if(!env.ADMIN_EMAIL||!user?.email||user.email.trim().toLowerCase()!==env.ADMIN_EMAIL.trim().toLowerCase())throw Error('Only the platform owner can manage original scripts');
 validateOriginalScriptsWrite(before,after,'owner');
}
