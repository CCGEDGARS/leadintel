import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(new URL('../migrations/0014_market_monitoring.sql',import.meta.url),'utf8');
const wrangler=fs.readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');

test('market monitoring has durable configuration, run, evidence and alert ledgers',()=>{
  for(const table of ['market_monitoring_configs','market_monitoring_runs','market_monitoring_evidence','market_monitoring_alerts']){
    assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration,/frequency TEXT NOT NULL CHECK \(frequency IN \('daily','weekly','monthly'\)\)/);
  assert.match(migration,/research_depth TEXT NOT NULL CHECK \(research_depth IN \('quick','deep'\)\)/);
  assert.match(migration,/UNIQUE\(workspace_id,fingerprint\)/);
});

test('Cloudflare schedule invokes due market monitoring',()=>{
  assert.match(wrangler,/\[triggers\][\s\S]*crons\s*=\s*\["0 \* \* \* \*"\]/);
  assert.match(app,/async scheduled\([^)]*\)[\s\S]*runDueMarketMonitoring/);
});
