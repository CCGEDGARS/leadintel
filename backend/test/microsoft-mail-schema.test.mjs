import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

test('Microsoft mail migration upgrades OAuth state for PKCE and creates durable mail records',()=>{
  const migrationPath=path.join(process.cwd(),'migrations','0019_microsoft_mail.sql');
  assert.equal(fs.existsSync(migrationPath),true,'0019_microsoft_mail.sql must exist');
  const db=new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE customer_projects(id TEXT PRIMARY KEY);
    CREATE TABLE oauth_states(id_hash TEXT PRIMARY KEY,purpose TEXT NOT NULL,user_id TEXT,workspace_id TEXT,return_to TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,consumed_at TEXT);
    INSERT INTO users VALUES('u1');
    INSERT INTO workspaces VALUES('w1');
  `);
  db.exec(fs.readFileSync(migrationPath,'utf8'));
  const oauthColumns=db.prepare('PRAGMA table_info(oauth_states)').all().map(row=>row.name);
  assert.ok(oauthColumns.includes('pkce_verifier'));
  db.prepare(`INSERT INTO microsoft_mail_connections(workspace_id,user_id,microsoft_email,encrypted_refresh_token,scopes) VALUES('w1','u1','owner@example.com','encrypted','Mail.Send')`).run();
  db.prepare(`INSERT INTO microsoft_mail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,provider_status) VALUES('m1','w1','microsoft-1234567890','example.com','buyer@example.com','Subject','sent','accepted')`).run();
  assert.equal(db.prepare('SELECT COUNT(*) count FROM microsoft_mail_connections').get().count,1);
  const message=db.prepare('SELECT status,provider_status FROM microsoft_mail_messages WHERE id=?').get('m1');
  assert.equal(message.status,'sent');assert.equal(message.provider_status,'accepted');
  assert.throws(()=>db.prepare(`INSERT INTO microsoft_mail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,provider_status) VALUES('m2','w1','microsoft-1234567890','example.com','other@example.com','Subject','sent','accepted')`).run(),/UNIQUE/);
});
