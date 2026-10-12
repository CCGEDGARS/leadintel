import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {storageDb} from './workspace-storage-fixture.mjs';
test('production migration uses the documented file importer and commits its ledger with the unchanged storage SQL',async()=>{
 assert.ok(fs.existsSync(new URL('../scripts/migrate-d1-files.mjs',import.meta.url)),'file-import migration runner is missing');
 const {applyPendingMigrations}=await import('../scripts/migrate-d1-files.mjs');
 const DB=storageDb({skipStorageMigration:true});DB.raw.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)');
 const dir=new URL('../migrations/',import.meta.url);for(const name of fs.readdirSync(dir).filter(x=>x<'0031_').sort())DB.raw.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(name);
 const calls=[];
 const fetchImpl=async(url,options)=>{const body=JSON.parse(options.body);DB.raw.exec(body.sql.startsWith('CREATE TABLE')?body.sql:'');return Response.json({success:true,result:[{success:true,results:body.sql.startsWith('SELECT')?DB.raw.prepare(body.sql).all():[]}]});};
 const runWrangler=async args=>{calls.push(args);assert.ok(args.includes('--file'));assert.equal(args.includes('--command'),false);const sql=fs.readFileSync(args[args.indexOf('--file')+1],'utf8');assert.ok(sql.includes(fs.readFileSync(new URL('0031_workspace_storage.sql',dir),'utf8')));DB.raw.exec('BEGIN');try{DB.raw.exec(sql);DB.raw.exec('COMMIT');}catch(e){DB.raw.exec('ROLLBACK');throw e;}};
 const options={environment:{CLOUDFLARE_API_TOKEN:'fixture',CLOUDFLARE_ACCOUNT_ID:'fixture-account'},fetchImpl,runWrangler,log(){}};
 await applyPendingMigrations(options);assert.equal(calls.length,1);assert.equal(DB.raw.prepare("SELECT count(*) n FROM d1_migrations WHERE name='0031_workspace_storage.sql'").get().n,1);
 await applyPendingMigrations(options);assert.equal(calls.length,1);
 assert.equal(DB.raw.prepare("SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id='storage-w1'").get().records_bytes,0);
});
