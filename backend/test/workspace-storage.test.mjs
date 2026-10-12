import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {storageDb} from './workspace-storage-fixture.mjs';

test('storage migration adds server-authoritative usage without removing existing content',async()=>{
 assert.ok(fs.existsSync(new URL('../migrations/0031_workspace_storage.sql',import.meta.url)),'workspace storage migration is missing');
 const DB=storageDb({beforeMigration(raw){raw.exec("INSERT INTO content_materials(id,workspace_id,title,category,body,created_by) VALUES('m1','storage-w1','Latvian','draft','Ābols 🍏','storage-owner')");}});
 const {getStorageStatus}=await import('../src/workspace-storage.js');
 const status=await getStorageStatus({DB},'storage-w1');
 assert.ok(status.records.used_bytes>=Buffer.byteLength('Ābols 🍏'));
 assert.equal(status.records.limit_bytes,100000000);
 assert.equal(status.files.limit_bytes,1000000000);
 assert.equal(DB.raw.prepare('SELECT body FROM content_materials WHERE id=?').get('m1').body,'Ābols 🍏');
 assert.equal((await getStorageStatus({DB},'storage-w2')).records.used_bytes,0);
});

test('quota blocks concurrent growth atomically, permits reductions and expires paid capacity',async()=>{
 assert.ok(fs.existsSync(new URL('../migrations/0031_workspace_storage.sql',import.meta.url)),'workspace storage migration is missing');
 const DB=storageDb(),{getStorageStatus}=await import('../src/workspace-storage.js');
 DB.raw.exec("UPDATE workspace_storage_accounts SET included_records_limit=500 WHERE workspace_id='storage-w1'");
 const save=(id,text)=>DB.prepare("INSERT INTO content_materials(id,workspace_id,title,category,body,created_by) VALUES(?,'storage-w1','Example','draft',?,'storage-owner')").bind(id,text).run();
 const results=await Promise.allSettled([save('m1','x'.repeat(250)),save('m2','x'.repeat(250))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.match(results.find(r=>r.status==='rejected').reason.message,/WORKSPACE_STORAGE_FULL/);
 const before=(await getStorageStatus({DB},'storage-w1')).records.used_bytes;
 DB.raw.exec("UPDATE content_materials SET body='small' WHERE workspace_id='storage-w1'");
 assert.ok((await getStorageStatus({DB},'storage-w1')).records.used_bytes<before);
 DB.raw.exec("UPDATE workspace_storage_accounts SET plan_key='plus',paid_until=unixepoch()+3600 WHERE workspace_id='storage-w1'");
 await save('paid','x'.repeat(1000));
 assert.equal((await getStorageStatus({DB},'storage-w1')).plan.key,'plus');
 DB.raw.exec("UPDATE workspace_storage_accounts SET paid_until=0 WHERE workspace_id='storage-w1'");
 assert.equal((await getStorageStatus({DB},'storage-w1')).records.state,'full');
 await assert.rejects(save('next','new'),/WORKSPACE_STORAGE_FULL/);
 DB.raw.exec("DELETE FROM content_materials WHERE workspace_id='storage-w1'");
 assert.equal((await getStorageStatus({DB},'storage-w1')).records.used_bytes,0);
});

test('a failed multi-record save rolls counters and all content back together',async()=>{
 assert.ok(fs.existsSync(new URL('../migrations/0031_workspace_storage.sql',import.meta.url)),'workspace storage migration is missing');
 const DB=storageDb();DB.raw.exec("UPDATE workspace_storage_accounts SET included_records_limit=500 WHERE workspace_id='storage-w1'");
 const insert=id=>DB.prepare("INSERT INTO content_materials(id,workspace_id,title,category,body,created_by) VALUES(?,'storage-w1','Example','draft',?,'storage-owner')").bind(id,'x'.repeat(250));
 await assert.rejects(DB.batch([insert('m1'),insert('m2')]),/WORKSPACE_STORAGE_FULL/);
 assert.equal(DB.raw.prepare('SELECT count(*) n FROM content_materials').get().n,0);
 assert.equal(DB.raw.prepare("SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().records_bytes,0);
});

test('deleting a project releases child-state bytes through the actual foreign-key cascade',async()=>{
 const DB=storageDb(),{getStorageStatus}=await import('../src/workspace-storage.js');
 DB.raw.exec("INSERT INTO customer_projects(id,workspace_id,name,created_by) VALUES('project','storage-w1','Project','storage-owner'); INSERT INTO customer_project_state(project_id,payload_json) VALUES('project','{\"saved\":\"retain until deletion\"}')");
 assert.ok((await getStorageStatus({DB},'storage-w1')).records.used_bytes>0);
 DB.raw.exec("DELETE FROM customer_projects WHERE id='project'");
 assert.equal((await getStorageStatus({DB},'storage-w1')).records.used_bytes,0);
});
