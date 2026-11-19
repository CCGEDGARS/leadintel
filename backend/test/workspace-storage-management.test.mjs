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
