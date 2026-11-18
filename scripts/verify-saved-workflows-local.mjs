// Authenticated local browser journey using the real storage/flow routes and
// SQLite schema. No provider calls, emails or production records are involved.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {storageDb} from '../backend/test/workspace-storage-fixture.mjs';
import {sha256} from '../backend/src/security.js';
import {handleSavedFlowRoute} from '../backend/src/saved-flow-routes.js';
import {getCustomerState,putCustomerState} from '../backend/src/customer-state.js';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const env={DB:storageDb()},workspace='storage-w1',user='storage-owner';
await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").bind(await sha256('browser-workflow'),user).run();
const initial={main:{website:'https://original.example',targetMarkets:['Sweden'],profile:{companyName:'Seller'},answers:{buyer_roles:'COO'}},outreach:{messageStudio:{myTemplates:[{id:'custom',body:'Keep this exact script.'}],mode:'professional'}},discovery:{},delivery:{}};
await env.DB.prepare('INSERT INTO customer_workspace_state(workspace_id,payload_json,version) VALUES(?,?,1)').bind(workspace,JSON.stringify(initial)).run();
async function flow(id,body){const r=await handleSavedFlowRoute(new Request('http://local/api/flows'+(id?'/'+id:'')+'?workspace_id='+workspace,{method:'POST',headers:{Cookie:'leadintel_session=browser-workflow','Content-Type':'application/json'},body:JSON.stringify(body)}),env);assert.equal(r.status,200,await r.clone().text());return r.json();}
const created=await flow('',{action:'create',name:'Sweden manufacturers',workspaceVersion:1});await flow(created.id,{action:'open',revision:1,workspaceVersion:1});
const saved=await getCustomerState(env,workspace),html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/customer/app-shell.css"><link rel="stylesheet" href="/customer/styles.css"><link rel="stylesheet" href="/customer/approved-workflow.css"></head><body><div class="page-shell"><header class="topbar"><a class="brand">LeadIntel</a><div class="top-actions"><button id="open-crm">CRM</button><span class="autosave"></span></div></header><main></main></div><script>window.LeadIntelApiTransport={firstPartyUrl:u=>{const x=new URL(u);return x.pathname+x.search}};</script><script src="/customer/server-bridge.js"></script><script src="/customer/my-flows.js"></script><script src="/customer/my-flows-ui.js"></script><script src="/customer/topbar.js"></script></body></html>`;
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://local');let response;
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(url.pathname.startsWith('/customer/')){const file=path.join(root,url.pathname);res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'application/javascript');res.end(await fs.readFile(file));return;}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString();
 if(url.pathname.startsWith('/api/flows'))response=await handleSavedFlowRoute(new Request(url,{method:req.method,headers:req.headers,...(raw?{body:raw}:{})}),env);
 else {let data={configured:false,connected:false};
  if(url.pathname==='/api/session')data={authenticated:true,user:{id:user,name:'Owner'}};
  if(url.pathname==='/api/workspaces')data={workspaces:[{id:workspace,name:'Test workspace',role:'owner'}]};
  if(url.pathname==='/api/customer/state'){if(req.method==='PUT'){const body=JSON.parse(raw),result=await putCustomerState(env,{workspaceId:workspace,userId:user,expectedVersion:body.version,schemaVersion:body.schema_version,payload:body.payload,role:'owner'});if(result.conflict)throw Error('Unexpected local sync conflict');data={saved:true,version:result.state.version};}else data=await getCustomerState(env,workspace);}
  response=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 }
 res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await response.text());
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});await context.addCookies([{name:'leadintel_session',value:'browser-workflow',url:origin}]);
 await context.addInitScript(({payload,workspace,version})=>{if(localStorage.getItem('workflow-test-initialized'))return;localStorage.setItem('workflow-test-initialized','1');for(const [part,key]of Object.entries({main:'leadintel_customer_v2_state',outreach:'leadintel_customer_v2_outreach',discovery:'leadintel_customer_v2_discovery',delivery:'leadintel_customer_v2_delivery'}))localStorage.setItem(key,JSON.stringify(payload[part]||{}));localStorage.setItem('leadintel_customer_v2_workspace',workspace);sessionStorage.setItem('leadintel_customer_v2_server_hydration',workspace+':'+version);},{payload:saved.payload,workspace,version:saved.version});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.waitForFunction(()=>window.LeadIntelServerBridge?.ready&&window.LeadIntelMyFlows?.current()?.name==='Sweden manufacturers');
 await page.locator('#topbar-workflow-btn').click();await page.locator('[data-workflow-manage]').click();await page.locator('[data-flow-checkpoint]').click();await page.getByText('Protected version saved.',{exact:false}).waitFor();
 await page.locator(`[data-flow-versions="${created.id}"]`).click();await page.locator('[data-flow-version="1"]').click();await page.getByText('Version copied into a separate paused workflow.',{exact:false}).waitFor();
 await page.locator(`[data-flow-duplicate="${created.id}"]`).click();await page.locator('[data-flow-editor] [name=name]').fill('Finland manufacturers');await page.locator('[data-flow-editor] [name=markets]').fill('Finland');await page.locator('[data-flow-editor] button').filter({hasText:'Save'}).click();await page.getByText('Copy saved and paused.',{exact:false}).waitFor();
 const copy=env.DB.raw.prepare("SELECT * FROM saved_flows WHERE name='Finland manufacturers'").get();assert.equal(copy.status,'paused');assert.equal(copy.approved_at,null);
 await page.locator(`[data-flow-open="${copy.id}"]`).click();await page.waitForFunction(id=>window.LeadIntelMyFlows?.current()?.id===id,copy.id);
 await page.evaluate(async()=>{const key='leadintel_customer_v2_state',main=JSON.parse(localStorage.getItem(key));main.website='https://copy.example';localStorage.setItem(key,JSON.stringify(main));const saved=await window.LeadIntelServerBridge.saveNow({saveIntent:true});if(!saved.saved)throw Error('Browser save failed');});
 await page.reload();await page.waitForFunction(id=>window.LeadIntelMyFlows?.current()?.id===id,copy.id);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).website),'https://copy.example');
 await page.locator('#topbar-workflow-btn').click();await page.locator(`[data-workflow-id="${created.id}"]`).click();await page.waitForFunction(id=>window.LeadIntelMyFlows?.current()?.id===id,created.id);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_state')).website),'https://original.example');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('leadintel_customer_v2_outreach')).messageStudio.myTemplates[0].body),'Keep this exact script.');
 await page.setViewportSize({width:390,height:844});const crm=await page.locator('#open-crm').boundingBox(),flowBox=await page.locator('#topbar-workflow').boundingBox();assert.ok(Math.abs(crm.y+crm.height/2-flowBox.y-flowBox.height/2)<12,'Workflow must remain beside CRM on mobile');await page.screenshot({path:'/tmp/workflow-topbar-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS: topbar → protected version → duplicate → edit → reload → switch back; exact original settings/scripts preserved; automation paused.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
