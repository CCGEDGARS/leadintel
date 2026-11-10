import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';
import '../../customer/strategy-integrity.js';
export async function universalFixture(){
 const DB=storageDb(),token='universal-test-session',workspaceId='storage-w1';
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").run(await sha256(token));
 const main={approved:true,website:'https://seller.example',profile:{companyName:'Fixture Seller',targetMarkets:'Denmark',priorityOffers:'Engineering'},targetMarkets:['Denmark'],messageStudio:{myTemplates:{'template-1':{id:'template-1',name:'Case invitation',subject:'Regarding {{reference}}',body:'Hello {{name}},\n\nRegarding {{event}}.\n{{sourceUrl}}\n\nRegards,\n{{sender}}'}},essentials:{sender:'Alex Test',offer:'Engineering'}},market:{strategyApproved:true,signals:[{id:'hiring',active:true,name:'Hiring',keywords:'welder; engineering',weight:10}],icps:[{id:'core',active:true,name:'Industrial buyers',description:'Manufacturers'}]}};
 main.market.strategyApproval=globalThis.LeadIntelStrategyIntegrity.approval(main);
 DB.raw.prepare('INSERT INTO customer_workspace_state(workspace_id,schema_version,version,payload_json) VALUES(?,1,1,?)').run(workspaceId,JSON.stringify({main}));
 const env={DB,OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),GOOGLE_OAUTH_CLIENT_ID:'test',GOOGLE_OAUTH_CLIENT_SECRET:'test',AUTOMATIC_GMAIL_DELIVERY_MODE:'enabled'};
 const secret=await encryptSecret('fixture-only',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));
 DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES(?,'firecrawl',?,'fixture')").run(workspaceId,secret);
 const request=(path='',method='GET',body)=>new Request('https://api.example.test/api/market-monitoring'+path+(path.includes('?')?'&':'?')+'workspace_id='+workspaceId,{method,headers:{Cookie:'leadintel_session='+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 return {DB,env,main,request,workspaceId,secret,scope:{workspaceId,userId:'storage-owner',role:'owner'}};
}
export const courtText='Case number: C-2026-5\nHearing date: 2026-11-25\nClaimant (individual): Alex Rowan\nDefendant (company): Example Works Ltd\nStatus: Hearing scheduled';
