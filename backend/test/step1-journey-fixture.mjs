import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {storageDb} from './workspace-storage-fixture.mjs';
import {workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {sha256} from '../src/security.js';
import {putCustomerState,getCustomerState} from '../src/customer-state.js';
import {runCompanyMaterialJobs} from '../src/company-materials-analysis.js';
import {encryptSecret,importAesKey} from '../src/oauth.js';
import app from '../src/app.js';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
export const website='https://seller.example/';
export const websiteText='Fixture Industrial provides custom machinery, engineering services and on-site installation for manufacturers. The company works from supplied drawings and project requirements. Its public website describes industrial automation, production equipment and technical project delivery. Contact the team to discuss the scope and practical constraints of a proposed project. No customer outcomes, certifications or quantified results are published in this controlled source.';
export const pdfPath=fileURLToPath(new URL('./fixtures/mixed-native.pdf',import.meta.url));
export const blankPdfPath=fileURLToPath(new URL('./fixtures/blank-native.pdf',import.meta.url));
export const sourceQuote='KNOWN EXACT SOURCE';

// Same all-migration SQL and hashed-cookie authorization used by Step 5. This
// fixture starts before activation, with no approved profile, targeting or buyer.
export async function step1Fixture({legacyMarkets=[]}={}){
 const DB=storageDb(),objects=new Map(),calls=[],externalCalls=[],aiRequests=[],pending=new Set();let gate=null,failedSaves=false;
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").run(await sha256(sessionToken));
 const bucket={async put(key,value){objects.set(key,typeof value==='string'?value:Uint8Array.from(value));},async get(key){const value=objects.get(key);return value==null?null:{async text(){return typeof value==='string'?value:new TextDecoder().decode(value);},async arrayBuffer(){return typeof value==='string'?new TextEncoder().encode(value).buffer:value.slice().buffer;}};},async delete(key){objects.delete(key);}};
 const env={DB,WRITING_REFERENCES_BUCKET:bucket,APP_ORIGIN:'',CUSTOMER_APP_URL:'',AUTOMATIC_GMAIL_DELIVERY_MODE:'manual_only'};
 const payload={main:{step:1,website:'',targetMarkets:legacyMarkets,documents:[],additionalLinks:[],answers:{},answerStatus:{},profile:null,approved:false,market:{}},discovery:{candidates:[],selectedProspects:[],pipeline:[]},outreach:{items:[]},delivery:{},meta:{discovery:{activeJourneyStage:1,visibleStep:1},persistence:{explicit_saved:true}}};
 await putCustomerState(env,{workspaceId,userId:'storage-owner',expectedVersion:0,payload});
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,env.APP_ORIGIN);
  if(url.pathname.startsWith('/api/')||url.pathname==='/company-material-upload'){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
   const call={method:req.method,path:url.pathname,workspaceId:url.searchParams.get('workspace_id')};calls.push(call);
   if(String(req.headers['content-type']).includes('multipart/form-data')){const form=await new Request(url,{method:req.method,headers:req.headers,body}).formData(),file=form.get('file');call.upload={filename:file?.name,size:file?.size,mime:file?.type,requestBytes:body.length};}
   if(body.length&&String(req.headers['content-type']).includes('application/json')){try{call.body=JSON.parse(body);}catch{}}
   const response=failedSaves&&req.method==='PUT'&&url.pathname==='/api/customer/state'?Response.json({error:'Controlled workspace save outage'},{status:503}):await app.fetch(new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{})}),env,{waitUntil(promise){pending.add(promise);promise.finally(()=>pending.delete(promise));}});
   call.status=response.status;const out=Buffer.from(await response.arrayBuffer());try{call.result=JSON.parse(out);}catch{call.bytes=out.length;}
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(out);return;
  }
  const relative=url.pathname==='/'?'customer/index.html':url.pathname.replace(/^\//,''),file=path.resolve(root,relative.endsWith('/')?relative+'index.html':relative);
  if(!file.startsWith(root+path.sep)||!['.html','.css','.js','.json','.svg','.png','.jpg','.webp','.woff','.woff2'].includes(path.extname(file))){res.writeHead(404);res.end();return;}
  const content=await fs.readFile(file),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(content);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;env.APP_ORIGIN=origin;env.CUSTOMER_APP_URL=origin+'/customer/';
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(url.origin===origin)return originalFetch(input,options);
  externalCalls.push({url:url.href,method:options.method||'GET'});
  if(url.hostname==='failed.example')return new Response('Controlled website unavailable',{status:503});
  if(['seller.example','slow.example','changed.example'].includes(url.hostname)){
   if(gate&&url.hostname==='slow.example'){gate.started();await gate.wait;}
   return new Response('<!doctype html><html><head><title>Fixture Industrial</title></head><body><h1>Fixture Industrial</h1><p>'+websiteText+'</p></body></html>',{headers:{'Content-Type':'text/html'}});
  }
  if(url.hostname==='api.firecrawl.dev'){
   const body=JSON.parse(options.body);if(url.pathname.endsWith('/search'))return Response.json({success:true,data:[]});
   if(url.pathname.endsWith('/scrape')&&new URL(body.url).hostname==='failed.example')return Response.json({success:false,error:'Controlled extractor unavailable'},{status:503});
   if(new URL(body.url).hostname!=='seller.example')throw Error('Controlled research cannot read another company');
   return Response.json({success:true,data:{markdown:websiteText,links:[],metadata:{title:'Fixture Industrial',sourceURL:body.url,statusCode:200}}});
  }
  if(url.hostname==='generativelanguage.googleapis.com'){
   const body=JSON.parse(options.body);aiRequests.push({url:url.origin+url.pathname,body});
   const id=DB.raw.prepare("SELECT id FROM company_materials WHERE workspace_id=? AND status='Ready' ORDER BY created_at LIMIT 1").get(workspaceId)?.id;
   const value={fields:{proof_points:{value:sourceQuote,confidence:'high',draft_type:'fact',source_ids:id?['material:'+id]:[],rationale:'Exact words from the uploaded company material; no outcome or approval is implied.'}}};
   return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:{}});
  }
  throw Error('Acceptance harness blocked unplanned external request: '+url.origin+url.pathname);
 };
 return {DB,env,origin,objects,calls,externalCalls,aiRequests,getState:()=>getCustomerState(env,workspaceId),runJobs:()=>runCompanyMaterialJobs(env),async connectControlledExtraction(){env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,13).toString('base64');const encrypted=await encryptSecret('controlled-extraction-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES(?,'firecrawl',?,'test','{}')").run(workspaceId,encrypted);},async connectControlledAi(){env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,13).toString('base64');const encrypted=await encryptSecret('controlled-test-key',await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,'gemini',?,'test','fixture-model',1)").run(workspaceId,encrypted);},failSaves(value=true){failedSaves=value;},holdWebsite(){let started,release;const began=new Promise(resolve=>started=resolve),wait=new Promise(resolve=>release=resolve);gate={started,wait};return {began,release(){gate=null;release();}};},async close(){gate=null;globalThis.fetch=originalFetch;await Promise.allSettled([...pending]);await new Promise(resolve=>server.close(resolve));DB.raw.close();}};
}
