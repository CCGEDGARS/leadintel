import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export class D1Fixture {
 constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec('CREATE TABLE workspaces(id TEXT PRIMARY KEY); INSERT INTO workspaces VALUES (\'w1\'),(\'w2\');');}
 prepare(sql){let args=[];const raw=this.raw;return {bind(...values){args=values;return this;},async first(){return raw.prepare(sql).get(...args)||null;},async all(){return {results:raw.prepare(sql).all(...args)};},async run(){const r=raw.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}
 async batch(statements){this.raw.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());this.raw.exec('COMMIT');return out;}catch(e){this.raw.exec('ROLLBACK');throw e;}}
}
export function storageFixture(){const DB=new D1Fixture();DB.raw.exec(readFileSync(new URL('../migrations/0028_writing_references.sql',import.meta.url),'utf8'));const objects=new Map();return {DB,objects,WRITING_REFERENCES_BUCKET:{async put(k,v){objects.set(k,v);},async get(k){const v=objects.get(k);return v==null?null:{async text(){return typeof v==='string'?v:new TextDecoder().decode(v);},async arrayBuffer(){return typeof v==='string'?new TextEncoder().encode(v).buffer:v.buffer;}};},async delete(k){objects.delete(k);}}};}
