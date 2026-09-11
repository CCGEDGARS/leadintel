import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createFileRecord,
  putImmutableOriginal,
  saveExtraction,
  createAnalysis,
  deleteAnalysisTree,
  purgeExpiredUnretainedFiles
} from '../src/copilot-file-store.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const migration=fs.readFileSync(path.join(here,'..','migrations','0018_general_file_analysis.sql'),'utf8');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

class SqliteStatement {
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.sqlite.prepare(this.sql).get(...this.args)||null;}
  async all(){return {results:this.db.sqlite.prepare(this.sql).all(...this.args)};}
  async run(){const result=this.db.sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:result.changes}};}
}

class SqliteD1 {
  constructor(){
    this.sqlite=new DatabaseSync(':memory:');
    this.sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE workspaces(id TEXT PRIMARY KEY); CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO workspaces VALUES (\'w1\'),(\'w2\'); INSERT INTO users VALUES (\'u1\'),(\'u2\');');
    this.sqlite.exec(migration);
    this.failBatchAt=null;
  }
  prepare(sql){return new SqliteStatement(this,sql);}
  async batch(statements){
    this.sqlite.exec('BEGIN');
    try{
      const result=[];
      for(let index=0;index<statements.length;index++){
        if(this.failBatchAt===index)throw new Error('D1 batch failed');
        result.push(await statements[index].run());
      }
      this.sqlite.exec('COMMIT');
      return result;
    }catch(error){this.sqlite.exec('ROLLBACK');throw error;}
  }
}

class ConditionalR2 {
  constructor(){this.objects=new Map();this.failDeleteKeys=new Set();this.race=null;this.puts=[];}
  async head(key){return this.objects.get(key)||null;}
  async put(key,bytes,options){
    this.puts.push({key,bytes:new Uint8Array(bytes),options});
    assert.equal(options.onlyIf?.get('If-None-Match'),'*');
    if(this.race)await this.race.promise;
    if(this.objects.has(key))return null;
    const object={key,bytes:new Uint8Array(bytes),options};
    this.objects.set(key,object);
    return object;
  }
  async delete(key){if(this.failDeleteKeys.has(key))throw new Error(`R2 delete failed for ${key}`);this.objects.delete(key);}
}

function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function runtime(){return {DB:new SqliteD1(),COPILOT_FILES:new ConditionalR2()};}
async function file(runtime,workspaceId='w1',bytes=new Uint8Array([1])){
  return createFileRecord(runtime,{workspaceId,userId:workspaceId==='w1'?'u1':'u2',originalName:'report.xlsx',extension:'xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',byteSize:bytes.byteLength,sha256:sha256(bytes),coverage:{},warnings:[]});
}
async function analysis(runtime,record){return createAnalysis(runtime,{workspaceId:record.workspaceId,fileId:record.id,userId:record.workspaceId==='w1'?'u1':'u2',request:'summarize',result:{},provider:'test',model:'test',usage:{}});}
const scalar=(db,sql,...args)=>db.sqlite.prepare(sql).get(...args).value;

test('the real SQLite migration enforces workspace ownership, data constraints, uniqueness and cascades',()=>{
  const db=new SqliteD1().sqlite;
  assert.throws(()=>db.prepare(`INSERT INTO copilot_files(id,workspace_id,original_name,extension,mime_type,byte_size,sha256,r2_key) VALUES('no-workspace','missing','a','csv','text/csv',1,'${'a'.repeat(64)}','r2/a')`).run(),/FOREIGN KEY/);
  assert.throws(()=>db.prepare(`INSERT INTO copilot_files(id,workspace_id,original_name,extension,mime_type,byte_size,sha256,r2_key) VALUES('bad-size','w1','a','csv','text/csv',-1,'${'a'.repeat(64)}','r2/b')`).run(),/CHECK/);
  db.prepare(`INSERT INTO copilot_files(id,workspace_id,original_name,extension,mime_type,byte_size,sha256,r2_key) VALUES('f1','w1','a','csv','text/csv',1,'${'a'.repeat(64)}','r2/f1')`).run();
  assert.throws(()=>db.prepare(`INSERT INTO copilot_files(id,workspace_id,original_name,extension,mime_type,byte_size,sha256,r2_key) VALUES('f2','w1','b','csv','text/csv',1,'${'b'.repeat(64)}','r2/f1')`).run(),/UNIQUE/);
  assert.throws(()=>db.prepare(`INSERT INTO copilot_file_analyses(id,file_id,workspace_id,request) VALUES('cross','f1','w2','steal')`).run(),/FOREIGN KEY/);
  db.prepare(`INSERT INTO copilot_file_extractions(file_id,blocks_json,evidence_index_json,extractor_version) VALUES('f1','[]','{}','v1')`).run();
  db.prepare(`INSERT INTO copilot_file_analyses(id,file_id,workspace_id,request) VALUES('a1','f1','w1','ok')`).run();
  db.prepare(`INSERT INTO copilot_file_analysis_messages(id,analysis_id,role,content) VALUES('m1','a1','user','hello')`).run();
  db.prepare(`DELETE FROM copilot_files WHERE id='f1'`).run();
  for(const table of ['copilot_files','copilot_file_extractions','copilot_file_analyses','copilot_file_analysis_messages'])assert.equal(scalar({sqlite:db},`SELECT count(*) AS value FROM ${table}`),0);
});

test('D1-style batch failure rolls back extraction metadata and leaves the file pending',async()=>{
  const env=runtime();const record=await file(env);
  env.DB.failBatchAt=1;
  await assert.rejects(()=>saveExtraction(env,{workspaceId:'w1',fileId:record.id,blocks:[],evidenceIndex:{},characterCount:0,cellCount:0,extractorVersion:'v1'}),/D1 batch failed/);
  assert.equal(scalar(env.DB,`SELECT count(*) AS value FROM copilot_file_extractions`),0);
  assert.equal(scalar(env.DB,`SELECT extraction_status AS value FROM copilot_files WHERE id=?`,record.id),'pending');
});

test('conditional R2 writes admit only one concurrent original and reject a different payload by digest',async()=>{
  const env=runtime();const good=new Uint8Array([1,2,3]);const bad=new Uint8Array([4,5,6]);const record=await file(env,'w1',good);
  env.COPILOT_FILES.race=deferred();
  const first=putImmutableOriginal(env,{workspaceId:'w1',fileId:record.id,bytes:good,sha256:sha256(good),contentType:'application/octet-stream'});
  const second=putImmutableOriginal(env,{workspaceId:'w1',fileId:record.id,bytes:good,sha256:sha256(good),contentType:'application/octet-stream'});
  await Promise.resolve();env.COPILOT_FILES.race.resolve();
  const settled=await Promise.allSettled([first,second]);
  assert.equal(settled.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(env.COPILOT_FILES.objects.get(record.r2Key).bytes[0],1);
  await assert.rejects(()=>putImmutableOriginal(env,{workspaceId:'w1',fileId:record.id,bytes:bad,sha256:sha256(good),contentType:'application/octet-stream'}),/digest/i);
  assert.equal(env.COPILOT_FILES.objects.get(record.r2Key).bytes[0],1);
});

test('an R2-success/D1-failure deletion remains marked deleting and is recovered by retry',async()=>{
  const env=runtime();const bytes=new Uint8Array([7]);const record=await file(env,'w1',bytes);await putImmutableOriginal(env,{workspaceId:'w1',fileId:record.id,bytes,sha256:sha256(bytes)});const item=await analysis(env,record);
  env.DB.failBatchAt=0;
  await assert.rejects(()=>deleteAnalysisTree(env,{workspaceId:'w1',analysisId:item.id}),/D1 batch failed/);
  assert.equal(env.COPILOT_FILES.objects.has(record.r2Key),false);
  assert.equal(scalar(env.DB,`SELECT extraction_status AS value FROM copilot_files WHERE id=?`,record.id),'deleting');
  env.DB.failBatchAt=null;
  assert.deepEqual(await deleteAnalysisTree(env,{workspaceId:'w1',analysisId:item.id}),{deleted:true});
  assert.equal(scalar(env.DB,`SELECT count(*) AS value FROM copilot_files`),0);
});

test('purge records failures and continues deleting later expired files',async()=>{
  const env=runtime();const firstBytes=new Uint8Array([8]),secondBytes=new Uint8Array([9]);const first=await file(env,'w1',firstBytes),second=await file(env,'w2',secondBytes);
  await putImmutableOriginal(env,{workspaceId:'w1',fileId:first.id,bytes:firstBytes,sha256:sha256(firstBytes)});await putImmutableOriginal(env,{workspaceId:'w2',fileId:second.id,bytes:secondBytes,sha256:sha256(secondBytes)});
  env.DB.sqlite.prepare(`UPDATE copilot_files SET created_at='2000-01-01T00:00:00.000Z'`).run();
  env.COPILOT_FILES.failDeleteKeys.add(first.r2Key);
  assert.deepEqual(await purgeExpiredUnretainedFiles(env,new Date('2000-01-03T00:00:00.000Z')),{deleted:1,failed:1});
  assert.equal(scalar(env.DB,`SELECT extraction_status AS value FROM copilot_files WHERE id=?`,first.id),'deleting');
  assert.equal(scalar(env.DB,`SELECT count(*) AS value FROM copilot_files WHERE id=?`,second.id),0);
});
