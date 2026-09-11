import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleCopilotFileRoute} from '../src/copilot-file-routes.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const pdf=()=>new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x37]);

class Statement {
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.first(this.sql,this.args);}
  async all(){return {results:this.db.all(this.sql,this.args)};}
  async run(){return this.db.run(this.sql,this.args);}
}
class FakeDB {
  constructor(){this.files=[];this.extractions=[];this.analyses=[];this.members=new Map([['w1:u1','owner']]);this.sessions=new Map([[hash('good'),'u1']]);}
  prepare(sql){return new Statement(this,sql);}
  async batch(statements){for(const statement of statements)await statement.run();}
  first(sql,args){
    if(/FROM sessions JOIN users/.test(sql)){const id=this.sessions.get(args[0]);return id?{id,email:'member@example.test',display_name:'Member',role:'owner'}:null;}
    if(/FROM workspace_members/.test(sql)){const role=this.members.get(`${args[0]}:${args[1]}`);return role?{role}:null;}
    if(/sha256=.*workspace_id/.test(sql))return this.files.find(row=>row.sha256===args[0]&&row.workspace_id===args[1]&&row.deleted_at==null)||null;
    if(/FROM copilot_files/.test(sql))return this.files.find(row=>row.id===args[0]&&row.workspace_id===args[1]&&row.deleted_at==null)||null;
    return null;
  }
  all(sql,args){
    if(/FROM copilot_file_analyses/.test(sql))return this.analyses.filter(row=>row.workspace_id===args[0]);
    return [];
  }
  run(sql,args){
    if(/INSERT INTO copilot_files/.test(sql)){const [id,workspace_id,created_by,original_name,extension,mime_type,byte_size,sha256,r2_key,coverage_json,warnings_json]=args;this.files.push({id,workspace_id,created_by,original_name,extension,mime_type,byte_size,sha256,r2_key,coverage_json,warnings_json,extraction_status:'pending',created_at:new Date().toISOString(),deleted_at:null});}
    else if(/INSERT INTO copilot_file_extractions/.test(sql)){const [file_id,blocks_json,evidence_index_json,character_count,cell_count,extractor_version]=args;this.extractions.push({file_id,blocks_json,evidence_index_json,character_count,cell_count,extractor_version});}
    else if(/UPDATE copilot_files SET extraction_status/.test(sql)){const row=this.files.find(item=>item.id===args.at(-2)&&item.workspace_id===args.at(-1));if(row)row.extraction_status=args[0];}
    return {meta:{changes:1}};
  }
}
class FakeR2 {constructor(){this.objects=new Map();}async put(key,bytes,options){if(this.objects.has(key))return null;this.objects.set(key,{bytes,options});return {key};}async delete(key){this.objects.delete(key);}}
const runtime=()=>({DB:new FakeDB(),COPILOT_FILES:new FakeR2()});
function request({workspace='w1',token='good',file=pdf(),name='report.pdf',type='application/pdf',sha=hash(pdf()),extraction={format:'pdf',blocks:[{locator:'page:1',text:'A safe summary'}],evidenceIndex:{'page:1':'Page 1'},warnings:[],coverage:{complete:true},counts:{characters:14,nonEmptyCells:0,csvRows:0}},extractorVersion='web-1'}={}){
  const form=new FormData();form.set('file',new File([file],name,{type}));form.set('extraction_json',JSON.stringify(extraction));form.set('sha256',sha);form.set('extractor_version',extractorVersion);
  return new Request(`https://leadintel.test/api/copilot/files?workspace_id=${workspace}`,{method:'POST',headers:{Cookie:`leadintel_session=${token}`},body:form});
}

test('requires an authenticated workspace member before parsing an upload',async()=>{
  const unauthenticated=await handleCopilotFileRoute(request({token:''}),runtime());
  assert.equal(unauthenticated.status,401);
  const nonMember=await handleCopilotFileRoute(request({workspace:'w2'}),runtime());
  assert.equal(nonMember.status,403);
});

test('rejects cross-workspace upload access and unsafe file inputs',async()=>{
  const env=runtime();env.DB.members.set('w2:u1','viewer');
  assert.equal((await handleCopilotFileRoute(request({workspace:'w2'}),env)).status,403);
  assert.equal((await handleCopilotFileRoute(request({name:'unsafe.exe',type:'application/octet-stream'}),env)).status,415);
  assert.equal((await handleCopilotFileRoute(request({type:'text/csv'}),env)).status,422);
});

test('persists the original, normalized extraction, digest and extractor version once',async()=>{
  const env=runtime();const response=await handleCopilotFileRoute(request(),env);const body=await response.json();
  assert.equal(response.status,201);assert.equal(body.reused,false);assert.match(body.file_id,/^[0-9a-f-]{36}$/i);
  assert.equal(env.DB.files.length,1);assert.equal(env.DB.extractions.length,1);assert.equal(env.DB.extractions[0].extractor_version,'web-1');assert.equal(env.R2?false:env.COPILOT_FILES.objects.size,1);
  assert.doesNotMatch(JSON.stringify(body),/safe summary|leadintel_session/);
});

test('reuses an existing workspace digest without another original write',async()=>{
  const env=runtime();const first=await handleCopilotFileRoute(request(),env);const firstBody=await first.json();const second=await handleCopilotFileRoute(request(),env);const secondBody=await second.json();
  assert.equal(second.status,200);assert.equal(secondBody.reused,true);assert.equal(secondBody.file_id,firstBody.file_id);assert.equal(env.DB.files.length,1);assert.equal(env.COPILOT_FILES.objects.size,1);
});

test('rejects mismatched multipart digest and extraction over aggregate limits',async()=>{
  const badDigest=await handleCopilotFileRoute(request({sha:'0'.repeat(64)}),runtime());assert.equal(badDigest.status,422);
  const extraction={format:'pdf',blocks:[{locator:'page:1',text:'x'.repeat(250001)}],evidenceIndex:{'page:1':'Page 1'},warnings:[],coverage:{},counts:{characters:250001,nonEmptyCells:0,csvRows:0}};
  const tooLarge=await handleCopilotFileRoute(request({extraction}),runtime());assert.equal(tooLarge.status,422);
});
