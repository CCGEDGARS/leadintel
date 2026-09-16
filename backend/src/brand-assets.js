import {constantTimeEqual,cookieValue,randomToken,sha256} from './security.js';
import {decodeImage} from './image-decoders.js';

const PUBLIC_ASSET_ORIGIN='https://leadintel-api.edgars-7e7.workers.dev';
const ASSET_PATH='/api/customer/brand-assets';
const IMAGE_TYPES=new Set(['image/png','image/jpeg','image/webp']);
const KIND_LIMITS={
  logo:2*1024*1024,
  headshot:5*1024*1024,
  banner:5*1024*1024
};
const MAX_DIMENSION=6000;
const MAX_DECODED_PIXELS=4_000_000;
const MAX_STORED_BYTES=5*1024*1024;
const ASSET_VALIDATION='decoded-v1';
const CONTENT_SHA256_METADATA='content-sha256';
const CONTENT_SHA256=/^[a-f0-9]{64}$/;
const ASSET_ID=/^[A-Za-z0-9_-]{43}$/;
const JPEG_SOF_MARKERS=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);

const CRC_TABLE=new Uint32Array(256);
for(let value=0;value<CRC_TABLE.length;value++){
  let crc=value;
  for(let bit=0;bit<8;bit++){
    crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  CRC_TABLE[value]=crc>>>0;
}

class BrandAssetError extends Error{
  constructor(message,status=400){
    super(message);
    this.name='BrandAssetError';
    this.status=status;
  }
}

function json(value,status=200,headers={}){
  return new Response(JSON.stringify(value),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      ...headers
    }
  });
}

function error(message,status,headers){
  return json({error:message},status,headers);
}

function limitForKind(kind){
  const normalized=String(kind||'').trim().toLowerCase();
  const limit=KIND_LIMITS[normalized];
  if(!limit){
    throw new BrandAssetError('Brand asset kind must be logo, headshot, or banner');
  }
  return {kind:normalized,limit};
}

function normalizeMime(value){
  return String(value||'').split(';',1)[0].trim().toLowerCase();
}

function fourCc(bytes,offset){
  return String.fromCharCode(...bytes.subarray(offset,offset+4));
}

function crc32(bytes,start,end){
  let crc=0xffffffff;
  for(let index=start;index<end;index++){
    crc=CRC_TABLE[(crc^bytes[index])&0xff]^(crc>>>8);
  }
  return (crc^0xffffffff)>>>0;
}

function validPngColor(bitDepth,colorType){
  const depths={
    0:new Set([1,2,4,8,16]),
    2:new Set([8,16]),
    3:new Set([1,2,4,8]),
    4:new Set([8,16]),
    6:new Set([8,16])
  };
  return depths[colorType]?.has(bitDepth)===true;
}

function pngInfo(bytes){
  const signature=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  if(bytes.length<57||!signature.every((value,index)=>bytes[index]===value)){
    return null;
  }

  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=8;
  let info=null;
  let sawIdat=false;
  let idatFinished=false;
  let chunkIndex=0;

  while(offset+12<=bytes.length){
    const length=view.getUint32(offset);
    const typeOffset=offset+4;
    const dataOffset=offset+8;
    const dataEnd=dataOffset+length;
    const chunkEnd=dataEnd+4;
    if(chunkEnd>bytes.length){
      return null;
    }

    const type=fourCc(bytes,typeOffset);
    const expectedCrc=view.getUint32(dataEnd);
    if(crc32(bytes,typeOffset,dataEnd)!==expectedCrc){
      return null;
    }

    if(chunkIndex===0&&type!=='IHDR'){
      return null;
    }

    if(type==='IHDR'){
      if(chunkIndex!==0||info||length!==13){
        return null;
      }
      const width=view.getUint32(dataOffset);
      const height=view.getUint32(dataOffset+4);
      const bitDepth=bytes[dataOffset+8];
      const colorType=bytes[dataOffset+9];
      const compression=bytes[dataOffset+10];
      const filter=bytes[dataOffset+11];
      const interlace=bytes[dataOffset+12];
      if(!width||!height||!validPngColor(bitDepth,colorType)||compression!==0||filter!==0||interlace>1){
        return null;
      }
      info={mimeType:'image/png',width,height};
    }else if(type==='PLTE'){
      if(!info||sawIdat||length===0||length%3!==0||length>768){
        return null;
      }
    }else if(type==='IDAT'){
      if(!info||idatFinished||length===0){
        return null;
      }
      sawIdat=true;
    }else{
      if(sawIdat){
        idatFinished=true;
      }
      if(type==='IEND'){
        if(length!==0||!info||!sawIdat||chunkEnd!==bytes.length){
          return null;
        }
        return info;
      }
      const critical=type.length===4&&type.charCodeAt(0)>=65&&type.charCodeAt(0)<=90;
      if(critical){
        return null;
      }
    }

    offset=chunkEnd;
    chunkIndex++;
  }

  return null;
}

function jpegInfo(bytes){
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8){
    return null;
  }

  let offset=2;
  let info=null;
  let inScan=false;
  let sawSos=false;
  let sawScanData=false;

  while(offset<bytes.length){
    if(inScan){
      const value=bytes[offset++];
      if(value!==0xff){
        sawScanData=true;
        continue;
      }

      while(offset<bytes.length&&bytes[offset]===0xff){
        offset++;
      }
      if(offset>=bytes.length){
        return null;
      }

      const marker=bytes[offset++];
      if(marker===0x00){
        sawScanData=true;
        continue;
      }
      if(marker>=0xd0&&marker<=0xd7){
        sawScanData=true;
        continue;
      }
      if(marker===0xd9){
        return info&&sawSos&&sawScanData&&offset===bytes.length?info:null;
      }
      inScan=false;

      if(marker===0xd8||marker===0x01){
        return null;
      }
      if(offset+2>bytes.length){
        return null;
      }
      const length=(bytes[offset]<<8)|bytes[offset+1];
      if(length<2||offset+length>bytes.length){
        return null;
      }
      if(marker===0xda){
        if(!info||length<6){
          return null;
        }
        sawSos=true;
        inScan=true;
      }
      offset+=length;
      continue;
    }

    if(bytes[offset++]!==0xff){
      return null;
    }
    while(offset<bytes.length&&bytes[offset]===0xff){
      offset++;
    }
    if(offset>=bytes.length){
      return null;
    }

    const marker=bytes[offset++];
    if(marker===0xd9){
      return info&&sawSos&&sawScanData&&offset===bytes.length?info:null;
    }
    if(marker===0x00||marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd7)){
      return null;
    }
    if(offset+2>bytes.length){
      return null;
    }

    const length=(bytes[offset]<<8)|bytes[offset+1];
    if(length<2||offset+length>bytes.length){
      return null;
    }

    if(JPEG_SOF_MARKERS.has(marker)){
      if(info||length<8){
        return null;
      }
      const height=(bytes[offset+3]<<8)|bytes[offset+4];
      const width=(bytes[offset+5]<<8)|bytes[offset+6];
      if(!width||!height){
        return null;
      }
      info={mimeType:'image/jpeg',width,height};
    }

    if(marker===0xda){
      if(!info||length<6){
        return null;
      }
      sawSos=true;
      inScan=true;
    }
    offset+=length;
  }

  return null;
}

function webpInfo(bytes){
  if(bytes.length<20||fourCc(bytes,0)!=='RIFF'||fourCc(bytes,8)!=='WEBP'){
    return null;
  }

  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(4,true)!==bytes.length-8){
    return null;
  }

  let offset=12;
  let canvas=null;
  let image=null;
  let imageChunks=0;

  while(offset+8<=bytes.length){
    const type=fourCc(bytes,offset);
    const length=view.getUint32(offset+4,true);
    const dataOffset=offset+8;
    const dataEnd=dataOffset+length;
    const chunkEnd=dataEnd+(length&1);
    if(chunkEnd>bytes.length){
      return null;
    }

    if(type==='VP8X'){
      if(canvas||length!==10){
        return null;
      }
      canvas={
        width:1+bytes[dataOffset+4]+(bytes[dataOffset+5]<<8)+(bytes[dataOffset+6]<<16),
        height:1+bytes[dataOffset+7]+(bytes[dataOffset+8]<<8)+(bytes[dataOffset+9]<<16)
      };
    }else if(type==='VP8 '){
      if(length<10||bytes[dataOffset+3]!==0x9d||bytes[dataOffset+4]!==0x01||bytes[dataOffset+5]!==0x2a){
        return null;
      }
      imageChunks++;
      image={
        width:(bytes[dataOffset+6]|(bytes[dataOffset+7]<<8))&0x3fff,
        height:(bytes[dataOffset+8]|(bytes[dataOffset+9]<<8))&0x3fff
      };
    }else if(type==='VP8L'){
      if(length<5||bytes[dataOffset]!==0x2f){
        return null;
      }
      imageChunks++;
      image={
        width:1+bytes[dataOffset+1]+((bytes[dataOffset+2]&0x3f)<<8),
        height:1+(bytes[dataOffset+2]>>6)+(bytes[dataOffset+3]<<2)+((bytes[dataOffset+4]&0x0f)<<10)
      };
    }

    offset=chunkEnd;
  }

  if(offset!==bytes.length||imageChunks!==1||!image?.width||!image?.height){
    return null;
  }
  const dimensions=canvas||image;
  return {mimeType:'image/webp',width:dimensions.width,height:dimensions.height};
}

function imageInfo(bytes){
  return pngInfo(bytes)||jpegInfo(bytes)||webpInfo(bytes);
}

async function contentSha256(bytes){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function fullyDecodedInfo(bytes,containerInfo){
  let decoded;
  try{
    decoded=await decodeImage(bytes,containerInfo.mimeType);
  }catch{
    return null;
  }

  const width=Number(decoded?.width);
  const height=Number(decoded?.height);
  const expectedPixels=width*height*4;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1){
    return null;
  }
  if(width!==containerInfo.width||height!==containerInfo.height){
    return null;
  }
  if(decoded?.data?.byteLength!==expectedPixels){
    return null;
  }
  return containerInfo;
}

export async function validateBrandAsset(file,kind){
  const {limit}=limitForKind(kind);
  const mimeType=normalizeMime(file?.type);
  if(!IMAGE_TYPES.has(mimeType)){
    throw new BrandAssetError('Brand assets must be PNG, JPEG, or WebP images');
  }

  const size=Number(file?.size);
  if(!Number.isSafeInteger(size)||size<1){
    throw new BrandAssetError('Brand asset is empty or has an invalid size');
  }
  if(size>limit){
    const label=limit===KIND_LIMITS.logo?'2 MB':'5 MB';
    throw new BrandAssetError(`Brand asset exceeds the ${label} limit`,413);
  }
  if(typeof file.arrayBuffer!=='function'){
    throw new BrandAssetError('Brand asset file is invalid');
  }

  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength!==size){
    throw new BrandAssetError('Brand asset size changed while reading');
  }
  const info=imageInfo(bytes);
  if(!info||info.mimeType!==mimeType){
    throw new BrandAssetError('Brand asset MIME type does not match its complete image structure');
  }
  if(info.width>MAX_DIMENSION||info.height>MAX_DIMENSION){
    throw new BrandAssetError('Brand asset dimensions must be between 1 and 6000 pixels');
  }
  if(info.width*info.height>MAX_DECODED_PIXELS){
    throw new BrandAssetError('Brand asset exceeds the 4,000,000 decoded pixels limit');
  }
  const decodedInfo=await fullyDecodedInfo(bytes,info);
  if(!decodedInfo){
    throw new BrandAssetError('Brand asset could not be fully decoded');
  }
  return {...decodedInfo,size,bytes};
}

function parsedAssetId(assetId){
  const id=String(assetId||'');
  return ASSET_ID.test(id)?id:null;
}

export function brandAssetObjectKey(assetId){
  const id=parsedAssetId(assetId);
  if(!id){
    throw new BrandAssetError('Brand asset not found',404);
  }
  return `brand-assets/${id}`;
}

async function sessionUser(request,env){
  const token=cookieValue(request,'leadintel_session');
  if(!token){
    return null;
  }
  const tokenHash=await sha256(token);
  return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();
}

async function membership(env,workspaceId,userId){
  return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();
}

async function requireWorkspaceWriter(request,env,workspaceId){
  const user=await sessionUser(request,env);
  if(!user){
    return {error:'Authentication required',status:401};
  }
  const member=await membership(env,workspaceId,user.id);
  if(!member){
    return {error:'Workspace access denied',status:403};
  }
  if(!['owner','researcher'].includes(member.role)){
    return {error:'Workspace role is not permitted',status:403};
  }
  return {user,member};
}

async function audit(env,{workspaceId,userId,type,assetId,metadata={}}){
  if(!userId){
    throw new TypeError('userId is required for brand asset audit');
  }
  await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(
    crypto.randomUUID(),
    workspaceId,
    userId,
    type,
    'brand_asset',
    assetId,
    JSON.stringify(metadata)
  ).run();
}

function requireBinding(env){
  if(!env.BRAND_ASSETS){
    throw new BrandAssetError('Brand asset storage is not configured',503);
  }
  return env.BRAND_ASSETS;
}

async function assetOwnership(env,assetId){
  const key=brandAssetObjectKey(assetId);
  const object=await requireBinding(env).head(key);
  if(!object){
    throw new BrandAssetError('Brand asset not found',404);
  }
  return {key,workspaceId:String(object.customMetadata?.workspaceId||'')};
}

async function requireAssetOwner(env,workspaceId,assetId){
  const ownership=await assetOwnership(env,assetId);
  if(!ownership.workspaceId||ownership.workspaceId!==String(workspaceId)){
    throw new BrandAssetError('Workspace access denied',403);
  }
  return ownership;
}

async function createAsset(env,{workspaceId,validated,kind,altText,eventType,userId}){
  const id=randomToken(32);
  const key=brandAssetObjectKey(id);
  const bucket=requireBinding(env);
  const asset={
    id,
    url:`${PUBLIC_ASSET_ORIGIN}${ASSET_PATH}/${id}`,
    mimeType:validated.mimeType,
    width:validated.width,
    height:validated.height,
    altText:String(altText||'').trim().slice(0,300),
    updatedAt:new Date().toISOString()
  };
  await audit(env,{
    workspaceId,
    userId,
    type:eventType,
    assetId:id,
    metadata:{
      kind,
      size:validated.size,
      mime_type:validated.mimeType,
      width:validated.width,
      height:validated.height
    }
  });
  const digest=await contentSha256(validated.bytes);
  await bucket.put(key,validated.bytes,{
    httpMetadata:{contentType:validated.mimeType},
    customMetadata:{
      workspaceId:String(workspaceId),
      validation:ASSET_VALIDATION,
      validatedMimeType:validated.mimeType,
      validatedSize:String(validated.size),
      validatedWidth:String(validated.width),
      validatedHeight:String(validated.height),
      [CONTENT_SHA256_METADATA]:digest
    }
  });
  return asset;
}

export async function deleteBrandAsset(env,{workspaceId,assetId,userId,eventType='brand_asset.deleted',metadata={}}){
  const {key}=await requireAssetOwner(env,workspaceId,assetId);
  await audit(env,{workspaceId,userId,type:eventType,assetId,metadata});
  await requireBinding(env).delete(key);
}

export async function replaceBrandAsset(env,{workspaceId,userId,previousAssetId,nextAsset,saveMetadata}){
  if(typeof saveMetadata!=='function'){
    throw new TypeError('saveMetadata must be a function');
  }
  if(!nextAsset?.id){
    throw new BrandAssetError('Replacement asset is required');
  }
  await requireAssetOwner(env,workspaceId,nextAsset.id);

  try{
    await saveMetadata(nextAsset);
  }catch(cause){
    await deleteBrandAsset(env,{
      workspaceId,
      assetId:nextAsset.id,
      userId,
      eventType:'brand_asset.replacement_rolled_back'
    }).catch(()=>{});
    throw cause;
  }

  // Previous objects can be referenced by immutable approved outreach. They
  // are retained until the authenticated workspace-wide reset removes every
  // R2 object owned by this workspace.
  return nextAsset;
}

export async function deleteWorkspaceBrandAssets(env,{workspaceId,userId}){
  const bucket=requireBinding(env);
  const keys=[];
  const seenCursors=new Set();
  let cursor;
  do{
    const page=await bucket.list({prefix:'brand-assets/',cursor,limit:1000,include:['customMetadata']});
    if(!page||!Array.isArray(page.objects)||typeof page.truncated!=='boolean')throw new BrandAssetError('Brand asset inventory is unavailable',503);
    for(const object of page.objects){
      if(String(object?.customMetadata?.workspaceId||'')===String(workspaceId)&&typeof object?.key==='string')keys.push(object.key);
    }
    if(!page.truncated)break;
    const next=String(page.cursor||'');
    if(!next||seenCursors.has(next))throw new BrandAssetError('Brand asset inventory pagination failed',503);
    seenCursors.add(next);cursor=next;
  }while(true);

  let deleted=0;
  for(const key of keys){
    const assetId=key.slice('brand-assets/'.length);
    if(!parsedAssetId(assetId))throw new BrandAssetError('Brand asset inventory is invalid',503);
    await deleteBrandAsset(env,{workspaceId,assetId,userId,eventType:'brand_asset.workspace_reset_deleted'});
    deleted++;
  }
  return {deleted};
}

async function storedObjectBytes(object,limit){
  if(!Number.isSafeInteger(limit)||limit<1||Number(object.size)>limit){
    return null;
  }
  if(!object.body){
    return null;
  }

  const body=typeof object.body.getReader==='function'?object.body:new Response(object.body).body;
  if(!body){
    return null;
  }
  const reader=body.getReader();
  const chunks=[];
  let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done){
        break;
      }
      size+=value.byteLength;
      if(size>limit){
        await reader.cancel().catch(()=>{});
        return null;
      }
      chunks.push(value);
    }
  }catch{
    await reader.cancel().catch(()=>{});
    return null;
  }

  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){
    bytes.set(chunk,offset);
    offset+=chunk.byteLength;
  }
  return bytes;
}

function positiveInteger(value){
  const text=String(value||'');
  if(!/^[1-9]\d*$/.test(text)){
    return null;
  }
  const number=Number(text);
  return Number.isSafeInteger(number)?number:null;
}

function storedValidation(object){
  const metadata=object.customMetadata;
  if(!metadata||metadata.validation!==ASSET_VALIDATION||typeof metadata.workspaceId!=='string'||!metadata.workspaceId.trim()){
    return null;
  }
  const mimeType=metadata.validatedMimeType;
  const size=positiveInteger(metadata.validatedSize);
  const width=positiveInteger(metadata.validatedWidth);
  const height=positiveInteger(metadata.validatedHeight);
  const digest=metadata[CONTENT_SHA256_METADATA];
  if(!IMAGE_TYPES.has(mimeType)||!size||size>MAX_STORED_BYTES||!width||!height||typeof digest!=='string'||!CONTENT_SHA256.test(digest)){
    return null;
  }
  if(width>MAX_DIMENSION||height>MAX_DIMENSION||width*height>MAX_DECODED_PIXELS){
    return null;
  }
  if(normalizeMime(object.httpMetadata?.contentType)!==mimeType){
    return null;
  }
  if(object.size!==undefined&&Number(object.size)!==size){
    return null;
  }
  return {mimeType,size,digest};
}

async function serveAsset(assetId,env,cors){
  const id=parsedAssetId(assetId);
  if(!id){
    return error('Brand asset not found',404,cors);
  }
  const object=await requireBinding(env).get(brandAssetObjectKey(id));
  if(!object){
    return error('Brand asset not found',404,cors);
  }

  const validation=storedValidation(object);
  if(!validation){
    return error('Brand asset not found',404,cors);
  }
  const bytes=await storedObjectBytes(object,validation.size);
  if(!bytes||bytes.byteLength!==validation.size||!constantTimeEqual(validation.digest,await contentSha256(bytes))){
    return error('Brand asset not found',404,cors);
  }
  return new Response(bytes,{
    status:200,
    headers:{
      ...cors,
      'Content-Type':validation.mimeType,
      'Content-Length':String(bytes.byteLength),
      'X-Content-Type-Options':'nosniff',
      'Cache-Control':'public, max-age=31536000, immutable'
    }
  });
}

export async function handleBrandAssetRoute(request,env,cors={}){
  const url=new URL(request.url);
  const path=url.pathname;
  const known=path===ASSET_PATH||path===`${ASSET_PATH}/import`||path.startsWith(`${ASSET_PATH}/`);
  if(!known){
    return null;
  }

  try{
    if(path===`${ASSET_PATH}/import`){
      if(request.method!=='POST'){
        return error('Method not allowed',405,cors);
      }
      const workspaceId=url.searchParams.get('workspace_id')||'';
      const access=await requireWorkspaceWriter(request,env,workspaceId);
      if(access.error){
        return error(access.error,access.status,cors);
      }
      return error('Secure remote image import is unavailable. Download the image and upload it instead.',503,cors);
    }

    if(path===ASSET_PATH){
      if(!['POST','DELETE'].includes(request.method)){
        return error('Method not allowed',405,cors);
      }
      const workspaceId=url.searchParams.get('workspace_id')||'';
      const access=await requireWorkspaceWriter(request,env,workspaceId);
      if(access.error){
        return error(access.error,access.status,cors);
      }
      if(request.method==='DELETE'){
        const result=await deleteWorkspaceBrandAssets(env,{workspaceId,userId:access.user.id});
        return json({ok:true,deleted:result.deleted},200,cors);
      }
      const form=await request.formData().catch(()=>null);
      if(!form){
        return error('Valid multipart form data is required',400,cors);
      }
      const kind=String(form.get('kind')||'').toLowerCase();
      const validated=await validateBrandAsset(form.get('file'),kind);
      const asset=await createAsset(env,{
        workspaceId,
        validated,
        kind,
        altText:form.get('alt_text'),
        eventType:'brand_asset.upload_authorized',
        userId:access.user.id
      });
      return json({asset},201,cors);
    }

    let assetId;
    try{
      assetId=decodeURIComponent(path.slice(ASSET_PATH.length+1));
    }catch{
      return error('Brand asset not found',404,cors);
    }
    if(request.method==='GET'){
      return serveAsset(assetId,env,cors);
    }
    if(request.method==='DELETE'){
      const workspaceId=url.searchParams.get('workspace_id')||'';
      const access=await requireWorkspaceWriter(request,env,workspaceId);
      if(access.error){
        return error(access.error,access.status,cors);
      }
      await deleteBrandAsset(env,{
        workspaceId,
        assetId,
        userId:access.user.id,
        eventType:'brand_asset.deleted'
      });
      return json({ok:true,asset_id:assetId},200,cors);
    }
    return error('Method not allowed',405,cors);
  }catch(cause){
    if(cause instanceof BrandAssetError){
      return error(cause.message,cause.status,cors);
    }
    throw cause;
  }
}
