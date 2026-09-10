import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const sql=fs.readFileSync(path.join(here,'..','migrations','0017_intelligence_sources.sql'),'utf8');

test('Intelligence Sources migration stores registry, access, auth, monitoring and health state',()=>{
  assert.match(sql,/CREATE TABLE IF NOT EXISTS intelligence_sources/);
  for(const column of ['workspace_id','canonical_url','host','source_type','geography_json','access_status','anonymous_access_status','authenticated_access_status','access_method','auth_mode','extractable_fields_json','coverage_json','reliability','monitoring_enabled','mandatory','frequency','trigger_ids_json','last_access_test_at','last_successful_extraction_at','last_status_change_at','consecutive_failures','health_status'])assert.match(sql,new RegExp(`\\b${column}\\b`),column);
  assert.match(sql,/access_status TEXT NOT NULL DEFAULT 'not_tested' CHECK \(access_status IN \('not_tested','full','partial','no_access'\)\)/);
  assert.match(sql,/auth_mode TEXT NOT NULL DEFAULT 'public' CHECK \(auth_mode IN \('public','google','username_password','api_key','subscription','manual_only'\)\)/);
  assert.match(sql,/frequency TEXT NOT NULL DEFAULT 'daily' CHECK \(frequency IN \('daily','weekly','monthly'\)\)/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS intelligence_source_audits/);
  assert.match(sql,/provider TEXT NOT NULL/);
  assert.match(sql,/method TEXT NOT NULL/);
  assert.match(sql,/content_chars INTEGER NOT NULL DEFAULT 0/);
  assert.match(sql,/extractable_fields_json TEXT NOT NULL DEFAULT '\[\]'/);
});