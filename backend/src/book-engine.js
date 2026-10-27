export const BOOK_ENGINE_VERSION='20261027-gemini-first-v1';
// A task preference, not a mutation of the workspace's assistant selection.
export async function bookEngineRow(env,workspaceId){
 if(!env.OAUTH_TOKEN_ENCRYPTION_KEY)return null;
 return env.DB.prepare(`SELECT provider,model,encrypted_api_key FROM workspace_ai_integrations WHERE workspace_id=? AND (provider='gemini' OR active=1) ORDER BY CASE WHEN provider='gemini' THEN 0 ELSE 1 END LIMIT 1`).bind(workspaceId).first();
}
export async function bookEngineMetadata(env,workspaceId){
 const row=await bookEngineRow(env,workspaceId);
 return row?{provider:row.provider,model:row.model,fallback:row.provider!=='gemini'}:null;
}
