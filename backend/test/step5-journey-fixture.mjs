import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';
import {putCustomerState,getCustomerState} from '../src/customer-state.js';
import app from '../src/app.js';
import {handleBuyerResearchRoute} from '../src/buyer-research-routes.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {fetchDirectPublicPage} from '../src/service-integrations.js';

const require=createRequire(import.meta.url);
const D=require('../../customer/discovery-engine.js');
const Profile=require('../../customer/profile-engine.js');
const Canonical=require('../../customer/canonical-intelligence.js');
const Targeting=require('../../customer/targeting-policy.js');
require('../../customer/company-brain.js');
require('../../customer/canonical-profile-runtime.js');
const root=fileURLToPath(new URL('../../',import.meta.url));
export const workspaceId='storage-w1',sessionToken='step5-controlled-session';
export const sourceUrl='https://forge.example/team';
export const sourceText='### Robert Lund\nHead of Procurement\nPhone: +46 70 123 45 67\n[robert@forge.example](mailto:robert@forge.example)\nForge Industries\n\n### Alice Berg\nChief Operating Officer\nForge Industries\n[alice@forge.example](mailto:alice@forge.example)';

export async function journeyFixture({durableJobs=false,externalFetch,roleReviewPending=false,incompleteDossier=false,initialCandidate,researchServices}={}){
 const DB=storageDb();
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").run(await sha256(sessionToken));
 const now=new Date().toISOString(),source={url:sourceUrl,markdown:sourceText,sourceRead:true,extractedAt:now,checkedAt:now};
 const candidate={domain:'forge.example',company:'Forge Industries',buyerSearchMode:'user_selected_target',buyerRoles:['Head of Procurement','Chief Operating Officer'],qualified:true,evidence:[{url:'https://forge.example/expansion',text:'Forge Industries is expanding its production facility.',sourceRead:true,extractedAt:now}],people:[]};
 candidate.people=D.discoverCompanyContacts([source],candidate).map((p,n)=>({...p,id:n?'alice':'robert',kept:true,identityStatus:'verified',nameVerification:'verified',organization:candidate.company}));
 if(candidate.people.length!==2)throw Error('Controlled named-source extraction did not retain both fixture buyers');
 if(durableJobs)for(const person of candidate.people)for(const key of ['publicEmail','publicEmailUrl','publicEmailEvidence','publicEmailSourceCheck','publicPhone','publicPhoneUrl','publicPhoneEvidence','publicPhoneSourceCheck'])delete person[key];
 if(roleReviewPending)candidate.buyerRolesChanged=true;
 if(incompleteDossier)candidate.buyerDiscovery={companyDossier:globalThis.LeadIntelCompanyDossier.reconcile([],{company:candidate.company,domain:candidate.domain})};
 if(initialCandidate){for(const key of Object.keys(candidate))delete candidate[key];Object.assign(candidate,structuredClone(initialCandidate));}
 const main={website:'https://seller.example/',step:5,approved:true,targetMarkets:['Sweden'],answers:{priority_offers:'industrial automation; custom machinery',ideal_customer:'manufacturers',buyer_roles:'Head of Procurement; Chief Operating Officer',exclusions:'none',buying_triggers:'new factory; capacity expansion'},profile:{companyName:'Fixture Industrial',priorityOffers:'industrial automation; custom machinery',idealCustomer:'manufacturers',decisionMakers:'Head of Procurement; Chief Operating Officer',targetMarkets:'Sweden',exclusions:'none',opportunityValue:'€50,000',customerPainPoints:'production flow downtime'},market:{strategyApproved:true,icps:[{id:'core',description:'manufacturers',active:true}],signals:[{id:'expansion',name:'Facility expansion',active:true,weight:10,keywords:'new factory; capacity expansion'}]}};
 if(initialCandidate){main.answers.buyer_roles=candidate.buyerRoles.join('; ');main.profile.decisionMakers=main.answers.buyer_roles;}
 main.profile=Profile.buildCompanyIntelligenceProfile(main);Canonical.confirmProfileContext(main);main.approved=true;
 main.targetingConfirmation=Targeting.confirm(main,now);
 main.market.strategyApproval=globalThis.LeadIntelStrategyIntegrity.approval(main,now);
 const payload={main,discovery:{candidates:[],selectedProspects:[candidate],pipeline:[],potentialMatches:[]},outreach:{items:[]},delivery:{},meta:{discovery:{website:main.website,activeBuyerCompanyDomain:candidate.domain,activeJourneyStage:5,visibleStep:5},persistence:{explicit_saved:true}}};
 const calls=[],externalCalls=[],providerCalls=[],pending=new Set();let sourceGate=null;
 const env={DB,APP_ORIGIN:'',CUSTOMER_APP_URL:'',AUTOMATIC_GMAIL_DELIVERY_MODE:'manual_only'};
 const companyResponse=await app.fetch(new Request('http://fixture.test/api/crm/companies?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({company:candidate.company,domain:candidate.domain})}),env,{});
 if(companyResponse.status!==201)throw Error('CRM fixture company creation failed: '+await companyResponse.text());
 candidate.crmId=(await companyResponse.json()).company.id;
 await putCustomerState(env,{workspaceId,userId:'storage-owner',expectedVersion:0,payload});
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,env.APP_ORIGIN);
   if(url.pathname.startsWith('/api/')){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks),request=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{})});
    const call={method:req.method,path:url.pathname,workspaceId:url.searchParams.get('workspace_id')};calls.push(call);
    if(url.pathname==='/api/buyers/research'&&req.method==='POST'){call.action=JSON.parse(body).action;call.payloadBytes=body.byteLength;}
    const response=url.pathname==='/api/buyers/research'?await handleBuyerResearchRoute(request,env,{},undefined):await app.fetch(request,env,{waitUntil(promise){pending.add(promise);promise.finally(()=>pending.delete(promise));}});
    call.status=response.status;const out=Buffer.from(await response.arrayBuffer());
    if(url.pathname==='/api/customer/state'&&req.method==='PUT'){try{call.version=JSON.parse(body).version;call.result=JSON.parse(out);}catch{}}
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(out);return;
   }
   const relative=url.pathname==='/'?'customer/index.html':url.pathname.replace(/^\//,'');
   const file=path.resolve(root,relative.endsWith('/')?relative+'index.html':relative);
   if(!file.startsWith(root)||!['.html','.css','.js','.json','.svg','.png','.jpg','.webp','.woff','.woff2'].includes(path.extname(file))){res.writeHead(404);res.end();return;}
   const content=await fs.readFile(file),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(content);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;env.APP_ORIGIN=origin;env.CUSTOMER_APP_URL=origin+'/customer/';
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.origin===origin)return originalFetch(input,options);
  externalCalls.push({url:url.href,method:options?.method||'GET'});
  if(externalFetch){const response=await externalFetch(input,options);if(response)return response;}
  if(url.hostname==='forge.example'){if(sourceGate){sourceGate.started();await sourceGate.wait;}return new Response('<html><body><h3>Robert Lund</h3><div>Head of Procurement</div><div>Phone: +46 70 123 45 67</div><div><a href="mailto:robert@forge.example">robert@forge.example</a></div><div>Forge Industries</div><h3>Alice Berg</h3><div>Chief Operating Officer</div><div>Forge Industries</div><a href="mailto:alice@forge.example">alice@forge.example</a></body></html>',{headers:{'Content-Type':'text/html'}});}
  throw Error('Acceptance harness blocked unplanned external request: '+url.origin+url.pathname);
 };
 const services={search:async query=>{providerCalls.push({kind:'search',query});const rows=[{url:sourceUrl,title:'Forge Industries named staff contacts',description:'Robert Lund, Head of Procurement; Alice Berg, Chief Operating Officer',evidenceKind:'search_excerpt',searchProvider:'controlled-search'}];Object.defineProperty(rows,'searchProviders',{value:['controlled-search']});return rows;},read:async url=>{providerCalls.push({kind:'read',url});return fetchDirectPublicPage(url);},dossier:async()=>{providerCalls.push({kind:'dossier'});if(incompleteDossier)throw Error('Controlled incomplete two-provider dossier');return {status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]};},independent:async person=>{providerCalls.push({kind:'independent',personId:person.id});return {status:'not_configured',reason:'Independent provider deliberately unconnected in acceptance fixture',results:[]};},review:async()=>{providerCalls.push({kind:'review'});return {provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:['robert','alice'],findings:[]},conflicts:[],summary:'Controlled review of supplied source evidence; broader quality gaps remain open.'};}};
 return {DB,env,origin,candidate,calls,externalCalls,providerCalls,runJobs:(jobId)=>runBuyerResearchJobs(env,{jobId,maxJobs:1,windowMs:5000,services:{...services,...researchServices}}),getState:()=>getCustomerState(env,workspaceId),holdOfficialRead(){let started,release;const began=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>release=resolve);sourceGate={started,wait};return {began,release(){sourceGate=null;release();}};},async replace(payload,version){return putCustomerState(env,{workspaceId,userId:'storage-owner',expectedVersion:version,payload});},async close(){globalThis.fetch=originalFetch;await Promise.allSettled([...pending]);await new Promise(resolve=>server.close(resolve));DB.raw.close();}};
}

export async function loadPlaywright(){
 const candidates=[process.env.LEADINTEL_PLAYWRIGHT_MODULE,'playwright','playwright-core','/opt/codex/cua_node/lib/node_modules/playwright-core'].filter(Boolean);
 for(const name of candidates){try{return require(name);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}
 throw Error('Playwright unavailable. Set LEADINTEL_PLAYWRIGHT_MODULE to an installed playwright-core module.');
}
