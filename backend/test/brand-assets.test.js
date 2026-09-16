import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import app from '../src/app.js';
import {
  brandAssetObjectKey,
  deleteBrandAsset,
  handleBrandAssetRoute,
  replaceBrandAsset,
  validateBrandAsset
} from '../src/brand-assets.js';
import {sha256} from '../src/security.js';

const MiB=1024*1024;
const PNG_BASE64='iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAFUlEQVR4nGMUa4piYGBgYGBgYoABABD8APYX3hcjAAAAAElFTkSuQmCC';
const JPEG_WITH_STUFFED_ENTROPY_BASE64='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDM/aE8P+MvGHjLQGsfiB471F9HX7A3ijxXd2fh+SeaS9jtpdGg1B7cpALZZbiSX7TLMBdxR+SzRZBg1jW5NY0zxVbaD8StNtNR8L31mmpuvmxmHzNQbTGuXS10957rUTNL9lFo3lCKJbKGcTBfMi6nXbOOE2vxQ+KPj298O6H481iMeJbvxNotp4dNw89xPf3t9Z+aUF3Ev2dpFkgUXQmEk8FwDcoJ4fjHFH4A8G6b4a1rUYNZn1DXlvNHu9a1abVb230uJFneOW5uLeP7FqN1DFbkW8h3ROLVk8n7RLcwc2TYisqSpYV8tGMqS5ZclT93Kfvv4LylScedycKdTnjTkmoyaqVmFPLMVhJS+rJ0buUZRkqfJJQi4OMpU1CcE1JNQhCnFzadNycL/wD/2Q==';
const WEBP_BASE64='UklGRjIAAABXRUJQVlA4ICYAAABQAQCdASoJAAcAAUAmJaAABAAAAP7vvRf//PzP/8MP//DD+iQAAA==';

const decode=value=>new Uint8Array(Buffer.from(value,'base64'));
const png=()=>decode(PNG_BASE64);
const jpeg=()=>decode(JPEG_WITH_STUFFED_ENTROPY_BASE64);
const webp=()=>decode(WEBP_BASE64);
const file=(bytes,type,name='upload.bin')=>new File([bytes],name,{type});
const randomId=character=>character.repeat(43);

function validatedMetadata({workspaceId='private-workspace',mimeType='image/png',size=png().byteLength,width=3,height=2}={}){
  return {
    workspaceId,
    validation:'decoded-v1',
    validatedMimeType:mimeType,
    validatedSize:String(size),
    validatedWidth:String(width),
    validatedHeight:String(height)
  };
}

async function bytesSha256(bytes){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function validatedMetadataWithDigest(bytes,options={}){
  return {...validatedMetadata({size:bytes.byteLength,...options}),'content-sha256':await bytesSha256(bytes)};
}

function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes){
    crc^=byte;
    for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}

function pngWithDimensions(width,height){
  const bytes=png();const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  view.setUint32(16,width);view.setUint32(20,height);view.setUint32(29,crc32(bytes.subarray(12,29)));
  return bytes;
}

function pngWithoutIdat(){
  const bytes=png();return new Uint8Array([...bytes.subarray(0,33),...bytes.subarray(bytes.length-12)]);
}

function crcValidPngWithUndecodablePixels(){
  const bytes=png();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=8;
  while(offset+12<=bytes.length){
    const length=view.getUint32(offset);
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if(type==='IDAT'){
      bytes.fill(0,offset+8,offset+8+length);
      view.setUint32(offset+8+length,crc32(bytes.subarray(offset+4,offset+8+length)));
      return bytes;
    }
    offset+=12+length;
  }
  throw new Error('PNG fixture has no IDAT');
}

function headerOnlyJpeg(width=3,height=2){
  return Uint8Array.from([0xff,0xd8,0xff,0xc0,0,17,8,height>>8,height&255,width>>8,width&255,3,1,0x11,0,2,0x11,0,3,0x11,0,0xff,0xd9]);
}

function markerValidJpegWithUndecodableScan(width=3,height=2){
  return Uint8Array.from([
    0xff,0xd8,
    0xff,0xc0,0,17,8,height>>8,height&255,width>>8,width&255,3,1,0x11,0,2,0x11,0,3,0x11,0,
    0xff,0xda,0,12,3,1,0,2,0x11,3,0x11,0,0x3f,0,
    1,2,3,
    0xff,0xd9
  ]);
}

function vp8xOnlyWebp(width=3,height=2){
  const bytes=new Uint8Array(30);
  bytes.set([0x52,0x49,0x46,0x46,22,0,0,0,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x58,10,0,0,0,0,0,0,0]);
  const w=width-1,h=height-1;bytes.set([w&255,(w>>8)&255,(w>>16)&255,h&255,(h>>8)&255,(h>>16)&255],24);
  return bytes;
}

function riffValidWebpWithUndecodableVp8(width=3,height=2){
  const bytes=new Uint8Array(30);
  bytes.set([0x52,0x49,0x46,0x46,22,0,0,0,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x20,10,0,0,0],0);
  bytes.set([0,0,0,0x9d,0x01,0x2a,width&255,(width>>8)&0x3f,height&255,(height>>8)&0x3f],20);
  return bytes;
}

class MemoryR2{
  constructor(events=[],pageSize=1000){this.objects=new Map();this.events=events;this.pageSize=pageSize;}
  async put(key,value,options={}){
    const bytes=new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key,{bytes,httpMetadata:options.httpMetadata||{},customMetadata:options.customMetadata||{}});
    this.events.push(['put',key]);
  }
  async get(key){
    const row=this.objects.get(key);if(!row)return null;
    return {...row,body:row.bytes,arrayBuffer:async()=>row.bytes.buffer.slice(row.bytes.byteOffset,row.bytes.byteOffset+row.bytes.byteLength)};
  }
  async head(key){
    const row=this.objects.get(key);return row?{httpMetadata:row.httpMetadata,customMetadata:row.customMetadata}:null;
  }
  async list({prefix='',cursor,limit=1000,include=[]}={}){
    const keys=[...this.objects.keys()].filter(key=>key.startsWith(prefix)).sort();
    const offset=cursor?Number(cursor):0;
    const selected=keys.slice(offset,offset+Math.min(limit,this.pageSize));
    const objects=selected.map(key=>({key,...(include.includes('customMetadata')?{customMetadata:this.objects.get(key).customMetadata}:{})}));
    const next=offset+selected.length;
    return {objects,truncated:next<keys.length,cursor:next<keys.length?String(next):undefined};
  }
  async delete(key){this.objects.delete(key);this.events.push(['delete',key]);}
}

class D1Statement{
  constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){
    if(this.sql.includes('FROM sessions JOIN users'))return this.args[0]===this.db.tokenHash?this.db.user:null;
    if(this.sql.includes('FROM workspace_members'))return this.args[1]===this.db.user.id&&this.db.workspaceRoles.has(this.args[0])?{role:this.db.workspaceRoles.get(this.args[0])}:null;
    if(this.sql.includes('FROM customer_workspace_state')){
      this.db.stateQueries.push(this.args[0]);
      if(!this.db.workspacePayloads.has(this.args[0]))return null;
      const payload=this.db.workspacePayloads.get(this.args[0]);
      return {payload_json:typeof payload==='string'?payload:JSON.stringify(payload)};
    }
    throw new Error(`Unexpected first query: ${this.sql}`);
  }
  async run(){
    if(!this.sql.includes('INSERT INTO audit_events'))throw new Error(`Unexpected run query: ${this.sql}`);
    if(this.db.failAudit)throw new Error('audit unavailable');
    this.db.audits.push(this.args);this.db.events.push(['audit',this.args[3]]);
    return {success:true,meta:{changes:1}};
  }
}

class D1Db{
  constructor({tokenHash,user,workspaceId,role,events,workspacePayload}){
    Object.assign(this,{tokenHash,user,workspaceId,role,events,audits:[],failAudit:false,stateQueries:[]});
    this.workspaceRoles=new Map([[workspaceId,role]]);
    this.workspacePayloads=new Map();
    if(workspacePayload!==null)this.workspacePayloads.set(workspaceId,workspacePayload);
  }
  prepare(sql){return new D1Statement(this,sql);}
}

async function fixture(role='owner',workspacePayload={main:{website:'https://workspace.example/'}}){
  const token=`asset-${role}-session`,workspaceId='workspace-secret-name',user={id:'user-1',email:'private@example.com',display_name:'Private User',role},events=[];
  const DB=new D1Db({tokenHash:await sha256(token),user,workspaceId,role,events,workspacePayload});
  return {token,workspaceId,DB,events,env:{
    DB,
    BRAND_ASSETS:new MemoryR2(events),
    BRAND_ASSET_IMPORT_HOSTS:'cdn.example.test,public.example',
    BRAND_ASSET_DNS_RESOLVER:async()=>['93.184.216.34','2606:2800:220:1:248:1893:25c8:1946']
  }};
}

function request(path,{method='GET',token,body,headers={}}={}){
  return new Request(`https://leadintel-api.edgars-7e7.workers.dev${path}`,{method,headers:{...(token?{Cookie:`leadintel_session=${token}`}:{...{}}),...headers},body});
}

function uploadRequest(workspaceId,token,{bytes=png(),type='image/png',kind='logo',filename='private-company-logo.png',altText='Company logo'}={}){
  const body=new FormData();body.set('kind',kind);body.set('alt_text',altText);body.set('file',file(bytes,type,filename));
  return request(`/api/customer/brand-assets?workspace_id=${encodeURIComponent(workspaceId)}`,{method:'POST',token,body});
}

function importRequest(workspaceId,token,url,kind='logo'){
  return request(`/api/customer/brand-assets/import?workspace_id=${workspaceId}`,{method:'POST',token,headers:{'Content-Type':'application/json'},body:JSON.stringify({url,kind,alt_text:'Imported image'})});
}

test('genuine PNG, stuffed-entropy JPEG, and VP8 WebP fixtures return decoded dimensions',async()=>{
  assert.ok(jpeg().some((byte,index,bytes)=>byte===0xff&&bytes[index+1]===0x00),'JPEG fixture must contain FF00 entropy stuffing');
  const cases=[[png(),'image/png',3,2],[jpeg(),'image/jpeg',16,16],[webp(),'image/webp',9,7]];
  for(const [bytes,type,width,height] of cases){
    const result=await validateBrandAsset(file(bytes,type),'logo');
    assert.deepEqual({mimeType:result.mimeType,width:result.width,height:result.height},{mimeType:type,width,height});
  }
});

test('declared MIME must match the complete image structure',async()=>{
  await assert.rejects(()=>validateBrandAsset(file(png(),'image/jpeg'),'logo'),/magic bytes|structure/i);
  await assert.rejects(()=>validateBrandAsset(file('<svg/>','image/svg+xml'),'logo'),/PNG, JPEG, or WebP/i);
  await assert.rejects(()=>validateBrandAsset(file('data:image/png;base64,AAAA','image/png'),'logo'),/magic bytes|structure/i);
  await assert.rejects(()=>validateBrandAsset(file(Uint8Array.from([0x4d,0x5a,0x90,0]),'image/png'),'logo'),/magic bytes|structure/i);
  await assert.rejects(()=>validateBrandAsset(file(png(),'image/png'),'avatar'),/kind/i);
});

test('malformed PNG chunks, JPEG without a scan, and WebP without image data are rejected',async()=>{
  const badCrc=png();badCrc[badCrc.length-1]^=0xff;
  await assert.rejects(()=>validateBrandAsset(file(badCrc,'image/png'),'logo'),/magic bytes|structure/i);
  await assert.rejects(()=>validateBrandAsset(file(pngWithoutIdat(),'image/png'),'logo'),/magic bytes|structure/i);
  await assert.rejects(()=>validateBrandAsset(file(headerOnlyJpeg(),'image/jpeg'),'logo'),/magic bytes|structure/i);
  await assert.rejects(()=>validateBrandAsset(file(vp8xOnlyWebp(),'image/webp'),'logo'),/magic bytes|structure/i);
});

test('CRC-valid PNG with undecodable pixel data is rejected',async()=>{
  await assert.rejects(
    ()=>validateBrandAsset(file(crcValidPngWithUndecodablePixels(),'image/png'),'logo'),
    /decode|structure/i
  );
});

test('marker-valid JPEG with an undecodable entropy scan is rejected',async()=>{
  await assert.rejects(
    ()=>validateBrandAsset(file(markerValidJpegWithUndecodableScan(),'image/jpeg'),'logo'),
    /decode|structure/i
  );
});

test('RIFF-valid WebP with an undecodable VP8 frame is rejected',async()=>{
  await assert.rejects(
    ()=>validateBrandAsset(file(riffValidWebpWithUndecodableVp8(),'image/webp'),'logo'),
    /decode|structure/i
  );
});

test('recognized images with trailing executable payloads are rejected',async()=>{
  const script=new TextEncoder().encode('<script>alert(1)</script>');
  for(const [bytes,type] of [[png(),'image/png'],[jpeg(),'image/jpeg'],[webp(),'image/webp']]){
    await assert.rejects(()=>validateBrandAsset(file(new Uint8Array([...bytes,...script]),type),'logo'),/magic bytes|structure/i);
  }
});

test('logo uses a 2 MiB limit while headshot and banner use 5 MiB',async()=>{
  const oversized=size=>({type:'image/png',size,arrayBuffer:async()=>png().buffer});
  await assert.rejects(()=>validateBrandAsset(oversized(2*MiB+1),'logo'),/2 MB/i);
  await assert.rejects(()=>validateBrandAsset(oversized(5*MiB+1),'headshot'),/5 MB/i);
  await assert.rejects(()=>validateBrandAsset(oversized(5*MiB+1),'banner'),/5 MB/i);
});

test('images above the 6000 by 6000 dimension cap are rejected',async()=>{
  await assert.rejects(()=>validateBrandAsset(file(pngWithDimensions(6001,2),'image/png'),'logo'),/6000/);
  await assert.rejects(()=>validateBrandAsset(file(pngWithDimensions(3,6001),'image/png'),'headshot'),/6000/);
});

test('an image above 4,000,000 decoded pixels is rejected before loading a decoder',()=>{
  const script=`
    import {validateBrandAsset} from './src/brand-assets.js';
    const bytes=Uint8Array.from(Buffer.from('${PNG_BASE64}','base64'));
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
    view.setUint32(16,2001);view.setUint32(20,2000);view.setUint32(29,crc32(bytes.subarray(12,29)));
    const upload={type:'image/png',size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer};
    await validateBrandAsset(upload,'logo').then(
      ()=>{throw new Error('over-budget image was accepted');},
      error=>{if(!/4,000,000 decoded pixels/.test(error.message))throw error;}
    );
  `;
  const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{
    cwd:new URL('..',import.meta.url),encoding:'utf8'
  });
  assert.equal(result.status,0,result.stderr);
});

test('only the decoder matching the declared image format is loaded',()=>{
  const cases=[
    ['image/png',PNG_BASE64,'squoosh_png_bg.wasm'],
    ['image/jpeg',JPEG_WITH_STUFFED_ENTROPY_BASE64,'mozjpeg_dec.wasm'],
    ['image/webp',WEBP_BASE64,'webp_dec.wasm']
  ];
  const directory=mkdtempSync(join(tmpdir(),'leadintel-codecs-'));
  try{
    for(const [mimeType,base64,expectedWasm] of cases){
      const logPath=join(directory,`${mimeType.split('/')[1]}.log`);
      const script=`
        import {decodeImage} from './src/image-decoders.js';
        const bytes=Uint8Array.from(Buffer.from('${base64}','base64'));
        const decoded=await decodeImage(bytes,'${mimeType}');
        if(!decoded?.width||!decoded?.height)throw new Error('decoder returned no dimensions');
      `;
      const result=spawnSync(process.execPath,[
        '--import','./test/register-wasm-loader.mjs','--input-type=module','--eval',script
      ],{
        cwd:new URL('..',import.meta.url),
        encoding:'utf8',
        env:{...process.env,LEADINTEL_WASM_LOAD_LOG:logPath}
      });
      assert.equal(result.status,0,result.stderr);
      assert.deepEqual(readFileSync(logPath,'utf8').trim().split('\n'),[expectedWasm]);
    }
  }finally{
    rmSync(directory,{recursive:true,force:true});
  }
});

test('upload requires workspace membership with owner or researcher role',async()=>{
  const owner=await fixture('owner');let response=await handleBrandAssetRoute(uploadRequest(owner.workspaceId,null),owner.env,{});assert.equal(response.status,401);assert.equal(owner.env.BRAND_ASSETS.objects.size,0);
  const sales=await fixture('sales');response=await handleBrandAssetRoute(uploadRequest(sales.workspaceId,sales.token),sales.env,{});assert.equal(response.status,403);assert.equal(sales.env.BRAND_ASSETS.objects.size,0);
  response=await handleBrandAssetRoute(uploadRequest('another-workspace',owner.token),owner.env,{});assert.equal(response.status,403);assert.equal(owner.env.BRAND_ASSETS.objects.size,0);
  const researcher=await fixture('researcher');response=await handleBrandAssetRoute(uploadRequest(researcher.workspaceId,researcher.token),researcher.env,{});assert.equal(response.status,201);
});

test('failed upload intention audit prevents the R2 put and leaves no orphan',async()=>{
  const owner=await fixture('owner');
  owner.DB.failAudit=true;

  await assert.rejects(
    ()=>handleBrandAssetRoute(uploadRequest(owner.workspaceId,owner.token),owner.env,{}),
    /audit unavailable/
  );

  assert.equal(owner.events.some(([event])=>event==='put'),false);
  assert.equal(owner.env.BRAND_ASSETS.objects.size,0);
});

test('successful upload records an authorized attempt before the R2 put',async()=>{
  const owner=await fixture('owner');

  const response=await handleBrandAssetRoute(uploadRequest(owner.workspaceId,owner.token),owner.env,{});

  assert.equal(response.status,201);
  const {asset}=await response.json();
  assert.deepEqual(owner.events,[
    ['audit','brand_asset.upload_authorized'],
    ['put',brandAssetObjectKey(asset.id)]
  ]);
});

test('uploads use fully random uncorrelated IDs and persist the validated byte digest privately',async()=>{
  const {env,token,workspaceId}=await fixture();const workspaceHash=(await sha256(workspaceId)).slice(0,16);
  const first=(await (await handleBrandAssetRoute(uploadRequest(workspaceId,token),env,{})).json()).asset;
  const second=(await (await handleBrandAssetRoute(uploadRequest(workspaceId,token),env,{})).json()).asset;
  assert.match(first.id,/^[A-Za-z0-9_-]{43}$/);assert.match(second.id,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(first.id,second.id);assert.notEqual(first.id.slice(0,16),second.id.slice(0,16));assert.equal(first.id.startsWith(workspaceHash),false);
  assert.equal(first.url,`https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${first.id}`);assert.equal(JSON.stringify(first).includes(workspaceId),false);assert.equal(JSON.stringify(first).includes('private-company-logo.png'),false);assert.equal(JSON.stringify(first).includes('private@example.com'),false);
  const key=brandAssetObjectKey(first.id);assert.equal(key,`brand-assets/${first.id}`);assert.deepEqual(env.BRAND_ASSETS.objects.get(key).customMetadata,await validatedMetadataWithDigest(png(),{workspaceId}));
});

test('public GET returns only validated bytes with strict immutable headers',async()=>{
  const {env,token,workspaceId}=await fixture();let response=await handleBrandAssetRoute(uploadRequest(workspaceId,token,{bytes:webp(),type:'image/webp',kind:'banner'}),env,{});const {asset}=await response.json();
  response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}`),env,{'Access-Control-Allow-Origin':'https://app.example'});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/webp');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(response.headers.get('Cache-Control'),'public, max-age=31536000, immutable');assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://app.example');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),webp());assert.equal(response.headers.has('X-Workspace-Id'),false);
  env.BRAND_ASSETS.objects.get(brandAssetObjectKey(asset.id)).bytes=Uint8Array.from([0x4d,0x5a]);response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}`),env,{});assert.equal(response.status,404);
});

test('public GET serves matching digest metadata without loading an image decoder',async()=>{
  const assetId=randomId('h');
  const metadata=JSON.stringify(await validatedMetadataWithDigest(png()));
  const script=`
    import {handleBrandAssetRoute} from './src/brand-assets.js';
    const bytes=Uint8Array.from(Buffer.from('${PNG_BASE64}','base64'));
    const object={bytes,body:new Response(bytes).body,httpMetadata:{contentType:'image/png'},customMetadata:${metadata}};
    const env={BRAND_ASSETS:{get:async()=>object}};
    const request=new Request('https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/${assetId}');
    const response=await handleBrandAssetRoute(request,env,{});
    if(response.status!==200)throw new Error('unexpected status '+response.status);
  `;
  const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{
    cwd:new URL('..',import.meta.url),encoding:'utf8'
  });
  assert.equal(result.status,0,result.stderr);
});

test('public GET fails closed when private validation metadata is missing or malformed',async()=>{
  const assetId=randomId('i'),key=brandAssetObjectKey(assetId),events=[];
  const bucket=new MemoryR2(events);
  const requestForAsset=request(`/api/customer/brand-assets/${assetId}`);
  const invalidMetadata=[
    {},
    {...validatedMetadata(),validation:'unknown'},
    {...validatedMetadata(),validatedMimeType:'image/svg+xml'},
    {...validatedMetadata(),validatedSize:'not-a-number'},
    {...validatedMetadata(),validatedSize:String(png().byteLength+1)},
    {...validatedMetadata(),validatedWidth:'0'},
    {...validatedMetadata(),validatedWidth:'2001',validatedHeight:'2000'}
  ];
  for(const customMetadata of invalidMetadata){
    bucket.objects.set(key,{bytes:png(),httpMetadata:{contentType:'image/png'},customMetadata});
    const response=await handleBrandAssetRoute(requestForAsset,{BRAND_ASSETS:bucket},{});
    assert.equal(response.status,404);
  }
});

test('public GET rejects same-length substituted bytes when trusted metadata is unchanged',async()=>{
  const assetId=randomId('j'),key=brandAssetObjectKey(assetId),trusted=png();
  const bucket=new MemoryR2();
  bucket.objects.set(key,{
    bytes:Uint8Array.from({length:trusted.byteLength},(_,index)=>index===0?0x4d:index===1?0x5a:0),
    httpMetadata:{contentType:'image/png'},
    customMetadata:await validatedMetadataWithDigest(trusted)
  });

  const response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${assetId}`),{BRAND_ASSETS:bucket},{});
  assert.equal(response.status,404);
});

test('public GET requires a canonical SHA-256 digest and serves only matching genuine bytes',async()=>{
  const assetId=randomId('k'),key=brandAssetObjectKey(assetId),bytes=png(),bucket=new MemoryR2();
  const metadata=await validatedMetadataWithDigest(bytes);
  bucket.objects.set(key,{bytes,httpMetadata:{contentType:'image/png'},customMetadata:metadata});
  let response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${assetId}`),{BRAND_ASSETS:bucket},{});
  assert.equal(response.status,200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);

  for(const digest of [undefined,'',metadata['content-sha256'].toUpperCase(),'0'.repeat(63),'g'.repeat(64)]){
    bucket.objects.set(key,{bytes,httpMetadata:{contentType:'image/png'},customMetadata:{...metadata,'content-sha256':digest}});
    response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${assetId}`),{BRAND_ASSETS:bucket},{});
    assert.equal(response.status,404);
  }
});

test('delete verifies workspace ownership and commits audit before deleting bytes',async()=>{
  const owner=await fixture();let response=await handleBrandAssetRoute(uploadRequest(owner.workspaceId,owner.token),owner.env,{});const {asset}=await response.json();const key=brandAssetObjectKey(asset.id);
  response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}?workspace_id=another-workspace`,{method:'DELETE',token:owner.token}),owner.env,{});assert.equal(response.status,403);assert.equal(owner.env.BRAND_ASSETS.objects.has(key),true);
  owner.events.length=0;response=await handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}?workspace_id=${owner.workspaceId}`,{method:'DELETE',token:owner.token}),owner.env,{});assert.equal(response.status,200);assert.equal(owner.env.BRAND_ASSETS.objects.has(key),false);assert.deepEqual(owner.events,[['audit','brand_asset.deleted'],['delete',key]]);
});

test('route deletion leaves bytes intact when the required audit write fails',async()=>{
  const owner=await fixture();const response=await handleBrandAssetRoute(uploadRequest(owner.workspaceId,owner.token),owner.env,{});const {asset}=await response.json();const key=brandAssetObjectKey(asset.id);owner.DB.failAudit=true;owner.events.length=0;
  await assert.rejects(()=>handleBrandAssetRoute(request(`/api/customer/brand-assets/${asset.id}?workspace_id=${owner.workspaceId}`,{method:'DELETE',token:owner.token}),owner.env,{}),/audit unavailable/);assert.equal(owner.env.BRAND_ASSETS.objects.has(key),true);assert.deepEqual(owner.events,[]);
});

test('deleteBrandAsset primitive uses the same audited delete contract',async()=>{
  const owner=await fixture();const assetId=randomId('a'),key=brandAssetObjectKey(assetId);owner.env.BRAND_ASSETS.objects.set(key,{bytes:png(),httpMetadata:{contentType:'image/png'},customMetadata:{workspaceId:owner.workspaceId}});
  await deleteBrandAsset(owner.env,{workspaceId:owner.workspaceId,assetId,userId:owner.DB.user.id,eventType:'brand_asset.deleted'});assert.deepEqual(owner.events,[['audit','brand_asset.deleted'],['delete',key]]);
});

test('deleteBrandAsset primitive preserves bytes when audit fails',async()=>{
  const owner=await fixture();const assetId=randomId('b'),key=brandAssetObjectKey(assetId);owner.env.BRAND_ASSETS.objects.set(key,{bytes:png(),httpMetadata:{contentType:'image/png'},customMetadata:{workspaceId:owner.workspaceId}});owner.DB.failAudit=true;
  await assert.rejects(()=>deleteBrandAsset(owner.env,{workspaceId:owner.workspaceId,assetId,userId:owner.DB.user.id,eventType:'brand_asset.deleted'}),/audit unavailable/);assert.equal(owner.env.BRAND_ASSETS.objects.has(key),true);assert.equal(owner.events.some(([event])=>event==='delete'),false);
});

test('remote import is disabled for every authenticated host source and never performs a fetch',async()=>{
  const cases=[
    {payload:{main:{website:'https://company.example/'}},configured:'',url:'https://company.example/logo.png'},
    {payload:{main:{website:'https://company.example/'}},configured:'cdn.example.test',url:'https://cdn.example.test/logo.png'},
    {payload:{main:{website:'https://company.example/'}},configured:'cdn.example.test',url:'https://arbitrary.example/logo.png'}
  ];
  const originalFetch=globalThis.fetch;
  let fetches=0;
  globalThis.fetch=async()=>{fetches++;throw new Error('remote fetch must not run');};
  try{
    for(const entry of cases){
      const {env,token,workspaceId}=await fixture('owner',entry.payload);
      env.BRAND_ASSET_IMPORT_HOSTS=entry.configured;
      let resolutions=0;
      env.BRAND_ASSET_DNS_RESOLVER=async()=>{resolutions++;return ['93.184.216.34'];};
      const response=await handleBrandAssetRoute(importRequest(workspaceId,token,entry.url),env,{});
      assert.equal(response.status,503,entry.url);
      assert.deepEqual(await response.json(),{error:'Secure remote image import is unavailable. Download the image and upload it instead.'});
      assert.equal(resolutions,0,entry.url);
    }
    assert.equal(fetches,0);
  }finally{globalThis.fetch=originalFetch;}
});

test('disabled remote import still enforces authentication while multipart upload remains functional',async()=>{
  const {env,token,workspaceId}=await fixture();
  const originalFetch=globalThis.fetch;
  let fetches=0;
  globalThis.fetch=async()=>{fetches++;throw new Error('remote fetch must not run');};
  try{
    assert.equal((await handleBrandAssetRoute(importRequest(workspaceId,null,'https://cdn.example.test/logo.png'),env,{})).status,401);
    assert.equal((await handleBrandAssetRoute(importRequest(workspaceId,token,'https://cdn.example.test/logo.png'),env,{})).status,503);
    const uploaded=await handleBrandAssetRoute(uploadRequest(workspaceId,token),env,{});
    assert.equal(uploaded.status,201);
    const payload=await uploaded.json();
    assert.match(payload.asset.id,/^[A-Za-z0-9_-]{43}$/);
    assert.match(payload.asset.url,/\/api\/customer\/brand-assets\//);
    assert.equal(env.BRAND_ASSETS.objects.size,1);
    assert.equal(fetches,0);
  }finally{globalThis.fetch=originalFetch;}
});

test('brand asset service contains no remote-fetch or DNS-resolution implementation',()=>{
  const source=readFileSync(new URL('../src/brand-assets.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/DNS_OVER_HTTPS|BRAND_ASSET_DNS|resolveImportHost|fetchImportedFile/);
  assert.doesNotMatch(source,/\bfetch\s*\(/);
});

test('replacement saves metadata and retains old bytes for immutable approved outreach',async()=>{
  const owner=await fixture();const oldId=randomId('c'),nextId=randomId('d'),oldKey=brandAssetObjectKey(oldId),nextKey=brandAssetObjectKey(nextId);
  owner.env.BRAND_ASSETS.objects.set(oldKey,{bytes:png(),httpMetadata:{},customMetadata:{workspaceId:owner.workspaceId}});owner.env.BRAND_ASSETS.objects.set(nextKey,{bytes:png(),httpMetadata:{},customMetadata:{workspaceId:owner.workspaceId}});owner.events.length=0;
  await replaceBrandAsset(owner.env,{workspaceId:owner.workspaceId,userId:owner.DB.user.id,previousAssetId:oldId,nextAsset:{id:nextId},saveMetadata:async()=>owner.events.push(['saved'])});assert.deepEqual(owner.events,[['saved']]);assert.equal(owner.env.BRAND_ASSETS.objects.has(oldKey),true);assert.equal(owner.env.BRAND_ASSETS.objects.has(nextKey),true);
});

test('workspace reset deletion removes every current and retained workspace asset but preserves other workspaces',async()=>{
  const owner=await fixture();owner.env.BRAND_ASSETS.pageSize=1;const retainedId=randomId('r'),currentId=randomId('s'),foreignId=randomId('t');
  for(const [id,workspaceId] of [[retainedId,owner.workspaceId],[currentId,owner.workspaceId],[foreignId,'foreign-workspace']])owner.env.BRAND_ASSETS.objects.set(brandAssetObjectKey(id),{bytes:png(),httpMetadata:{contentType:'image/png'},customMetadata:await validatedMetadataWithDigest(png(),{workspaceId})});
  owner.events.length=0;
  const response=await handleBrandAssetRoute(request(`/api/customer/brand-assets?workspace_id=${owner.workspaceId}`,{method:'DELETE',token:owner.token}),owner.env,{});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,deleted:2});
  assert.equal(owner.env.BRAND_ASSETS.objects.has(brandAssetObjectKey(retainedId)),false);assert.equal(owner.env.BRAND_ASSETS.objects.has(brandAssetObjectKey(currentId)),false);assert.equal(owner.env.BRAND_ASSETS.objects.has(brandAssetObjectKey(foreignId)),true);
  assert.deepEqual(owner.events,[['audit','brand_asset.workspace_reset_deleted'],['delete',brandAssetObjectKey(retainedId)],['audit','brand_asset.workspace_reset_deleted'],['delete',brandAssetObjectKey(currentId)]]);
});

test('workspace reset paginates beyond 10,000 foreign assets and still deletes the owned asset',async()=>{
  const owner=await fixture();owner.env.BRAND_ASSETS.pageSize=997;
  for(let index=0;index<10_050;index++){
    const key=`brand-assets/${String(index).padStart(43,'0')}`;
    owner.env.BRAND_ASSETS.objects.set(key,{bytes:png(),httpMetadata:{contentType:'image/png'},customMetadata:{workspaceId:'foreign-workspace'}});
  }
  const ownedId='z'.repeat(43),ownedKey=brandAssetObjectKey(ownedId);
  owner.env.BRAND_ASSETS.objects.set(ownedKey,{bytes:png(),httpMetadata:{contentType:'image/png'},customMetadata:await validatedMetadataWithDigest(png(),{workspaceId:owner.workspaceId})});
  owner.events.length=0;
  const response=await handleBrandAssetRoute(request(`/api/customer/brand-assets?workspace_id=${owner.workspaceId}`,{method:'DELETE',token:owner.token}),owner.env,{});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,deleted:1});
  assert.equal(owner.env.BRAND_ASSETS.objects.has(ownedKey),false);assert.equal(owner.env.BRAND_ASSETS.objects.size,10_050);
  assert.deepEqual(owner.events,[['audit','brand_asset.workspace_reset_deleted'],['delete',ownedKey]]);
});

test('workspace reset fails closed on malformed inventory pages and repeated cursors',async()=>{
  for(const list of [
    async()=>({objects:[]}),
    async()=>({objects:[],truncated:true,cursor:'same'})
  ]){
    const owner=await fixture();owner.env.BRAND_ASSETS.list=list;
    const response=await handleBrandAssetRoute(request(`/api/customer/brand-assets?workspace_id=${owner.workspaceId}`,{method:'DELETE',token:owner.token}),owner.env,{});
    assert.equal(response.status,503);
    assert.equal(owner.env.BRAND_ASSETS.objects.size,0);
  }
});

test('failed replacement preserves old bytes and uses audited cleanup for the new object',async()=>{
  const owner=await fixture();const oldId=randomId('e'),nextId=randomId('f'),oldKey=brandAssetObjectKey(oldId),nextKey=brandAssetObjectKey(nextId);
  owner.env.BRAND_ASSETS.objects.set(oldKey,{bytes:png(),httpMetadata:{},customMetadata:{workspaceId:owner.workspaceId}});owner.env.BRAND_ASSETS.objects.set(nextKey,{bytes:png(),httpMetadata:{},customMetadata:{workspaceId:owner.workspaceId}});owner.events.length=0;
  await assert.rejects(()=>replaceBrandAsset(owner.env,{workspaceId:owner.workspaceId,userId:owner.DB.user.id,previousAssetId:oldId,nextAsset:{id:nextId},saveMetadata:async()=>{throw new Error('revision conflict');}}),/revision conflict/);assert.equal(owner.env.BRAND_ASSETS.objects.has(oldKey),true);assert.equal(owner.env.BRAND_ASSETS.objects.has(nextKey),false);assert.deepEqual(owner.events,[['audit','brand_asset.replacement_rolled_back'],['delete',nextKey]]);
});

test('production app serves public asset GET before rejecting an unrelated Origin',async()=>{
  const events=[],bucket=new MemoryR2(events),assetId=randomId('g'),key=`brand-assets/${assetId}`;bucket.objects.set(key,{bytes:png(),httpMetadata:{contentType:'image/png'},customMetadata:await validatedMetadataWithDigest(png())});
  const response=await app.fetch(request(`/api/customer/brand-assets/${assetId}`,{headers:{Origin:'https://email-client.example'}}),{APP_ORIGIN:'https://leadintel.ccgroup.lv',BRAND_ASSETS:bucket});assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/png');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png());
});

test('unrelated paths return null',async()=>{const {env}=await fixture();assert.equal(await handleBrandAssetRoute(request('/api/health'),env,{}),null);});
