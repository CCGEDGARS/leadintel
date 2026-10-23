import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {sha256} from '../src/security.js';

function statements(sql){
 const out=[];let current='';
 for(const line of sql.split('\n')){if(line.trim().startsWith('--')||!line.trim())continue;current+=line+'\n';
  if(current.trim().startsWith('CREATE TRIGGER')){if(line.trim()==='END;'||(line.trim().startsWith('BEGIN ')||line.trim().startsWith('CREATE TRIGGER'))&&line.trim().endsWith(' END;')){out.push(current.trim());current='';}}
  else if(line.trim().endsWith(';')){out.push(current.trim());current='';}
 }
 assert.equal(current.trim(),'');return out;
}
test('storage migration and authenticated status execute in the actual Workers D1 runtime',async()=>{
 const code="import {handleStorageRoute} from './src/workspace-storage-billing.js'; export default {fetch(request,env){return handleStorageRoute(request,env);}};";
 const built=await build({stdin:{contents:code,resolveDir:new URL('..',import.meta.url).pathname,sourcefile:'storage-worker.js'},bundle:true,write:false,format:'esm',platform:'browser',conditions:['workerd','worker','browser'],logLevel:'silent'});
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-07-20',d1Databases:{DB:'storage-test'}}));
 try{
  const DB=await mf.getD1Database('DB'),dir=new URL('../migrations/',import.meta.url);
  for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())for(const statement of statements(fs.readFileSync(new URL(name,dir),'utf8')))await DB.prepare(statement).run();
  await DB.exec("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES('"+await sha256('storage-test-session')+"','owner-edgars',datetime('now','+1 day'));");
  const response=await mf.dispatchFetch('https://worker.test/api/storage/status?workspace_id=edgars-latvia',{headers:{Cookie:'leadintel_session=storage-test-session'}});
  assert.equal(response.status,200,await response.clone().text());const data=await response.json();assert.equal(data.records.limit_bytes,100000000);assert.equal(data.billing.setup_required,true);
  assert.equal((await mf.dispatchFetch('https://worker.test/api/storage/status?workspace_id=edgars-latvia')).status,401);
  await DB.exec("UPDATE workspace_storage_accounts SET included_records_limit=2 WHERE workspace_id='edgars-latvia';");
  await assert.rejects(DB.exec("INSERT INTO content_materials(id,workspace_id,title,category,body,created_by) VALUES('m','edgars-latvia','Too big','draft','saved text','owner-edgars');"),/WORKSPACE_STORAGE_FULL/);
 }finally{await mf.dispose();}
});
