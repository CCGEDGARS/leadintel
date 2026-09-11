import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createFileRecord,
  putImmutableOriginal,
  saveExtraction,
  createAnalysis,
  retainAnalysis,
  deleteAnalysisTree,
  purgeExpiredUnretainedFiles
} from '../src/copilot-file-store.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const migration=fs.readFileSync(path.join(here,'..','migrations','0018_general_file_analysis.sql'),'utf8');
const wrangler=fs.readFileSync(path.join(here,'..','wrangler.toml'),'utf8');

class Statement {
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.first(this.sql,this.args);}
  async all(){return {results:this.db.all(this.sql,this.args)};}
  async run(){return this.db.run(this.sql,this.args);}
}

class FakeD1 {
  constructor(){this.files=[];this.extractions=[];this.analyses=[];this.messages=[];}
  prepare(sql){return new Statement(this,sql);}
  async batch(statements){for(const statement of statements)await statement.run();}
  first(sql,args){
    if(/FROM copilot_files/.test(sql))return this.files.find(row=>row.id===args[0]&&row.workspace_id===args[1])||null;
    if(/FROM copilot_file_analyses/.test(sql))return this.analyses.find(row=>row.id===args[0]&&row.workspace_id===args[1])||null;
    return null;
  }
  all(sql,args){
    if(/FROM copilot_files f/.test(sql)){
      const cutoff=args[0];return this.files.filter(file=>file.created_at<cutoff&&!this.analyses.some(analysis=>analysis.file_id===file.id&&analysis.retained===1));
    }
    if(/FROM copilot_file_analyses/.test(sql))return this.analyses.filter(row=>row.file_id===args[0]&&row.workspace_id===args[1]);
    return [];
  }
  run(sql,args){
    if(/INSERT INTO copilot_files/.test(sql)){const [id,workspace_id,created_by,original_name,extension,mime_type,byte_size,sha256,r2_key,status,coverage_json,warnings_json]=args;this.files.push({id,workspace_id,created_by,original_name,extension,mime_type,byte_size,sha256,r2_key,status,coverage_json,warnings_json,created_at:new Date().toISOString(),retained:0});}
    else if(/INSERT INTO copilot_file_extractions/.test(sql)){const [file_id,blocks_json,evidence_index_json,character_count,cell_count,extractor_version]=args;this.extractions.push({file_id,blocks_json,evidence_index_json,character_count,cell_count,extractor_version});}
    else if(/INSERT INTO copilot_file_analyses/.test(sql)){const [id,file_id,workspace_id,created_by,request,canonical_result_json,provider,model,usage_json,status,retained]=args;this.analyses.push({id,file_id,workspace_id,created_by,request,canonical_result_json,provider,model,usage_json,status,retained,created_at:new Date().toISOString()});}
    else if(/UPDATE copilot_file_analyses SET retained=1/.test(sql)){const row=this.analyses.find(row=>row.id===args[0]);if(row)row.retained=1;}
    else if(/DELETE FROM copilot_file_analyses/.test(sql)){const ids=new Set(this.analyses.filter(row=>row.file_id===args[0]&&row.workspace_id===args[1]).map(row=>row.id));this.messages=this.messages.filter(row=>!ids.has(row.analysis_id));this.analyses=this.analyses.filter(row=>!ids.has(row.analysis_id));}
    else if(/DELETE FROM copilot_file_extractions/.test(sql)){this.extractions=this.extractions.filter(row=>row.file_id!==args[0]);}
    else if(/DELETE FROM copilot_files/.test(sql)){this.files=this.files.filter(row=>!(row.id===args[0]&&row.workspace_id===args[1]));}
    return {meta:{changes:1}};
  }
}

class FakeR2 {
  constructor(){this.objects=new Map();this.putCalls=0;}
  async head(key){return this.objects.get(key)||null;}
  async put(key,bytes,options){this.putCalls+=1;this.objects.set(key,{key,bytes,options});}
  async delete(key){this.objects.delete(key);}
}

function env(){return {DB:new FakeD1(),COPILOT_FILES:new FakeR2()};}
const fileInput={workspaceId:'w1',userId:'u1',originalName:'budget.xlsx',extension:'xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',byteSize:5,sha256:'a'.repeat(64),coverage:{complete:true},warnings:[]};

test('migration creates workspace-scoped file, extraction, analysis and message tables with cascades',()=>{
  for(const table of ['copilot_files','copilot_file_extractions','copilot_file_analyses','copilot_file_analysis_messages'])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(migration,/workspace_id TEXT NOT NULL REFERENCES workspaces\(id\) ON DELETE CASCADE/);
  assert.match(migration,/file_id TEXT NOT NULL REFERENCES copilot_files\(id\) ON DELETE CASCADE/);
  assert.match(migration,/analysis_id TEXT NOT NULL REFERENCES copilot_file_analyses\(id\) ON DELETE CASCADE/);
});

test('wrangler binds the non-public original file R2 buckets',()=>{
  assert.match(wrangler,/\[\[r2_buckets\]\][\s\S]*binding = "COPILOT_FILES"[\s\S]*bucket_name = "leadintel-copilot-files"[\s\S]*preview_bucket_name = "leadintel-copilot-files-preview"/);
});

test('file records use a non-guessable workspace key and never include the original filename',async()=>{
  const runtime=env();const record=await createFileRecord(runtime,fileInput);
  assert.match(record.id,/^[0-9a-f-]{36}$/i);
  assert.equal(record.r2Key,`workspaces/w1/copilot-files/${record.id}/original`);
  assert.doesNotMatch(record.r2Key,/budget\.xlsx/i);
});

test('original objects are immutable and preserve digest metadata',async()=>{
  const runtime=env();const record=await createFileRecord(runtime,fileInput);const bytes=new Uint8Array([1,2,3]);
  await putImmutableOriginal(runtime,{workspaceId:'w1',fileId:record.id,bytes,sha256:fileInput.sha256,contentType:fileInput.mimeType});
  await assert.rejects(()=>putImmutableOriginal(runtime,{workspaceId:'w1',fileId:record.id,bytes,sha256:fileInput.sha256,contentType:fileInput.mimeType}),/immutable/i);
  const object=await runtime.COPILOT_FILES.head(record.r2Key);
  assert.equal(object.options.httpMetadata.contentType,fileInput.mimeType);
  assert.equal(object.options.customMetadata.sha256,fileInput.sha256);
});

test('metadata reads and analysis operations are workspace scoped',async()=>{
  const runtime=env();const record=await createFileRecord(runtime,fileInput);await saveExtraction(runtime,{workspaceId:'w1',fileId:record.id,blocks:[],evidenceIndex:{},characterCount:0,cellCount:0,extractorVersion:'v1'});
  const analysis=await createAnalysis(runtime,{workspaceId:'w1',fileId:record.id,userId:'u1',request:'summarize',result:{title:'Summary'},provider:'openai',model:'gpt',usage:{}});
  await assert.rejects(()=>createAnalysis(runtime,{workspaceId:'w2',fileId:record.id,userId:'u2',request:'steal',result:{},provider:'openai',model:'gpt',usage:{}}),/not found/i);
  await assert.rejects(()=>retainAnalysis(runtime,{workspaceId:'w2',id:analysis.id}),/not found/i);
});

test('retained analyses prevent expiry cleanup',async()=>{
  const runtime=env();const record=await createFileRecord(runtime,fileInput);const analysis=await createAnalysis(runtime,{workspaceId:'w1',fileId:record.id,userId:'u1',request:'summarize',result:{title:'Summary'},provider:'openai',model:'gpt',usage:{}});await retainAnalysis(runtime,{workspaceId:'w1',id:analysis.id});
  runtime.DB.files[0].created_at='2000-01-01T00:00:00.000Z';const result=await purgeExpiredUnretainedFiles(runtime,new Date('2000-01-03T00:00:00.000Z'));
  assert.equal(result.deleted,0);assert.equal(runtime.DB.files.length,1);
});

test('expiry cleanup removes unretained file trees older than 24 hours',async()=>{
  const runtime=env();const record=await createFileRecord(runtime,fileInput);await putImmutableOriginal(runtime,{workspaceId:'w1',fileId:record.id,bytes:new Uint8Array([1]),sha256:fileInput.sha256,contentType:fileInput.mimeType});runtime.DB.files[0].created_at='2000-01-01T00:00:00.000Z';
  const result=await purgeExpiredUnretainedFiles(runtime,new Date('2000-01-03T00:00:00.000Z'));
  assert.equal(result.deleted,1);assert.equal(runtime.DB.files.length,0);assert.equal(runtime.COPILOT_FILES.objects.size,0);
});

test('deleting an analysis tree deletes child metadata and immutable original idempotently',async()=>{
  const runtime=env();const record=await createFileRecord(runtime,fileInput);await putImmutableOriginal(runtime,{workspaceId:'w1',fileId:record.id,bytes:new Uint8Array([1]),sha256:fileInput.sha256,contentType:fileInput.mimeType});await saveExtraction(runtime,{workspaceId:'w1',fileId:record.id,blocks:[],evidenceIndex:{},characterCount:0,cellCount:0,extractorVersion:'v1'});const analysis=await createAnalysis(runtime,{workspaceId:'w1',fileId:record.id,userId:'u1',request:'summarize',result:{},provider:'openai',model:'gpt',usage:{}});
  assert.deepEqual(await deleteAnalysisTree(runtime,{workspaceId:'w1',analysisId:analysis.id}),{deleted:true});
  assert.equal(runtime.DB.files.length,0);assert.equal(runtime.DB.extractions.length,0);assert.equal(runtime.DB.analyses.length,0);assert.equal(runtime.COPILOT_FILES.objects.size,0);
  assert.deepEqual(await deleteAnalysisTree(runtime,{workspaceId:'w1',analysisId:analysis.id}),{deleted:false});
});