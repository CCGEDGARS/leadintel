import {importAesKey,decryptSecret} from './oauth.js';
import {generateText} from './ai-provider.js';
import {bookEngineRow} from './book-engine.js';
export const SKILL_REQUEST_TIMEOUT_MS=120000;
export async function workspaceSkillGenerator(env,workspaceId,{fetchImpl=fetch}={}){
 const row=await bookEngineRow(env,workspaceId);
 if(!row)throw Object.assign(Error('Connect Gemini or an active AI provider in Settings, then retry.'),{status:503});
 const apiKey=await decryptSecret(row.encrypted_api_key,await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 return input=>generateText({provider:row.provider,model:row.model,apiKey,...input,fetchImpl,reasoningEffort:'low',responseFormat:'json',signal:AbortSignal.timeout(SKILL_REQUEST_TIMEOUT_MS)});
}
