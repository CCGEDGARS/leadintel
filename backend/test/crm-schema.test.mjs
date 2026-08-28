import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '..',
  'migrations',
  '0011_master_crm.sql'
);

function readMigration() {
  assert.ok(
    fs.existsSync(migrationPath),
    '0011_master_crm.sql is missing'
  );
  return fs.readFileSync(migrationPath, 'utf8');
}

test('master crm migration defines all durable crm tables', () => {
  const migration = readMigration();

  for (const table of [
    'crm_companies',
    'crm_contacts',
    'crm_intelligence',
    'crm_activities'
  ]) {
    assert.match(
      migration,
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, 'i')
    );
  }
});

test('crm companies enforce workspace scoped domain identity', () => {
  const migration = readMigration();

  assert.match(
    migration,
    /UNIQUE\s*\(\s*workspace_id\s*,\s*normalized_domain\s*\)/i
  );

  assert.match(
    migration,
    /lifecycle_status[\s\S]*prospect[\s\S]*customer[\s\S]*archived[\s\S]*suppressed/i
  );

  assert.match(
    migration,
    /pipeline_stage[\s\S]*Discovered[\s\S]*Qualified[\s\S]*Ready for Outreach[\s\S]*Contacted[\s\S]*Replied[\s\S]*Meeting[\s\S]*Proposal[\s\S]*Won[\s\S]*Lost/i
  );
});

test('crm contacts support email and external person deduplication', () => {
  const migration = readMigration();

  assert.match(
    migration,
    /external_person_id\s+TEXT/i
  );

  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_workspace_email/i
  );

  assert.match(
    migration,
    /workspace_id\s*,\s*normalized_email/i
  );

  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_external_person/i
  );
});

test('every durable crm table is workspace scoped', () => {
  const migration = readMigration();

  for (const table of [
    'crm_companies',
    'crm_contacts',
    'crm_intelligence',
    'crm_activities'
  ]) {
    const pattern = new RegExp(
      `CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\);`,
      'i'
    );

    const match = migration.match(pattern);

    assert.ok(match, `missing ${table} table definition`);
    assert.match(
      match[1],
      /workspace_id\s+TEXT\s+NOT NULL/i,
      `${table} must be workspace scoped`
    );
  }
});

test('crm relationships preserve company ownership boundaries', () => {
  const migration = readMigration();

  assert.match(
    migration,
    /FOREIGN KEY\s*\(\s*company_id\s*\)\s+REFERENCES\s+crm_companies\s*\(\s*id\s*\)/i
  );

  assert.match(
    migration,
    /FOREIGN KEY\s*\(\s*contact_id\s*\)\s+REFERENCES\s+crm_contacts\s*\(\s*id\s*\)/i
  );
});
