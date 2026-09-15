const encoder=new TextEncoder();
const MAX_TEXT_BYTES=100000;
const MAX_HTML_BYTES=200000;
const ASSET_ORIGIN='https://leadintel-api.edgars-7e7.workers.dev';
const ASSET_PATH='/api/customer/brand-assets/';
const ASSET_ID=/^[A-Za-z0-9_-]{43}$/;
const VOID_TAGS=new Set(['br','img']);
const ALLOWED_TAGS=new Set(['html','body','table','tbody','thead','tfoot','tr','td','div','span','p','br','strong','b','em','i','a','img']);
const ATTRIBUTES={
  html:new Set([]),body:new Set(['style']),
  table:new Set(['role','width','cellpadding','cellspacing','border','style']),
  tbody:new Set(['style']),thead:new Set(['style']),tfoot:new Set(['style']),tr:new Set(['style']),
  td:new Set(['align','width','style']),div:new Set(['style']),span:new Set(['style']),p:new Set(['style']),
  br:new Set([]),strong:new Set(['style']),b:new Set(['style']),em:new Set(['style']),i:new Set(['style']),
  a:new Set(['href','style']),img:new Set(['src','alt','style'])
};
const STYLE_PROPERTIES=new Set([
  'margin','margin-top','margin-right','margin-bottom','margin-left',
  'padding','padding-top','padding-right','padding-bottom','padding-left',
  'background','background-color','color','font-family','font-size','font-weight',
  'line-height','width','max-width','height','max-height','border','border-top',
  'border-right','border-bottom','border-left','border-radius','text-decoration','text-align','display'
]);

function byteLength(value){return encoder.encode(value).byteLength;}
function contentError(message){throw new Error(message);}
function normalizedText(value,label,maxBytes,{required=false}={}){
  const text=String(value??'').trim();
  if(required&&!text)contentError(label+' is required');
  if(byteLength(text)>maxBytes)contentError(label+' is too large');
  return text;
}
function decodeEntities(value){
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(match,entity)=>{
    const lower=entity.toLowerCase();
    if(lower==='amp')return '&';if(lower==='quot')return '"';if(lower==='apos')return "'";if(lower==='lt')return '<';if(lower==='gt')return '>';
    const number=lower.startsWith('#x')?Number.parseInt(lower.slice(2),16):Number.parseInt(lower.slice(1),10);
    return Number.isFinite(number)&&number>=0&&number<=0x10ffff?String.fromCodePoint(number):match;
  });
}
function validHref(value){
  const decoded=decodeEntities(value);
  if(/[\u0000-\u001f\u007f]/.test(decoded))return false;
  if(decoded.startsWith('tel:'))return /^tel:\+?[0-9]{7,20}$/.test(decoded);
  try{const url=new URL(decoded);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}
function validAssetUrl(value){
  const decoded=decodeEntities(value);
  try{
    const url=new URL(decoded);
    return url.origin===ASSET_ORIGIN&&url.pathname.startsWith(ASSET_PATH)&&ASSET_ID.test(url.pathname.slice(ASSET_PATH.length))&&!url.search&&!url.hash&&!url.username&&!url.password;
  }catch{return false;}
}
function validStyle(value){
  const decoded=decodeEntities(value);
  if(!decoded||/[{}@\\]|url\s*\(|expression\s*\(|javascript|data:|vbscript:|behavior\s*:|[\u0000-\u001f\u007f]/i.test(decoded))return false;
  for(const declaration of decoded.split(';')){
    if(!declaration.trim())continue;
    const colon=declaration.indexOf(':');
    if(colon<1)return false;
    const property=declaration.slice(0,colon).trim().toLowerCase();
    const styleValue=declaration.slice(colon+1).trim();
    if(!STYLE_PROPERTIES.has(property)||!styleValue||styleValue.includes(':')||!/^[A-Za-z0-9#.,%()\s-]+$/.test(styleValue))return false;
    if(property==='display'&&styleValue.toLowerCase()!=='block')return false;
  }
  return true;
}
function validateAttribute(tag,name,value){
  if(!ATTRIBUTES[tag].has(name))return false;
  if(name==='href')return validHref(value);
  if(name==='src')return validAssetUrl(value);
  if(name==='style')return validStyle(value);
  if(name==='role')return value==='presentation';
  if(name==='align')return /^(left|center|right)$/.test(value);
  if(['width','cellpadding','cellspacing','border'].includes(name))return /^(?:0|[1-9]\d{0,3}|100%)$/.test(value);
  if(name==='alt')return !/[<>\u0000-\u001f\u007f]/.test(decodeEntities(value))&&byteLength(value)<=500;
  return false;
}
function trackingPixelStyle(value){
  for(const declaration of decodeEntities(value).split(';')){
    const colon=declaration.indexOf(':');if(colon<1)continue;
    const property=declaration.slice(0,colon).trim().toLowerCase();
    if(!['width','height','max-width','max-height'].includes(property))continue;
    const match=/^(\d+(?:\.\d+)?)(px|%)?$/.exec(declaration.slice(colon+1).trim().toLowerCase());
    if(match&&Number(match[1])<=2)return true;
  }
  return false;
}
function parseStartTag(source){
  const match=/^([A-Za-z][A-Za-z0-9]*)([\s\S]*)$/.exec(source);
  if(!match)return null;
  const tag=match[1].toLowerCase();
  if(!ALLOWED_TAGS.has(tag))return null;
  let rest=match[2];let selfClosing=false;
  if(/\/\s*$/.test(rest)){selfClosing=true;rest=rest.replace(/\/\s*$/,'');}
  const seen=new Set();const values=new Map();
  while(rest.length){
    const attr=/^\s+([A-Za-z][A-Za-z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)')/.exec(rest);
    if(!attr)return null;
    const name=attr[1].toLowerCase();const value=attr[3]??attr[4]??'';
    if(seen.has(name)||!validateAttribute(tag,name,value))return null;
    seen.add(name);values.set(name,value);rest=rest.slice(attr[0].length);
  }
  if(selfClosing&&!VOID_TAGS.has(tag))return null;
  if(tag==='img'&&(!seen.has('src')||!seen.has('alt')||trackingPixelStyle(values.get('style')||'')))return null;
  return {tag,void:VOID_TAGS.has(tag)};
}
function validateHtml(html){
  if(/<!--[\s\S]*?-->|<\?|<!\[CDATA\[/i.test(html))contentError('Unsafe email HTML');
  const stack=[];let cursor=0;let doctypeSeen=false;
  while(cursor<html.length){
    const open=html.indexOf('<',cursor);if(open===-1)break;
    const close=html.indexOf('>',open+1);if(close===-1)contentError('Unsafe email HTML');
    const source=html.slice(open+1,close).trim();if(!source)contentError('Unsafe email HTML');
    if(/^!doctype\s+html$/i.test(source)){
      if(doctypeSeen||open!==0||stack.length)contentError('Unsafe email HTML');
      doctypeSeen=true;cursor=close+1;continue;
    }
    if(source.startsWith('!'))contentError('Unsafe email HTML');
    if(source.startsWith('/')){
      const end=/^\/\s*([A-Za-z][A-Za-z0-9]*)\s*$/.exec(source);const tag=end?.[1]?.toLowerCase();
      if(!tag||VOID_TAGS.has(tag)||stack.pop()!==tag)contentError('Unsafe email HTML');
    }else{
      const parsed=parseStartTag(source);if(!parsed)contentError('Unsafe email HTML');
      if(!parsed.void)stack.push(parsed.tag);
    }
    cursor=close+1;
  }
  if(stack.length)contentError('Unsafe email HTML');
  return html;
}

export function validateEmailContent({body,text_body,html_body}={}){
  const canonical=normalizedText(body,'Email body',MAX_TEXT_BYTES,{required:true});
  const text=text_body===undefined||text_body===null?canonical:normalizedText(text_body,'Email text body',MAX_TEXT_BYTES,{required:true});
  const html=html_body===undefined||html_body===null||html_body===''?'':normalizedText(html_body,'Email HTML body',MAX_HTML_BYTES,{required:true});
  if(html)validateHtml(html);
  return {body:canonical,textBody:text,htmlBody:html};
}

export const emailContentLimits=Object.freeze({textBytes:MAX_TEXT_BYTES,htmlBytes:MAX_HTML_BYTES});
