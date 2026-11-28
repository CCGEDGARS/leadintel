import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';
import {handleStorageRoute} from '../src/workspace-storage-billing.js';
import {handleCompanyMaterialsRoute} from '../src/company-materials.js';
import {withWorkspaceStorage} from '../src/workspace-storage-objects.js';
import {getStorageStatus} from '../src/workspace-storage.js';

async function fixture(){
 const DB=storageDb();
 await DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner',datetime('now','+1 day'))").bind(await sha256('storage-management')).run();
 const objects=new Map();
 const env=withWorkspaceStorage({DB,APP_ORIGIN:'https://app.test',WORKSPACE_STORAGE_ENABLED:'true',WRITING_REFERENCES_BUCKET:{head:async key=>objects.has(key)?{size:objects.get(key).length}:null,put:async(key,value)=>objects.set(key,value),delete:async key=>objects.delete(key)}});
 const request=(action,{method='GET',body,workspace='storage-w1',origin='https://app.test',authenticated=true}={})=>new Request(`https://api.test/api/storage/${action}?workspace_id=${workspace}`,{method,headers:{...(authenticated?{Cookie:'leadintel_session=storage-management'}:{}),Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 return {env,DB,objects,request,call:async(action,options)=>handleStorageRoute(request(action,options),env)};
}
test('storage preferences persist independently of billing and preserve existing data at quota',async()=>{
 const f=await fixture();let response=await f.call('preferences');assert.equal(response.status,200);assert.deepEqual((await response.json()).preferences,{auto_report_copies:true,revision:0});
 f.DB.raw.exec("UPDATE workspace_storage_accounts SET included_records_limit=1 WHERE workspace_id='storage-w1'");
 response=await f.call('preferences',{method:'POST',body:{auto_report_copies:false,revision:0}});assert.equal(response.status,200);
 assert.deepEqual((await (await f.call('preferences')).json()).preferences,{auto_report_copies:false,revision:1});
 assert.equal((await f.call('preferences',{method:'POST',body:{auto_report_copies:true,revision:0}})).status,409);
 assert.equal((await (await f.call('preferences',{workspace:'storage-w2'})).json()).preferences.auto_report_copies,true);
 assert.equal((await f.call('preferences',{workspace:'storage-w2',method:'POST',body:{auto_report_copies:false,revision:0}})).status,403);
 assert.equal((await f.call('preferences',{origin:'https://evil.test',method:'POST',body:{auto_report_copies:false,revision:1}})).status,403);
 assert.equal((await f.call('preferences',{method:'POST',body:{auto_report_copies:'false',revision:1}})).status,400);
 assert.equal((await f.call('files',{authenticated:false})).status,401);
 assert.equal((await f.call('files',{workspace:'unrelated'})).status,403);
});
test('file inventory is workspace scoped; existing guarded deletion frees metered bytes at quota',async()=>{
 const f=await fixture(),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',prefix=`materials/storage-w1/${id}/`;
 await f.env.DB.prepare("INSERT INTO company_materials(id,workspace_id,filename,mime,kind,byte_size,digest,original_key,text_key,status) VALUES(?,'storage-w1','Brochure.pdf','application/pdf','pdf',20,'digest',?,?,'Ready')").bind(id,prefix+'original',prefix+'text.json').run();
 await f.env.WRITING_REFERENCES_BUCKET.put(prefix+'original','x'.repeat(20));await f.env.WRITING_REFERENCES_BUCKET.put(prefix+'text.json','y'.repeat(10));
 let data=await (await f.call('files')).json();assert.equal(data.files.length,1);assert.equal(data.files[0].bytes,30);assert.equal(data.files[0].measured,true);assert.equal(data.files[0].name,'Brochure.pdf');assert.equal(data.files[0].original_key,undefined);
 assert.equal((await (await f.call('files',{workspace:'storage-w2'})).json()).files.length,0);
 f.DB.raw.exec("UPDATE workspace_storage_accounts SET included_files_limit=1,included_records_limit=1 WHERE workspace_id='storage-w1'");
 const remove=revision=>handleCompanyMaterialsRoute(new Request(`https://api.test/api/company-materials/${id}?workspace_id=storage-w1`,{method:'DELETE',headers:{Cookie:'leadintel_session=storage-management','Content-Type':'application/json'},body:JSON.stringify({expectedRevision:revision})}),f.env);
 assert.equal((await remove(2)).status,409);assert.equal(f.objects.size,2);
 assert.equal((await remove(1)).status,200);assert.equal(f.objects.size,0);assert.equal((await getStorageStatus(f.env,'storage-w1')).files.used_bytes,0);assert.equal((await (await f.call('files')).json()).files.length,0);
});

test('inventory accounts for all measured bytes, pages items, and releases only the selected older backup',async()=>{
 const f=await fixture();
 for(let n=0;n<53;n++)f.DB.raw.prepare("INSERT INTO snapshots(id,workspace_id,payload_json,generated_at) VALUES(?,'storage-w1',?,CURRENT_TIMESTAMP)").run('backup-'+n,JSON.stringify('x'.repeat(n+1)));
 f.DB.raw.prepare("INSERT INTO snapshots(id,workspace_id,payload_json,generated_at) VALUES('peer','storage-w2','{}',CURRENT_TIMESTAMP)").run();
 const list=async()=> (await f.call('files')).json();
 const before=await list();
 assert.equal(before.usage.records,before.groups.filter(g=>g.meter==='records_bytes').reduce((n,g)=>n+g.bytes,0));
 const group=async(key,offset)=>{const url=new URL(f.request('files').url);url.searchParams.set('group',key);url.searchParams.set('offset',offset);return handleStorageRoute(new Request(url,f.request('files')),f.env);};
 for(const key of Object.keys((await import('../src/workspace-storage-models.js')).storageModels))assert.equal((await group(key,0)).status,200,key);
 const first=await (await group('snapshots',0)).json(),last=await (await group('snapshots',50)).json();
 assert.equal(first.items.length,50);assert.equal(last.items.length,3);assert.equal(first.items[0].old_backup,0);
 const remove=id=>f.call('backup',{method:'POST',body:{id}});
 assert.equal((await remove('backup-52')).status,409);assert.equal((await remove('peer')).status,409);
 assert.equal((await remove('backup-51')).status,200);
 assert.equal(before.usage.records-(await list()).usage.records,first.items[1].bytes);
 assert.equal((await remove('backup-51')).status,409);
});

test('workflow version deletion immediately releases only unshared snapshot chunks',async()=>{
 const f=await fixture(),db=f.DB.raw;
 db.exec("INSERT INTO saved_flows(id,workspace_id,name,latest_version) VALUES('flow','storage-w1','Test',3)");
 const manifest=snapshot=>JSON.stringify({format:'leadintel-workspace-records-v1',snapshot});
 for(const [v,snapshot] of [[1,'shared'],[2,'unique'],[3,'shared']]){
  db.prepare("INSERT INTO saved_flow_versions(workspace_id,flow_id,version,name,payload_json,config_json,created_by) VALUES('storage-w1','flow',?,'Test',?,'{}','storage-owner')").run(v,manifest(snapshot));
  db.prepare("INSERT OR IGNORE INTO workspace_payload_records VALUES('storage-w1',?,0,'reference content')").run(snapshot);
 }
 const del=version=>f.call('version',{method:'POST',body:{flow_id:'flow',version}});
 assert.equal((await del(3)).status,409);
 assert.equal((await del(1)).status,200);
 assert.ok(db.prepare("SELECT 1 FROM workspace_payload_records WHERE snapshot_id='shared'").get());
 const before=(await getStorageStatus(f.env,'storage-w1')).records.used_bytes;
 assert.equal((await del(2)).status,200);
 assert.ok(!(db.prepare("SELECT 1 FROM workspace_payload_records WHERE snapshot_id='unique'").get()));
 assert.ok((await getStorageStatus(f.env,'storage-w1')).records.used_bytes<before);
});
