import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {storageDb} from './workspace-storage-fixture.mjs';
test('universal monitoring keeps independent people and event versions in workspace-owned durable records',()=>{
 const path=new URL('../migrations/0071_universal_monitoring.sql',import.meta.url);assert.ok(fs.existsSync(path),'universal monitoring schema exists');const db=storageDb();
 try{for(const table of ['monitoring_findings','monitoring_finding_versions','monitoring_subjects','monitoring_messages'])assert.ok(db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
  db.raw.prepare("INSERT INTO monitoring_findings(id,workspace_id,event_key,purpose,title,source_url,event_json,assessment_json,fingerprint) VALUES('f','storage-w1','case-1','court','Hearing','https://court.example/1','{}','{}','v1')").run();
  db.raw.prepare("INSERT INTO monitoring_subjects(id,workspace_id,finding_id,subject_key,kind,name,role,source_quote) VALUES('p','storage-w1','f','party-1','person','Alex Rowan','Claimant','Claimant (individual): Alex Rowan')").run();
  assert.equal(db.raw.prepare("SELECT kind FROM monitoring_subjects WHERE id='p'").get().kind,'person');assert.equal(db.raw.prepare('SELECT count(*) n FROM crm_companies').get().n,0);
  assert.throws(()=>db.raw.prepare("INSERT INTO monitoring_subjects(id,workspace_id,finding_id,subject_key,kind,name) VALUES('wrong','storage-w2','f','x','person','Other')").run(),/FOREIGN KEY/);
 }finally{db.raw.close();}
});
test('workflow configuration and finding versions count UTF-8 bytes and full quota rolls back the whole record batch',async()=>{
 const path=new URL('../migrations/0072_universal_monitoring_storage.sql',import.meta.url);assert.ok(fs.existsSync(path),'universal storage accounting exists');const db=storageDb();
 try{db.raw.prepare("INSERT INTO market_monitoring_configs(workspace_id,frequency,research_depth,workflow_json) VALUES('storage-w1','daily','quick','{}')").run();const before=db.raw.prepare("SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().records_bytes;
  const text=JSON.stringify({queryTerms:['tērauds €']});db.raw.prepare("UPDATE market_monitoring_configs SET workflow_json=? WHERE workspace_id='storage-w1'").run(text);const after=db.raw.prepare("SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().records_bytes;assert.equal(after-before,Buffer.byteLength(text)-2);
  db.raw.prepare("UPDATE workspace_storage_accounts SET included_records_limit=records_bytes+5 WHERE workspace_id='storage-w1'").run();
  await assert.rejects(db.batch([db.prepare("INSERT INTO monitoring_findings(id,workspace_id,event_key,purpose,title,source_url,event_json,assessment_json,fingerprint) VALUES('full','storage-w1','full','custom','This is too much evidence','https://source.example/','{}','{}','v1')")]),/WORKSPACE_STORAGE_FULL/);assert.equal(db.raw.prepare("SELECT count(*) n FROM monitoring_findings WHERE id='full'").get().n,0);
 }finally{db.raw.close();}
});
