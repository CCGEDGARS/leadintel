import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
test('Treg migration requires fresh paid consent and preserves encrypted credentials, limits and legacy receipts',()=>{
 const db=new DatabaseSync(':memory:');
 const migrate=file=>db.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 db.exec("CREATE TABLE workspaces(id TEXT PRIMARY KEY);INSERT INTO workspaces VALUES('w');");
 for(const file of ['0013_workspace_service_integrations.sql','0023_hunter_service_integration.sql','0041_additional_contact_services.sql','0043_additional_contact_provider_receipts.sql'])migrate(file);
 db.exec("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('w','apollo','ciphertext','masked');INSERT INTO additional_contact_policies(workspace_id,enabled,daily_limit,monthly_limit,max_per_company,approved_by) VALUES('w',1,5,100,2,'owner');INSERT INTO additional_contact_attempts(workspace_id,company_id,person_id,month,provider,status,result_json) VALUES('w','c','p','2026-10','apollo','verified','{\"preserved\":true}');");
 migrate('0045_treg_paid_search.sql');migrate('0046_treg_workspace_credentials.sql');
 db.exec("UPDATE additional_contact_policies SET enabled=1,approved_by='owner'");migrate('0047_paid_phone_permission.sql');
 const policy=db.prepare('SELECT * FROM additional_contact_policies').get();assert.equal(policy.enabled,1);assert.equal(policy.phone_enabled,0);assert.equal(policy.provider,'treg');assert.equal(policy.approved_by,'owner');assert.equal(policy.daily_limit,5);assert.equal(policy.monthly_limit,100);
 assert.equal(db.prepare('SELECT encrypted_api_key FROM workspace_service_integrations').get().encrypted_api_key,'ciphertext');assert.equal(db.prepare('SELECT result_json FROM additional_contact_attempts').get().result_json,'{"preserved":true}');
 db.exec("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint) VALUES('w','treg','other-ciphertext','masked');");assert.equal(db.prepare('SELECT count(*) n FROM workspace_service_integrations').get().n,2);db.close();
});
