import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {storageDb} from './workspace-storage-fixture.mjs';

async function fixture(){
 assert.ok(fs.existsSync(new URL('../src/workspace-storage-objects.js',import.meta.url)),'private file quota boundary is missing');
 const mod=await import('../src/workspace-storage-objects.js'),DB=storageDb(),objects=new Map();
 const env={DB,WORKSPACE_STORAGE_ENABLED:'true',WRITING_REFERENCES_BUCKET:{async head(key){const v=objects.get(key);return v?{size:v.byteLength}:null;},async put(key,value){const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);objects.set(key,bytes);return {key,size:bytes.byteLength};},async delete(key){objects.delete(key);},async get(key){return objects.get(key)||null;}}};
 return {mod,DB,objects,env,wrapped:mod.withWorkspaceStorage(env)};
}
test('file reservation prevents racing uploads from exceeding quota; replacements and deletion release exact bytes',async()=>{
 const f=await fixture();f.DB.raw.exec("UPDATE workspace_storage_accounts SET included_files_limit=10 WHERE workspace_id='storage-w1'");
 const bucket=f.wrapped.WRITING_REFERENCES_BUCKET;
 const results=await Promise.allSettled([bucket.put('writing/storage-w1/a/original','12345678'),bucket.put('writing/storage-w1/b/original','12345678')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.match(results.find(x=>x.status==='rejected').reason.message,/WORKSPACE_STORAGE_FULL/);
 assert.equal(f.objects.size,1);
 const key=[...f.objects.keys()][0];await bucket.put(key,'Ā🍏');
 assert.equal(f.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().files_bytes,6);
 await bucket.delete(key);assert.equal(f.objects.size,0);
 assert.equal(f.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().files_bytes,0);
});
test('unknown legacy object bytes are measured before allowing new uploads',async()=>{
 const f=await fixture(),key='writing/storage-w1/legacy/original';f.objects.set(key,new Uint8Array(25));
 f.DB.raw.prepare("INSERT INTO workspace_storage_objects(object_key,workspace_id) VALUES(?,'storage-w1')").run(key);
 f.DB.raw.exec("UPDATE workspace_storage_accounts SET included_files_limit=20 WHERE workspace_id='storage-w1'");
 const {getStorageStatus}=await import('../src/workspace-storage.js');
 assert.equal((await getStorageStatus(f.env,'storage-w1')).files.measured,false);
 await f.mod.reconcileStorageObjects(f.env);
 assert.equal((await getStorageStatus(f.env,'storage-w1')).files.used_bytes,25);
 assert.equal((await getStorageStatus(f.env,'storage-w1')).files.state,'full');
 await assert.rejects(f.wrapped.WRITING_REFERENCES_BUCKET.put('writing/storage-w1/new/original','new'),/WORKSPACE_STORAGE_FULL/);
 await f.wrapped.WRITING_REFERENCES_BUCKET.delete(key);
 assert.equal((await getStorageStatus(f.env,'storage-w1')).files.used_bytes,0);
});
test('failed puts keep their reservation until measured recovery; failed deletion never frees bytes',async()=>{
 const f=await fixture(),key='writing/storage-w1/a/original';
 f.env.WRITING_REFERENCES_BUCKET.put=async()=>{throw Error('provider unavailable');};
 await assert.rejects(f.wrapped.WRITING_REFERENCES_BUCKET.put(key,'12345'),/provider unavailable/);
 assert.equal(f.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().files_bytes,5);
 f.DB.raw.exec('UPDATE workspace_storage_objects SET lease_until=0');await f.mod.reconcileStorageObjects(f.env);
 assert.equal(f.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().files_bytes,0);
 f.objects.set(key,new Uint8Array(8));f.DB.raw.prepare("INSERT INTO workspace_storage_objects(object_key,workspace_id,byte_size,state) VALUES(?,'storage-w1',8,'ready')").run(key);
 f.env.WRITING_REFERENCES_BUCKET.delete=async()=>{throw Error('delete failed');};
 await assert.rejects(f.wrapped.WRITING_REFERENCES_BUCKET.delete(key),/delete failed/);
 assert.equal(f.DB.raw.prepare("SELECT files_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().files_bytes,8);
 assert.equal(f.objects.has(key),true);
});
