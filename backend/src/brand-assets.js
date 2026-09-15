import {cookieValue,randomToken,sha256} from './security.js';

const PUBLIC_ASSET_ORIGIN='https://leadintel-api.edgars-7e7.workers.dev';
const ASSET_PATH='/api/customer/brand-assets';
const IMAGE_TYPES=new Set(['image/png','image/jpeg','image/webp']);
const KIND_LIMITS={logo:2*1024*1024,headshot:5*1024*1024,banner:5*1024*1024};
const MAX_DIMENSION=6000;
const MAX_REDIRECTS=3;
const IMPORT_TIMEOUT_MS=5000;
const ASSET_ID=/^([a-f0-9]{16})_([A-Za-z0-9_-]{32})$/;

class BrandAssetError extends Error{
  constructor(message,status=400){super(message);this.name='BrandAssetError';this.status=status;}
}

const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers)=>json({error:message},status,headers);

function limitForKind(kind){const normalized=String(kind||'').trim().toLowerCase();const limit=KIND_LIMITS[normalized];if(!limit)throw new BrandAssetError('Brand asset kind must be logo, headshot, or banner');return {kind:normalized,limit};}
function normalizeMime(value){return String(value||'').split(';',1)[0].trim().toLowerCase();}
function fourCc(bytes,offset){return String.fromCharCode(...bytes.subarray(offset,offset+4));}

function pngInfo(bytes){
  if(bytes.length<45)return null;
  const signature=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  if(!signature.every((value,index)=>bytes[index]===value)||fourCc(bytes,12)!=='IHDR')return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(view.getUint32(8)!==13)return null;
  const info={mimeType:'image/png',width:view.getUint32(16),height:view.getUint32(20)};let offset=8;
  while(offset+12<=bytes.length){const length=view.getUint32(offset);const end=offset+12+length;if(end>bytes.length)return null;const chunk=fourCc(bytes,offset+4);if(chunk==='IEND')return length===0&&end===bytes.length?info:null;offset=end;}
  return null;
}

function jpegInfo(bytes){
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)return null;
  let offset=2,info=null;
  while(offset+3<bytes.length){
    if(bytes[offset]!==0xff){offset++;continue;}
    while(offset<bytes.length&&bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd9))continue;
    if(offset+1>=bytes.length)return null;
    const length=(bytes[offset]<<8)|bytes[offset+1];if(length<2||offset+length>bytes.length)return null;
    if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)){
      if(length<7)return null;info={mimeType:'image/jpeg',height:(bytes[offset+3]<<8)|bytes[offset+4],width:(bytes[offset+5]<<8)|bytes[offset+6]};
    }
    offset+=length;
  }
  return info;
}

function webpInfo(bytes){
  if(bytes.length<30||fourCc(bytes,0)!=='RIFF'||fourCc(bytes,8)!=='WEBP')return null;
  if(new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true)!==bytes.length-8)return null;
  const chunk=fourCc(bytes,12);
  if(chunk==='VP8X')return {mimeType:'image/webp',width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
  if(chunk==='VP8 '&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a)return {mimeType:'image/webp',width:(bytes[26]|(bytes[27]<<8))&0x3fff,height:(bytes[28]|(bytes[29]<<8))&0x3fff};
  if(chunk==='VP8L'&&bytes[20]===0x2f)return {mimeType:'image/webp',width:1+bytes[21]+((bytes[22]&0x3f)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&0x0f)<<10)};
  return null;
}

function imageInfo(bytes){return pngInfo(bytes)||jpegInfo(bytes)||webpInfo(bytes);}

export async function validateBrandAsset(file,kind){
  const {limit}=limitForKind(kind);const mimeType=normalizeMime(file?.type);
  if(!IMAGE_TYPES.has(mimeType))throw new BrandAssetError('Brand assets must be PNG, JPEG, or WebP images');
  const size=Number(file?.size);if(!Number.isSafeInteger(size)||size<1)throw new BrandAssetError('Brand asset is empty or has an invalid size');
  if(size>limit)throw new BrandAssetError(`Brand asset exceeds the ${limit===KIND_LIMITS.logo?'2 MB':'5 MB'} limit`,413);
  if(typeof file.arrayBuffer!=='function')throw new BrandAssetError('Brand asset file is invalid');
  const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.byteLength!==size)throw new BrandAssetError('Brand asset size changed while reading');
  const info=imageInfo(bytes);if(!info||info.mimeType!==mimeType)throw new BrandAssetError('Brand asset MIME type does not match its magic bytes');
  if(!info.width||!info.height||info.width>MAX_DIMENSION||info.height>MAX_DIMENSION)throw new BrandAssetError('Brand asset dimensions must be between 1 and 6000 pixels');
  return {...info,size,bytes};
}

async function workspaceScope(workspaceId){return (await sha256(String(workspaceId))).slice(0,16);}
function parsedAssetId(assetId){const match=String(assetId||'').match(ASSET_ID);return match?{id:match[0],scope:match[1]}:null;}
export function brandAssetObjectKey(assetId){const parsed=parsedAssetId(assetId);if(!parsed)throw new BrandAssetError('Brand asset not found',404);return `workspaces/${parsed.scope}/brand-assets/${parsed.id}`;}
async function workspaceOwnsAsset(workspaceId,assetId){const parsed=parsedAssetId(assetId);return Boolean(parsed)&&parsed.scope===await workspaceScope(workspaceId);}

async function sessionUser(request,env){
  const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);
  return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();
}
async function membership(env,workspaceId,userId){return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();}
async function requireWorkspaceWriter(request,env,workspaceId){
  const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};
  const member=await membership(env,workspaceId,user.id);if(!member)return {error:'Workspace access denied',status:403};
  if(!['owner','researcher'].includes(member.role))return {error:'Workspace role is not permitted',status:403};
  return {user,member};
}
async function audit(env,{workspaceId,userId,type,assetId,metadata={}}){
  await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),workspaceId,userId,type,'brand_asset',assetId,JSON.stringify(metadata)).run();
}
function requireBinding(env){if(!env.BRAND_ASSETS)throw new BrandAssetError('Brand asset storage is not configured',503);return env.BRAND_ASSETS;}

async function createAsset(env,{workspaceId,validated,kind,altText,eventType,userId}){
  const scope=await workspaceScope(workspaceId);const id=`${scope}_${randomToken(24)}`;const key=brandAssetObjectKey(id);const bucket=requireBinding(env);
  await bucket.put(key,validated.bytes,{httpMetadata:{contentType:validated.mimeType}});
  const asset={id,url:`${PUBLIC_ASSET_ORIGIN}${ASSET_PATH}/${id}`,mimeType:validated.mimeType,width:validated.width,height:validated.height,altText:String(altText||'').trim().slice(0,300),updatedAt:new Date().toISOString()};
  try{await audit(env,{workspaceId,userId,type:eventType,assetId:id,metadata:{kind,size:validated.size,mime_type:validated.mimeType,width:validated.width,height:validated.height}});}catch(cause){await bucket.delete(key).catch(()=>{});throw cause;}
  return asset;
}

export async function deleteBrandAsset(env,{workspaceId,assetId}){
  if(!await workspaceOwnsAsset(workspaceId,assetId))throw new BrandAssetError('Workspace access denied',403);
  await requireBinding(env).delete(brandAssetObjectKey(assetId));
}

export async function replaceBrandAsset(env,{workspaceId,previousAssetId,nextAsset,saveMetadata}){
  if(typeof saveMetadata!=='function')throw new TypeError('saveMetadata must be a function');
  if(!nextAsset?.id||!await workspaceOwnsAsset(workspaceId,nextAsset.id))throw new BrandAssetError('Replacement asset does not belong to workspace',403);
  try{await saveMetadata(nextAsset);}catch(cause){await deleteBrandAsset(env,{workspaceId,assetId:nextAsset.id}).catch(()=>{});throw cause;}
  if(previousAssetId&&previousAssetId!==nextAsset.id)await deleteBrandAsset(env,{workspaceId,assetId:previousAssetId});
  return nextAsset;
}

function isPrivateIpv4(host){
  if(!/^\d+\.\d+\.\d+\.\d+$/.test(host))return false;const parts=host.split('.').map(Number);if(parts.some(value=>value<0||value>255))return true;const [a,b]=parts;
  return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===198&&(b===18||b===19))||a>=224;
}
function isPrivateIpv6(host){
  const value=host.replace(/^\[|\]$/g,'').toLowerCase();if(!value.includes(':'))return false;
  if(value==='::'||value==='::1'||value.startsWith('fc')||value.startsWith('fd')||/^fe[89ab]/.test(value)||value.startsWith('2001:db8:'))return true;
  const mapped=value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);return mapped?isPrivateIpv4(mapped[1]):false;
}
function publicHttpUrl(raw){
  let url;try{url=new URL(String(raw||''));}catch{throw new BrandAssetError('Import URL must be a public HTTP(S) image candidate');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new BrandAssetError('Import URL must be a public HTTP(S) image candidate');
  const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(!host||!host.includes('.')||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||isPrivateIpv4(host)||isPrivateIpv6(host))throw new BrandAssetError('Import URL must use a public host');
  return url;
}
function redirectStatus(status){return [301,302,303,307,308].includes(status);}
async function readBoundedBody(response,limit){
  const declared=response.headers.get('Content-Length');if(declared!==null){const length=Number(declared);if(!Number.isSafeInteger(length)||length<0)throw new BrandAssetError('Imported image has an invalid content length');if(length>limit)throw new BrandAssetError('Imported image exceeds the allowed size',413);}
  if(!response.body)throw new BrandAssetError('Imported image response is empty');const reader=response.body.getReader();const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw new BrandAssetError('Imported image exceeds the allowed size',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
async function fetchImportedFile(rawUrl,kind){
  const {limit}=limitForKind(kind);let url=publicHttpUrl(rawUrl);
  for(let redirects=0;;redirects++){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),IMPORT_TIMEOUT_MS);
    try{
      const response=await fetch(url,{redirect:'manual',signal:controller.signal,headers:{Accept:'image/png,image/jpeg,image/webp'}});
      if(redirectStatus(response.status)){
        if(redirects>=MAX_REDIRECTS)throw new BrandAssetError('Image import exceeded the redirect limit');const location=response.headers.get('Location');if(!location)throw new BrandAssetError('Image import redirect is missing a location');url=publicHttpUrl(new URL(location,url));continue;
      }
      if(!response.ok)throw new BrandAssetError(`Image import failed with status ${response.status}`,502);
      const type=normalizeMime(response.headers.get('Content-Type'));if(!IMAGE_TYPES.has(type))throw new BrandAssetError('Imported asset must be a PNG, JPEG, or WebP image');
      const bytes=await readBoundedBody(response,limit);return {type,size:bytes.byteLength,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    }catch(cause){
      if(cause instanceof BrandAssetError)throw cause;
      if(cause?.name==='AbortError'||controller.signal.aborted)throw new BrandAssetError('Image import timed out',504);
      throw new BrandAssetError('Image import failed',502);
    }finally{clearTimeout(timer);}
  }
}

async function storedObjectBytes(object){if(typeof object.arrayBuffer==='function')return new Uint8Array(await object.arrayBuffer());return new Uint8Array(await new Response(object.body).arrayBuffer());}
async function serveAsset(assetId,env,cors){
  const parsed=parsedAssetId(assetId);if(!parsed)return error('Brand asset not found',404,cors);const object=await requireBinding(env).get(brandAssetObjectKey(parsed.id));if(!object)return error('Brand asset not found',404,cors);
  const bytes=await storedObjectBytes(object);const info=imageInfo(bytes);const storedType=normalizeMime(object.httpMetadata?.contentType);if(!info||!IMAGE_TYPES.has(info.mimeType)||(storedType&&storedType!==info.mimeType)||!info.width||!info.height||info.width>MAX_DIMENSION||info.height>MAX_DIMENSION)return error('Brand asset not found',404,cors);
  return new Response(bytes,{status:200,headers:{...cors,'Content-Type':info.mimeType,'Content-Length':String(bytes.byteLength),'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}});
}

export async function handleBrandAssetRoute(request,env,cors={}){
  const url=new URL(request.url);const path=url.pathname;
  if(path!==ASSET_PATH&&path!==`${ASSET_PATH}/import`&&!path.startsWith(`${ASSET_PATH}/`))return null;
  try{
    if(path===`${ASSET_PATH}/import`){
      if(request.method!=='POST')return error('Method not allowed',405,cors);const workspaceId=url.searchParams.get('workspace_id')||'';const access=await requireWorkspaceWriter(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
      const body=await request.json().catch(()=>null);if(!body)return error('Valid JSON body is required',400,cors);const imported=await fetchImportedFile(body.url,body.kind);const validated=await validateBrandAsset(imported,body.kind);const asset=await createAsset(env,{workspaceId,validated,kind:String(body.kind).toLowerCase(),altText:body.alt_text,eventType:'brand_asset.imported',userId:access.user.id});return json({asset},201,cors);
    }
    if(path===ASSET_PATH){
      if(request.method!=='POST')return error('Method not allowed',405,cors);const workspaceId=url.searchParams.get('workspace_id')||'';const access=await requireWorkspaceWriter(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
      const form=await request.formData().catch(()=>null);if(!form)return error('Valid multipart form data is required',400,cors);const kind=String(form.get('kind')||'').toLowerCase();const uploaded=form.get('file');const validated=await validateBrandAsset(uploaded,kind);const asset=await createAsset(env,{workspaceId,validated,kind,altText:form.get('alt_text'),eventType:'brand_asset.uploaded',userId:access.user.id});return json({asset},201,cors);
    }
    let assetId;try{assetId=decodeURIComponent(path.slice(ASSET_PATH.length+1));}catch{return error('Brand asset not found',404,cors);}
    if(request.method==='GET')return serveAsset(assetId,env,cors);
    if(request.method==='DELETE'){
      const workspaceId=url.searchParams.get('workspace_id')||'';const access=await requireWorkspaceWriter(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);if(!await workspaceOwnsAsset(workspaceId,assetId))return error('Workspace access denied',403,cors);
      await deleteBrandAsset(env,{workspaceId,assetId});await audit(env,{workspaceId,userId:access.user.id,type:'brand_asset.deleted',assetId});return json({ok:true,asset_id:assetId},200,cors);
    }
    return error('Method not allowed',405,cors);
  }catch(cause){if(cause instanceof BrandAssetError)return error(cause.message,cause.status,cors);throw cause;}
}
