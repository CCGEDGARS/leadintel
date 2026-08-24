import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath=path.join(process.cwd(),'migrations','0009_customer_saas.sql');
const aiMigrationPath=path.join(process.cwd(),'migrations','0010_workspace_ai_integrations.sql');

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

test('AI integration migration stores encrypted provider keys per workspace with one active provider',()=>{
  assert.equal(fs.existsSync(aiMigrationPath),true,'0010_workspace_ai_integrations.sql must exist');
  const sql=fs.readFileSync(aiMigrationPath,'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS workspace_ai_integrations\s*\(/i);
  assert.match(sql,/workspace_id TEXT NOT NULL REFERENCES workspaces\(id\) ON DELETE CASCADE/i);
  assert.match(sql,/provider TEXT NOT NULL CHECK \(provider IN \('openai','anthropic','gemini'\)\)/i);
  assert.match(sql,/encrypted_api_key TEXT NOT NULL/i);
  assert.match(sql,/key_hint TEXT NOT NULL/i);
  assert.match(sql,/PRIMARY KEY\s*\(workspace_id\s*,\s*provider\)/i);
  assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS workspace_ai_integrations_one_active_idx[\s\S]*WHERE active=1/i);
  assert.doesNotMatch(sql,/api_key\s+TEXT\s+NOT NULL/i,'raw API key column must never exist');
});
