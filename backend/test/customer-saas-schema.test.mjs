import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath=path.join(process.cwd(),'migrations','0009_customer_saas.sql');

test('production SaaS migration defines workspace state, OAuth and Gmail tables',()=>{
  assert.equal(fs.existsSync(migrationPath),true,'0009_customer_saas.sql must exist');
  const sql=fs.readFileSync(migrationPath,'utf8');
  for(const table of ['oauth_states','customer_workspace_state','gmail_connections','gmail_messages','gmail_replies']){
    assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`,'i'));
  }
  assert.match(sql,/workspace_id TEXT PRIMARY KEY[\s\S]*REFERENCES workspaces\(id\)/i);
  assert.match(sql,/payload_json TEXT NOT NULL CHECK \(json_valid\(payload_json\)\)/i);
  assert.match(sql,/UNIQUE\s*\(workspace_id\s*,\s*idempotency_key\)/i);
  assert.match(sql,/UNIQUE\s*\(workspace_id\s*,\s*gmail_message_id\)/i);
  assert.match(sql,/purpose TEXT NOT NULL CHECK \(purpose IN \('login','gmail'\)\)/i);
  assert.match(sql,/encrypted_refresh_token TEXT/i);
});
