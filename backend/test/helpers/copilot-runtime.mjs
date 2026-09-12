import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export class Statement {
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.sqlite.prepare(this.sql).get(...this.args)||null;}
  async all(){return {results:this.db.sqlite.prepare(this.sql).all(...this.args)};}
  async run(){return {meta:{changes:this.db.sqlite.prepare(this.sql).run(...this.args).changes}};}
}
export function runtime(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys=ON; CREATE TABLE workspaces(id TEXT PRIMARY KEY); CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT); CREATE TABLE sessions(token_hash TEXT,user_id TEXT,expires_at TEXT); CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT); INSERT INTO workspaces VALUES('w1'),('w2'); INSERT INTO users VALUES('u1','member@test','Member','owner'),('u2','other@test','Other','owner'); INSERT INTO workspace_members VALUES('w1','u1','owner'),('w2','u1','owner'),('w1','u2','owner');`);
  sqlite.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash('good'),'u1','2999-01-01');sqlite.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash('other'),'u2','2999-01-01');
  sqlite.exec(fs.readFileSync(new URL('../../migrations/0018_general_file_analysis.sql',import.meta.url),'utf8'));
  let queue=Promise.resolve();
  const DB={sqlite,failBatch:false,prepare(sql){return new Statement(this,sql);},batch(statements){const job=queue.then(()=>{sqlite.exec('BEGIN');try{if(this.failBatch)throw new Error('transient D1 batch failure');const result=statements.map(s=>({meta:{changes:sqlite.prepare(s.sql).run(...s.args).changes}}));sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}});queue=job.catch(()=>{});return job;}};
  const COPILOT_FILES={objects:new Map(),failPut:false,failDelete:false,async head(key){return this.objects.get(key)||null;},async put(key,bytes,options){if(this.failPut)throw new Error('transient R2 put failure');if(this.objects.has(key))return null;const item={key,bytes:new Uint8Array(bytes),size:bytes.byteLength,customMetadata:options.customMetadata};this.objects.set(key,item);return item;},async delete(key){if(this.failDelete)throw new Error('transient R2 deletion failure');this.objects.delete(key);}};
  return {DB,COPILOT_FILES};
}
export const extraction=()=>({format:'pdf',title:'Report',blocks:[{locator:'page:1',text:'Useful facts'}],evidenceIndex:{'page:1':'Page 1'},warnings:[],coverage:{complete:true,omitted:[]},counts:{characters:12,nonEmptyCells:0,csvRows:0}});
export function uploadRequest({workspace='w1',token='good',bytes=Buffer.from('%PDF-1.7'),name='report.pdf',type='application/pdf',document=extraction()}={}){
  const form=new FormData();form.set('file',new File([bytes],name,{type}));form.set('extraction_json',JSON.stringify(document));form.set('sha256',hash(bytes));form.set('extractor_version','web-1');
  return new Request(`https://leadintel.test/api/copilot/files?workspace_id=${workspace}`,{method:'POST',headers:{Cookie:`leadintel_session=${token}`},body:form});
}
export const apiRequest=(path,{method='GET',workspace='w1',token='good'}={})=>new Request(`https://leadintel.test/api/copilot/${path}?workspace_id=${workspace}`,{method,headers:{Cookie:`leadintel_session=${token}`}});
