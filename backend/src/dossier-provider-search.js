import {searchWeb} from './ai-provider.js';
import {searchGeminiWeb} from './ai-task-routing.js';
import {searchAnthropicWeb} from './anthropic-web-search.js';
export {searchAnthropicWeb} from './anthropic-web-search.js';
export function searchDossierProvider(connection,query,{signal,fetchImpl=fetch}={}){
 const options={...connection,query,signal,fetchImpl,maxResults:8,purpose:'contact_research'};
 if(connection.provider==='anthropic')return searchAnthropicWeb(options);
 if(connection.provider==='gemini')return searchGeminiWeb(options);
 return searchWeb(options);
}
