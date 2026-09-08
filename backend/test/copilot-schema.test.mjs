import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath=path.join(process.cwd(),'migrations','0016_ai_copilot.sql');
const sql=fs.existsSync(migrationPath)?fs.readFileSync(migrationPath,'utf8'):'';

function tableSection(name){
  const match=sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\(([\\s\\S]*?)\\n\\);`,'i'));
  return match?.[1]||'';
}

test('copilot migration exists and defines all durable workspace-scoped tables',()=>{
  assert.equal(fs.existsSync(migrationPath),true,'0016_ai_copilot.sql must exist');
  for(const table of ['copilot_conversations','copilot_messages','copilot_memories','copilot_diagnostics','copilot_action_proposals']){
    assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`,'i'));
  }
});

test('copilot conversations and messages are workspace scoped and cascade safely',()=>{
  const conversations=tableSection('copilot_conversations');
  const messages=tableSection('copilot_messages');
  assert.match(conversations,/workspace_id TEXT NOT NULL REFERENCES workspaces\(id\) ON DELETE CASCADE/i);
  assert.match(messages,/workspace_id TEXT NOT NULL REFERENCES workspaces\(id\) ON DELETE CASCADE/i);
  assert.match(messages,/conversation_id TEXT NOT NULL REFERENCES copilot_conversations\(id\) ON DELETE CASCADE/i);
});

test('copilot memory, diagnostics and action proposal enums are allowlisted',()=>{
  assert.match(tableSection('copilot_memories'),/kind TEXT NOT NULL CHECK \(kind IN \('decision','preference','constraint'\)\)/i);
  const diagnostics=tableSection('copilot_diagnostics');
  assert.match(diagnostics,/category TEXT NOT NULL CHECK \(category IN \('completeness','consistency','quality','evidence','readiness'\)\)/i);
  assert.match(diagnostics,/severity TEXT NOT NULL CHECK \(severity IN \('info','improve','important'\)\)/i);
  assert.match(diagnostics,/status TEXT NOT NULL DEFAULT 'open' CHECK \(status IN \('open','resolved','dismissed'\)\)/i);
  const proposals=tableSection('copilot_action_proposals');
  assert.match(proposals,/action_type TEXT NOT NULL CHECK \(action_type IN \('signal\.add','signal\.update','icp\.update_field'\)\)/i);
  assert.match(proposals,/status TEXT NOT NULL DEFAULT 'proposed' CHECK \(status IN \('proposed','confirmed','applied','rejected','expired','failed'\)\)/i);
});

test('copilot JSON persistence is validated and action idempotency is unique per workspace',()=>{
  for(const field of ['metadata_json','value_json','details_json','payload_json','preview_json','result_json']){
    assert.match(sql,new RegExp(`${field} TEXT[^\\n]*CHECK \\(json_valid\\(${field}\\)\\)`,'i'),`${field} must be json_valid checked`);
  }
  assert.match(tableSection('copilot_action_proposals'),/UNIQUE\s*\(workspace_id\s*,\s*idempotency_key\)/i);
});

test('copilot persistence schema has no credential, token or secret storage columns',()=>{
  const columnNames=[...sql.matchAll(/^\s*([a-z_][a-z0-9_]*)\s+(?:TEXT|INTEGER|REAL|BLOB)\b/gim)].map(match=>match[1].toLowerCase());
  const forbidden=columnNames.filter(name=>/(?:^|_)(?:api_?key|credential|password|secret|access_?token|refresh_?token|cookie)(?:_|$)/i.test(name));
  assert.deepEqual(forbidden,[],'Copilot schema must not store credentials/tokens/secrets');
});

test('copilot migration defines indexes for conversation history, unresolved diagnostics and proposal status',()=>{
  assert.match(sql,/CREATE INDEX IF NOT EXISTS copilot_conversations_workspace_idx\s+ON copilot_conversations\(workspace_id,updated_at DESC\)/i);
  assert.match(sql,/CREATE INDEX IF NOT EXISTS copilot_messages_conversation_idx\s+ON copilot_messages\(workspace_id,conversation_id,created_at\)/i);
  assert.match(sql,/CREATE INDEX IF NOT EXISTS copilot_diagnostics_open_idx\s+ON copilot_diagnostics\(workspace_id,status,severity,updated_at DESC\)/i);
  assert.match(sql,/CREATE INDEX IF NOT EXISTS copilot_action_proposals_status_idx\s+ON copilot_action_proposals\(workspace_id,status,created_at DESC\)/i);
});
