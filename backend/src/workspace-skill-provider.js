import {importAesKey,decryptSecret} from './oauth.js';
import {generateText} from './ai-provider.js';
export async function workspaceSkillGenerator(env,workspaceId){
 const row=await env.DB.prepare('SELECT provider,model,encrypted_api_key FROM workspace_ai_integrations WHERE workspace_id=? AND active=1 LIMIT 1').bind(workspaceId).first();
 if(!row||!env.OAUTH_TOKEN_ENCRYPTION_KEY)throw Object.assign(Error('Connect an active AI provider in Settings, then retry.'),{status:503});
 const apiKey=await decryptSecret(row.encrypted_api_key,await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 return input=>generateText({provider:row.provider,model:row.model,apiKey,...input,reasoningEffort:'low',signal:AbortSignal.timeout(60000)});
}
