import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../src/security.js';

let assetModule={};
let moduleError=null;
try{assetModule=await import('../src/brand-assets.js');}catch(cause){moduleError=cause;}
const {handleBrandAssetRoute,validateBrandAsset,replaceBrandAsset}=assetModule;

const MiB=1024*1024;

function png(width=3,height=2){
  const bytes=new Uint8Array(45);
  bytes.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,13,0x49,0x48,0x44,0x52]);
  new DataView(bytes.buffer).setUint32(16,width);new DataView(bytes.buffer).setUint32(20,height);
  bytes.set([8,6,0,0,0],24);bytes.set([0,0,0,0,0x49,0x45,0x4e,0x44,0,0,0,0],33);
  return bytes;
}
function jpeg(width=3,height=2){return Uint8Array.from([0xff,0xd8,0xff,0xc0,0,17,8,height>>8,height&255,width>>8,width&255,3,1,0x11,0,2,0x11,0,3,0x11,0,0xff,0xd9]);}
function webp(width=3,height=2){
  const bytes=new Uint8Array(30);bytes.set([0x52,0x49,0x46,0x46,22,0,0,0,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x58,10,0,0,0,0,0,0,0]);
  const w=width-1,h=height-1;bytes.set([w&255,(w>>8)&255,(w>>16)&255,h&255,(h>>8)&255,(h>>16)&255],24);return bytes;
}
function file(bytes,type,name='upload.bin'){return new File([bytes],name,{type});}

class MemoryR2{
  constructor(){this.objects=new Map();this.events=[];}
  async put(key,value,options={}){const bytes=new Uint8Array(await new Response(value).arrayBuffer());this.objects.set(key,{bytes,httpMetadata:options.httpMetadata||{}});this.events.push(['put',key]);}
  async get(key){const row=this.objects.get(key);if(!row)return null;return {body:row.bytes,httpMetadata:row.httpMetadata,arrayBuffer:async()=>row.bytes.buffer.slice(row.bytes.byteOffset,row.bytes.byteOffset+row.bytes.byteLength)};}
  async delete(key){this.objects.delete(key);this.events.push(['delete',key]);}
}
class D1Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){
    if(this.sql.includes('FROM sessions JOIN users'))return this.args[0]===this.db.tokenHash?this.db.user:null;
    if(this.sql.includes('FROM workspace_members'))return this.args[0]===this.db.workspaceId&&this.args[1]===this.db.user.id?{role:this.db.role}:null;
    throw new Error(`Unexpected first query: ${this.sql}`);
  }
  async run(){
    if(this.sql.includes('INSERT INTO audit_events')){this.db.audits.push(this.args);return {success:true,meta:{changes:1}};}
    throw new Error(`Unexpected run query: ${this.sql}`);
  }
}
class D1Db{constructor({tokenHash,user,workspaceId,role}){Object.assign(this,{tokenHash,user,workspaceId,role,audits:[]});}prepare(sql){return new D1Statement(this,sql);}}
async function fixture(role='owner'){
  const token=`asset-${role}-session`,workspaceId='workspace-secret-name',user={id:'user-1',email:'private@example.com',display_name:'Private User',role};
  const DB=new D1Db({tokenHash:await sha256(token),user,workspaceId,role});
  return {token,workspaceId,DB,env:{DB,BRAND_ASSETS:new MemoryR2()}};
}
function request(path,{method='GET',token,body,headers={}}={}){return new Request(`https://leadintel-api.edgars-7e7.workers.dev${path}`,{method,headers:{...(token?{Cookie:`leadintel_session=${token}`}:{}),...headers},body});}
function uploadRequest(workspaceId,token,{bytes=png(),type='image/png',kind='logo',filename='private-company-logo.png',altText='Company logo'}={}){
  const body=new FormData();body.set('kind',kind);body.set('alt_text',altText);body.set('file',file(bytes,type,filename));
  return request(`/api/customer/brand-assets?workspace_id=${encodeURIComponent(workspaceId)}`,{method:'POST',token,body});
}

test('brand asset module exists and exposes the boundary functions',()=>{
  assert.ifError(moduleError);assert.equal(typeof handleBrandAssetRoute,'function');assert.equal(typeof validateBrandAsset,'function');assert.equal(typeof replaceBrandAsset,'function');
});

test('PNG, JPEG, and WebP require matching MIME and return decoded dimensions',async()=>{
  const cases=[[png(3,2),'image/png',3,2],[jpeg(321,123),'image/jpeg',321,123],[webp(640,480),'image/webp',640,480]];
  for(const [bytes,type,width,height] of cases){const result=await validateBrandAsset(file(bytes,type), 'logo');assert.deepEqual({mimeType:result.mimeType,width:result.width,height:result.height},{mimeType:type,width,height});}
  await assert.rejects(()=>validateBrandAsset(file(png(),'image/jpeg'),'logo'),/magic bytes/i);
});

test('SVG, data payloads, executables, and unknown image kinds are rejected',async()=>{
  await assert.rejects(()=>validateBrandAsset(file('<svg/>','image/svg+xml'),'logo'),/PNG, JPEG, or WebP/i);
  await assert.rejects(()=>validateBrandAsset(file('data:image/png;base64,AAAA','image/png'),'logo'),/magic bytes/i);
  await assert.rejects(()=>validateBrandAsset(file(Uint8Array.from([0x4d,0x5a,0x90,0]),'image/png'),'logo'),/magic bytes/i);
  await assert.rejects(()=>validateBrandAsset(file(png(),'image/png'),'avatar'),/kind/i);
});

test('an executable payload appended to an otherwise recognized image is rejected',async()=>{
  const payload=new Uint8Array([...png(),...new TextEncoder().encode('<script>alert(1)</script>')]);
  await assert.rejects(()=>validateBrandAsset(file(payload,'image/png'),'logo'),/magic bytes|structure/i);
});

test('logo uses a 2 MiB limit while headshot and banner use 5 MiB',async()=>{
  const oversized=size=>({type:'image/png',size,arrayBuffer:async()=>png().buffer});
  await assert.rejects(()=>validateBrandAsset(oversized(2*MiB+1),'logo'),/2 MB/i);
  await assert.rejects(()=>validateBrandAsset(oversized(5*MiB+1),'headshot'),/5 MB/i);
  await assert.rejects(()=>validateBrandAsset(oversized(5*MiB+1),'banner'),/5 MB/i);
});

test('images above the 6000 by 6000 dimension cap are rejected',async()=>{
  await assert.rejects(()=>validateBrandAsset(file(png(6001,20),'image/png'),'logo'),/6000/);
  await assert.rejects(()=>validateBrandAsset(file(jpeg(20,6001),'image/jpeg'),'headshot'),/6000/);
});

test('upload requires workspace membership with owner or researcher role',async()=>{
  const owner=await fixture('owner');let response=await handleBrandAssetRoute(uploadRequest(owner.workspaceId,null),owner.env,{});assert.equal(response.status,401);assert.equal(owner.env.BRAND_ASSETS.objects.size,0);
  const sales=await fixture('sales');response=await handleBrandAssetRoute(uploadRequest(sales.workspaceId,sales.token),sales.env,{});assert.equal(response.status,403);assert.equal(sales.env.BRAND_ASSETS.objects.size,0);
  response=await handleBrandAssetRoute(uploadRequest('another-workspace',owner.token),owner.env,{});assert.equal(response.status,403);assert.equal(owner.env.BRAND_ASSETS.objects.size,0);
  const researcher=await fixture('researcher');response=await handleBrandAssetRoute(uploadRequest(researcher.workspaceId,researcher.token),researcher.env,{});assert.equal(response.status,201);
});

test('upload creates an opaque public URL, workspace-scoped key, metadata-only response, and audit event',async()=>{
  const {env,token,workspaceId,DB}=await fixture();const response=await handleBrandAssetRoute(uploadRequest(workspaceId,token),env,{});assert.equal(response.status,201);
  const {asset}=await response.json();assert.match(asset.id,/^[a-f0-9]{16}_[A-Za-z0-9_-]{32}$/);assert.equal(asset.url,`https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${asset.id}`);assert.deepEqual({mimeType:asset.mimeType,width:asset.width,height:asset.height,altText:asset.altText},{mimeType:'image/png',width:3,height:2,altText:'Company logo'});
  assert.equal(JSON.stringify(asset).includes(workspaceId),false);assert.equal(JSON.stringify(asset).includes('private-company-logo.png'),false);assert.equal(JSON.stringify(asset).includes('private@example.com'),false);
  const [key]=env.BRAND_ASSETS.objects.keys();assert.match(key,new RegExp(`^workspaces/${asset.id.slice(0,16)}/brand-assets/${asset.id}$`));assert.equal(DB.audits.length,1);assert.equal(DB.audits[0][3],'brand_asset.uploaded');
});

test('public GET returns only validated bytes with strict immutable headers',async()=>{
  const {env,token,workspaceId}=await fixture();let response=await handleBrandAssetRoute(uploadRequest(workspaceId,token,{bytes:webp(9,7),type:'image/webp',kind:'banner'}),env,{});const {asset}=await response.json();
  response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}`),env,{'Access-Control-Allow-Origin':'https://app.example'});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(response.headers.get('Cache-Control'),'public, max-age=31536000, immutable');assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://app.example');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),webp(9,7));assert.equal(response.headers.has('X-Workspace-Id'),false);
  const key=[...env.BRAND_ASSETS.objects.keys()][0];env.BRAND_ASSETS.objects.get(key).bytes=Uint8Array.from([0x4d,0x5a]);response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}`),env,{});assert.equal(response.status,404);
});

test('delete enforces writer authorization and workspace isolation, then audits deletion',async()=>{
  const owner=await fixture();let response=await handleBrandAssetRoute(uploadRequest(owner.workspaceId,owner.token),owner.env,{});const {asset}=await response.json();
  response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}?workspace_id=another-workspace`,{method:'DELETE',token:owner.token}),owner.env,{});assert.equal(response.status,403);assert.equal(owner.env.BRAND_ASSETS.objects.size,1);
  response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}?workspace_id=${owner.workspaceId}`,{method:'DELETE',token:owner.token}),owner.env,{});assert.equal(response.status,200);assert.equal(owner.env.BRAND_ASSETS.objects.size,0);assert.equal(owner.DB.audits.at(-1)[3],'brand_asset.deleted');
});

test('server-side import accepts a bounded public HTTP image and audits it',async()=>{
  const {env,token,workspaceId,DB}=await fixture();const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push([String(url),options]);return new Response(jpeg(44,33),{status:200,headers:{'Content-Type':'image/jpeg','Content-Length':String(jpeg(44,33).length)}});};
  try{const response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/import?workspace_id=${workspaceId}`,{method:'POST',token,headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://cdn.example.test/logo.jpg',kind:'logo',alt_text:'Imported logo'})}),env,{});assert.equal(response.status,201);const {asset}=await response.json();assert.equal(asset.mimeType,'image/jpeg');assert.equal(asset.width,44);assert.equal(calls.length,1);assert.equal(calls[0][1].redirect,'manual');assert.ok(calls[0][1].signal instanceof AbortSignal);assert.equal(DB.audits.at(-1)[3],'brand_asset.imported');}finally{globalThis.fetch=originalFetch;}
});

test('an import timeout while reading image bytes returns a bounded gateway error',async()=>{
  const {env,token,workspaceId}=await fixture();const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(new ReadableStream({pull(controller){controller.error(new DOMException('Timed out','AbortError'));}}),{headers:{'Content-Type':'image/png'}});
  try{const response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/import?workspace_id=${workspaceId}`,{method:'POST',token,headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://public.example/logo.png',kind:'logo'})}),env,{});assert.equal(response.status,504);}finally{globalThis.fetch=originalFetch;}
});

test('import blocks data, local, private, link-local, and unsafe redirect targets before fetching them',async()=>{
  const {env,token,workspaceId}=await fixture();const originalFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://169.254.169.254/latest/meta-data'}});};
  try{
    for(const url of ['data:image/png;base64,AAAA','http://localhost/logo.png','http://127.0.0.1/logo.png','http://10.0.0.1/logo.png','http://[::1]/logo.png']){const response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/import?workspace_id=${workspaceId}`,{method:'POST',token,headers:{'Content-Type':'application/json'},body:JSON.stringify({url,kind:'logo'})}),env,{});assert.equal(response.status,400);}
    assert.equal(calls,0);const response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/import?workspace_id=${workspaceId}`,{method:'POST',token,headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://public.example/logo.png',kind:'logo'})}),env,{});assert.equal(response.status,400);assert.equal(calls,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('import rejects excessive redirects, oversized responses, wrong types, and magic mismatches',async()=>{
  const {env,token,workspaceId}=await fixture();const originalFetch=globalThis.fetch;
  const invoke=()=>handleBrandAssetRoute(request(`/api/customer/brand-assets/import?workspace_id=${workspaceId}`,{method:'POST',token,headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://public.example/logo.png',kind:'logo'})}),env,{});
  try{
    globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://public.example/again.png'}});assert.equal((await invoke()).status,400);
    globalThis.fetch=async()=>new Response(png(),{headers:{'Content-Type':'image/png','Content-Length':String(2*MiB+1)}});assert.equal((await invoke()).status,413);
    globalThis.fetch=async()=>new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}});assert.equal((await invoke()).status,400);
    globalThis.fetch=async()=>new Response('not a png',{headers:{'Content-Type':'image/png'}});assert.equal((await invoke()).status,400);
  }finally{globalThis.fetch=originalFetch;}
});

test('replacement saves metadata before deleting old bytes and preserves old bytes when save fails',async()=>{
  const {env,workspaceId}=await fixture();const oldId=`${(await sha256(workspaceId)).slice(0,16)}_${'a'.repeat(32)}`;const nextId=`${oldId.slice(0,17)}${'b'.repeat(32)}`;
  const oldKey=`workspaces/${oldId.slice(0,16)}/brand-assets/${oldId}`,nextKey=`workspaces/${nextId.slice(0,16)}/brand-assets/${nextId}`;env.BRAND_ASSETS.objects.set(oldKey,{bytes:png(),httpMetadata:{}});env.BRAND_ASSETS.objects.set(nextKey,{bytes:png(),httpMetadata:{}});const order=[];
  await replaceBrandAsset(env,{workspaceId,previousAssetId:oldId,nextAsset:{id:nextId},saveMetadata:async()=>{order.push('saved');}});order.push(...env.BRAND_ASSETS.events.map(([event])=>event));assert.deepEqual(order,['saved','delete']);assert.equal(env.BRAND_ASSETS.objects.has(oldKey),false);
  env.BRAND_ASSETS.events=[];env.BRAND_ASSETS.objects.set(oldKey,{bytes:png(),httpMetadata:{}});env.BRAND_ASSETS.objects.set(nextKey,{bytes:png(),httpMetadata:{}});await assert.rejects(()=>replaceBrandAsset(env,{workspaceId,previousAssetId:oldId,nextAsset:{id:nextId},saveMetadata:async()=>{throw new Error('revision conflict');}}),/revision conflict/);assert.equal(env.BRAND_ASSETS.objects.has(oldKey),true);assert.equal(env.BRAND_ASSETS.objects.has(nextKey),false);
});

test('unrelated paths return null',async()=>{const {env}=await fixture();assert.equal(await handleBrandAssetRoute(request('/api/health'),env,{}),null);});
