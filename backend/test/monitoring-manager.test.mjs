import test from 'node:test';
import assert from 'node:assert/strict';
import {universalFixture,courtText} from './universal-monitoring-fixture.mjs';
import {handleMarketMonitoringRoute} from '../src/market-monitoring.js';
const call=async(f,path,method='GET',body)=>{const r=await handleMarketMonitoringRoute(f.request(path,method,body),f.env);return {status:r.status,...await r.json()};};
const category={name:'Civil hearings',description:'Public civil hearings and named parties',purpose:'court',queryTerms:['hearing'],excludeTerms:['criminal']};
const config={name:'Court daily',enabled:false,frequency:'daily',researchDepth:'quick',minimumScore:30,customSources:['https://court.example/civil'],workflow:{purpose:'court',readMode:'page',queryTerms:['hearing']}};
async function stubPage(fn){const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({success:true,data:{markdown:courtText,metadata:{title:'Public hearing'}}});try{return await fn();}finally{globalThis.fetch=old;}}
test('workspace categories save/reopen and two independent monitor drafts preserve legacy settings',async()=>{const f=await universalFixture();try{
 const legacy=await call(f,'/config','PUT',{enabled:true,frequency:'weekly',researchDepth:'quick',customSources:['https://jobs.example/']});
 const c=await call(f,'/categories','POST',category);assert.equal(c.status,200);assert.equal(c.category.name,category.name);
 const a=await call(f,'/monitors','POST',{...config,workflow:{...config.workflow,categoryId:c.category.id}});assert.equal(a.status,200);const b=await call(f,'/monitors','POST',{...config,name:'Second court'});assert.equal(b.status,200);assert.notEqual(a.monitor.id,b.monitor.id);
 const list=await call(f,'/monitors');assert.equal(list.monitors.length,3);assert.equal(list.monitors.find(m=>m.id==='legacy').revision,legacy.config.revision);assert.equal(list.monitors.find(m=>m.id==='legacy').frequency,'weekly');
 const req=f.request('/categories');const u=new URL(req.url);u.searchParams.set('workspace_id','storage-w2');const r=await handleMarketMonitoringRoute(new Request(u,req),f.env);assert.deepEqual((await r.json()).categories,[]);
 assert.equal((await call(f,'/categories/'+c.category.id,'PUT',{...category,revision:0})).status,409);
}finally{f.DB.raw.close();}});
test('one-page preview spends one public read and enables only matching fresh monitor settings',async()=>stubPage(async()=>{const f=await universalFixture();try{
 const m=await call(f,'/monitors','POST',config);assert.equal(m.status,200);assert.equal((await call(f,'/monitors/'+m.monitor.id,'PUT',{...m.monitor,enabled:true})).status,409);
 const p=await call(f,'/previews','POST',{config:m.monitor,url:config.customSources[0]});assert.equal(p.status,200);assert.equal(p.preview.events[0].fields.caseNumber,'C-2026-5');assert.equal(p.preview.canActivate,true);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM monitoring_findings').get().n,0);
 let r=await call(f,'/monitors/'+m.monitor.id,'PUT',{...m.monitor,enabled:true,previewId:p.preview.id});assert.equal(r.status,200);assert.equal(r.monitor.enabled,true);
 r=await call(f,'/monitors/'+m.monitor.id,'PUT',{...r.monitor,workflow:{...r.monitor.workflow,queryTerms:['different']},previewId:p.preview.id});assert.equal(r.status,409);
}finally{f.DB.raw.close();}}));
test('category metadata rename preserves active monitors; changed criteria pause linked monitors and quota-full pause remains possible',async()=>stubPage(async()=>{const f=await universalFixture();try{
 const c=(await call(f,'/categories','POST',category)).category;const draft=(await call(f,'/monitors','POST',{...config,workflow:{...config.workflow,categoryId:c.id}})).monitor;
 const p=(await call(f,'/previews','POST',{config:draft,url:config.customSources[0]})).preview;const m=(await call(f,'/monitors/'+draft.id,'PUT',{...draft,enabled:true,previewId:p.id})).monitor;assert.equal(m.enabled,true);
 let edit=await call(f,'/categories/'+c.id,'PUT',{...category,name:'Public civil hearings',revision:c.revision});assert.equal(edit.status,200);assert.equal((await call(f,'/monitors')).monitors.find(x=>x.id===m.id).enabled,true);
 edit=await call(f,'/categories/'+c.id,'PUT',{...category,queryTerms:['new criteria'],revision:edit.category.revision});assert.equal(edit.status,200);assert.equal((await call(f,'/monitors')).monitors.find(x=>x.id===m.id).enabled,false);
 const row=f.DB.raw.prepare('SELECT * FROM monitoring_monitors WHERE id=?').get(m.id);f.DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=MAX(1,records_bytes)').run();assert.equal((await call(f,'/monitors/'+m.id+'/pause','POST',{revision:row.revision})).status,200);
}finally{f.DB.raw.close();}}));
test('preview discards late data after membership revocation and rejects private/restricted pages',async()=>{const f=await universalFixture(),old=globalThis.fetch;try{
 assert.equal((await call(f,'/previews','POST',{config,url:'http://127.0.0.1/private'})).status,400);
 const draft=(await call(f,'/monitors','POST',config)).monitor;globalThis.fetch=async()=>Response.json({success:true,data:{markdown:'Access denied. Sign in to continue.'}});const p=await call(f,'/previews','POST',{config:draft,url:config.customSources[0]});assert.equal(p.preview.canActivate,false);
 globalThis.fetch=async()=>{f.DB.raw.prepare("DELETE FROM workspace_members WHERE workspace_id='storage-w1'").run();return Response.json({success:true,data:{markdown:courtText}});};assert.equal((await call(f,'/previews','POST',{config:draft,url:config.customSources[0]})).status,403);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM monitoring_previews WHERE can_activate=1').get().n,0);
}finally{globalThis.fetch=old;f.DB.raw.close();}});
test('named monitors keep independent runs, source identities and inbox ownership',async()=>stubPage(async()=>{const f=await universalFixture();try{
 const a=(await call(f,'/monitors','POST',config)).monitor,b=(await call(f,'/monitors','POST',{...config,name:'Second'})).monitor;
 for(const m of [a,b]){const r=await call(f,'/monitors/'+m.id+'/run','POST');assert.equal(r.run.status,'completed');}
 const inbox=await call(f,'/inbox');assert.equal(inbox.findings.length,2);assert.deepEqual(new Set(inbox.findings.map(x=>x.monitor_id)),new Set([a.id,b.id]));
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM market_monitoring_evidence').get().n,2);
 await call(f,'/monitors/'+a.id+'/run','POST');assert.equal((await call(f,'/monitors/'+a.id+'/runs')).runs.length,2);assert.equal((await call(f,'/monitors/'+b.id+'/runs')).runs.length,1);assert.equal((await call(f,'/runs')).runs.length,0);
 assert.equal((await call(f,'/inbox?monitor_id='+a.id)).findings.length,1);
}finally{f.DB.raw.close();}}));
test('preview receipts cannot be reused by another monitor, after expiry or after settings change during the read',async()=>stubPage(async()=>{const f=await universalFixture();try{
 const a=(await call(f,'/monitors','POST',config)).monitor,b=(await call(f,'/monitors','POST',{...config,name:'Same source, different monitor'})).monitor;
 const p=(await call(f,'/previews','POST',{config:a,url:config.customSources[0]})).preview;assert.equal((await call(f,'/monitors/'+b.id,'PUT',{...b,enabled:true,previewId:p.id})).status,409);
 f.DB.raw.prepare("UPDATE monitoring_previews SET expires_at='2000-01-01T00:00:00Z' WHERE id=?").run(p.id);assert.equal((await call(f,'/monitors/'+a.id,'PUT',{...a,enabled:true,previewId:p.id})).status,409);
 const fetch=globalThis.fetch;globalThis.fetch=async(...args)=>{f.DB.raw.prepare('UPDATE monitoring_monitors SET revision=revision+1 WHERE id=?').run(a.id);return fetch(...args);};assert.equal((await call(f,'/previews','POST',{config:a,url:config.customSources[0]})).status,409);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM monitoring_previews WHERE can_activate=1 AND expires_at>datetime('now')").get().n,0);
}finally{f.DB.raw.close();}}));
test('concurrent monitors never mark each other expired or merge unchanged evidence',async()=>{const f=await universalFixture(),old=globalThis.fetch;let release,entered;const ready=new Promise(r=>entered=r),waiting=new Promise(r=>release=r);let calls=0;try{
 const a=(await call(f,'/monitors','POST',config)).monitor,b=(await call(f,'/monitors','POST',{...config,name:'Concurrent'})).monitor;globalThis.fetch=async()=>{if(++calls===1){entered();await waiting;}return Response.json({success:true,data:{markdown:courtText}});};
 const pending=call(f,'/monitors/'+a.id+'/run','POST');await ready;assert.equal((await call(f,'/monitors/'+b.id+'/run','POST')).run.status,'completed');assert.equal(f.DB.raw.prepare('SELECT status FROM market_monitoring_runs WHERE monitor_id=?').get(a.id).status,'running');release();assert.equal((await pending).run.status,'completed');assert.equal((await call(f,'/inbox')).findings.length,2);
}finally{release?.();globalThis.fetch=old;f.DB.raw.close();}});
test('archive retains findings and can commit at the full content quota',async()=>stubPage(async()=>{const f=await universalFixture();try{
 const c=(await call(f,'/categories','POST',category)).category,m=(await call(f,'/monitors','POST',{...config,workflow:{...config.workflow,categoryId:c.id}})).monitor;await call(f,'/monitors/'+m.id+'/run','POST');const bytes=f.DB.raw.prepare("SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().records_bytes;assert.ok(bytes>0);f.DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=MAX(1,records_bytes)').run();
 assert.equal((await call(f,'/categories/'+c.id,'PUT',{...category,revision:c.revision,archived:true})).status,200);const current=(await call(f,'/monitors')).monitors.find(x=>x.id===m.id);assert.equal((await call(f,'/monitors/'+m.id+'/archive','POST',{revision:current.revision})).status,200);assert.equal((await call(f,'/inbox')).findings.length,1);assert.equal((await call(f,'/monitors/'+m.id+'/run','POST')).status,409);assert.equal(f.DB.raw.prepare("SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().records_bytes,bytes);
}finally{f.DB.raw.close();}}));
