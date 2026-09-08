import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('outreach automation migration defines fail-safe policy defaults and queue tables', async()=>{
  const sql=await readFile(new URL('../migrations/0015_outreach_automation.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS outreach_automation_policies/);
  assert.match(sql,/mode TEXT NOT NULL DEFAULT 'manual'/);
  assert.match(sql,/enabled INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql,/workspace_daily_limit INTEGER NOT NULL DEFAULT 20/);
  assert.match(sql,/mailbox_daily_limit INTEGER NOT NULL DEFAULT 20/);
  assert.match(sql,/timezone TEXT NOT NULL DEFAULT 'Europe\/Riga'/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS outreach_automation_sequences/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS outreach_automation_queue/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS outreach_automation_processed_replies/);
  assert.match(sql,/CHECK\s*\(mode IN \('manual','automatic'\)\)/);
  assert.match(sql,/CHECK\s*\(status IN \('active','stopped_reply','completed','cancelled'\)\)/);
  assert.match(sql,/cancelled_reply/);
  assert.match(sql,/blocked_limit/);
});
