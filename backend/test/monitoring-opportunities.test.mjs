import test from 'node:test';
import assert from 'node:assert/strict';
import {universalFixture,courtText} from './universal-monitoring-fixture.mjs';
import {handleMarketMonitoringRoute,runDueMarketMonitoring} from '../src/market-monitoring.js';
import app from '../src/app.js';
const call=async(f,path,method='GET',body)=>{const r=await handleMarketMonitoringRoute(f.request(path,method,body),f.env),value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;};
const schedule=async f=>{const pending=[],noop=async()=>({});const jobs=new Proxy({runDueMarketMonitoring},{get:(target,key)=>target[key]||noop});await app.scheduled({cron:'0 * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},jobs);await Promise.all(pending);};
test('registered schedule, persistent opportunity counts, history, duplicate suppression and explained source amendments',async()=>{
 const f=await universalFixture(),original=globalThis.fetch;let text=courtText,reads=0,fail=false;
 globalThis.fetch=async()=>{reads++;return fail?Response.json({error:'credits exhausted'},{status:402}):Response.json({success:true,data:{markdown:text,metadata:{title:'Public civil notice'}}});};
 try{
  await call(f,'/config','PUT',{enabled:true,frequency:'daily',researchDepth:'quick',minimumScore:30,customSources:['https://court.example/civil'],workflow:{purpose:'court',readMode:'page',queryTerms:['Hearing']}});
  await schedule(f);const first=await call(f,'/inbox');assert.equal(first.opportunities,1);assert.equal(first.needsReview,0);assert.equal(first.monitors[0].latestRun.status,'completed');assert.ok(first.monitors[0].lastSuccessfulAt);const id=first.findings[0].id;
  await call(f,'/inbox/'+id);assert.equal((await call(f,'/inbox/summary')).opportunities,1,'opening never consumes a count');
  const readCount=reads;await schedule(f);assert.equal(reads,readCount,'not due means no provider operation');
  await call(f,'/inbox/'+id,'PATCH',{revision:1,status:'reviewed'});await call(f,'/run','POST');assert.equal((await call(f,'/inbox/summary')).opportunities,0,'identical reread stays reviewed');
  assert.equal((await call(f,'/inbox?status=reviewed&q=C-2026-5')).findings.length,1);
  text=text.replace('2026-11-25','2026-12-02');await call(f,'/run','POST');const updated=await call(f,'/inbox/'+id);assert.equal(updated.finding.revision,2);assert.equal(updated.versions.length,2);assert.match(updated.finding.event.changes.join(' '),/Event date: 2026-11-25 → 2026-12-02/);assert.equal((await call(f,'/inbox/summary')).opportunities,1);
  await call(f,'/inbox/'+id,'PATCH',{revision:2,status:'dismissed'});assert.equal((await call(f,'/inbox?status=dismissed&q=Example')).findings.length,1);assert.equal((await call(f,'/inbox?status=dismissed&q=%25')).findings.length,0,'search treats percent literally');
  const lastSuccess=(await call(f,'/inbox')).monitors[0].lastSuccessfulAt;fail=true;f.DB.raw.prepare("UPDATE market_monitoring_configs SET next_run_at='2000-01-01T00:00:00Z'").run();await schedule(f);const health=(await call(f,'/monitors')).monitors[0];assert.equal(health.latestRun.status,'failed');assert.equal(health.latestRun.error,'provider_credits_exhausted');assert.equal(health.lastSuccessfulAt,lastSuccess);assert.ok(health.nextRunAt);assert.equal((await call(f,'/inbox')).total,1,'provider failures preserve history');
 }finally{globalThis.fetch=original;f.DB.raw.close();}
});
test('threshold passes sort ahead of newer unverified findings and history, with separate workspace counts and exact pagination',async()=>{
 const f=await universalFixture(),original=globalThis.fetch;let text='Event ID: R-1\nPublished: 2026-11-19\nEngineering facility update';
 globalThis.fetch=async()=>Response.json({success:true,data:{markdown:text,metadata:{title:'Public update'}}});
 try{
  await call(f,'/config','PUT',{enabled:true,researchDepth:'quick',minimumScore:30,customSources:['https://source.example/news'],workflow:{purpose:'custom',readMode:'page',queryTerms:['Engineering']}});
  await call(f,'/run','POST');text='Event ID: R-2\nUnrelated announcement';await call(f,'/run','POST');
  const r=await call(f,'/inbox');assert.equal(r.opportunities,1);assert.equal(r.needsReview,1);assert.equal(r.findings[0].event.reference,'R-1');assert.equal(r.findings[0].assessment.matchedTerms[0],'Engineering');assert.equal(r.findings[0].event.publishedAt,'2026-11-19');assert.equal(r.findings[0].event.bodyText,undefined);assert.equal((await call(f,'/inbox?status=needs_review')).findings.length,1);assert.equal((await call(f,'/inbox?status=opportunities')).findings.length,1);
  const q=r.findings[0];await call(f,'/inbox/'+q.id,'PATCH',{revision:1,status:'reviewed'});assert.equal((await call(f,'/inbox/summary')).opportunities,0);assert.equal((await call(f,'/inbox')).findings[0].event.reference,'R-2');
  // Unknown legacy assessments must not silently become qualifying opportunities.
  f.DB.raw.prepare("UPDATE monitoring_findings SET assessment_json='{}' WHERE status='new'").run();assert.equal((await call(f,'/inbox/summary')).needsReview,1);
  const columns='id,workspace_id,event_key,purpose,title,source_url,event_json,assessment_json,fingerprint';for(let i=0;i<29;i++)f.DB.raw.prepare(`INSERT INTO monitoring_findings(${columns}) VALUES(?,?,?,?,?,?,?,?,?)`).run('pagination-'+i,f.workspaceId,'pagination-'+i,'custom','History '+i,'https://source.example/'+i,'{}','{}','pagination-'+i);
  const page=await call(f,'/inbox');assert.equal(page.findings.length,30);assert.equal(page.hasMore,true);const last=await call(f,'/inbox?offset=30');assert.equal(last.findings.length,1);assert.equal(last.hasMore,false);
 }finally{globalThis.fetch=original;f.DB.raw.close();}
});
