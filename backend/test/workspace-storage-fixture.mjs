import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';

export function storageDb({beforeMigration}={}){
 const raw=new DatabaseSync(':memory:');
 const migrationDir=new URL('../migrations/',import.meta.url);
 const files=fs.readdirSync(migrationDir).filter(name=>name.endsWith('.sql')).sort();
 for(const file of files.filter(name=>!name.startsWith('0031_')))raw.exec(fs.readFileSync(new URL(file,migrationDir),'utf8'));
 raw.exec("INSERT INTO users(id,email,display_name,role) VALUES('storage-owner','owner@example.test','Owner','owner'); INSERT INTO workspaces(id,name,market,owner_user_id) VALUES('storage-w1','Workspace One','LV','storage-owner'),('storage-w2','Workspace Two','DE','storage-owner'); INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('storage-w1','storage-owner','owner'),('storage-w2','storage-owner','sales');");
 beforeMigration?.(raw);
 raw.exec(fs.readFileSync(new URL('0031_workspace_storage.sql',migrationDir),'utf8'));
 const DB={raw,prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return raw.prepare(sql).get(...args)||null;},async all(){return {results:raw.prepare(sql).all(...args)};},async run(){const r=raw.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e;}}};
 return DB;
}
