const PROTECTED_KEY_NAMES=new Set([
  'api_key','apikey','encrypted_api_key','access_token','refresh_token','password','secret',
  'client_secret','cookie','authorization','private_key','database_url','connection_string'
]);
const MAX_SCREEN_LABEL=160;
const MAX_ENTITY_TYPE=80;
const MAX_ENTITY_ID=180;
const MAX_EXTERNAL_QUERY=1000;

function normalizedKey(value){return String(value??'').trim().toLowerCase().replace(/[\s.-]+/g,'_');}
function cleanText(value,max){return String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
function redactSecretLikeText(value,max=20000){
  return String(value??'').slice(0,max)
    .replace(/\b(?:authorization\s*:\s*)?bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,'[redacted]')
    .replace(/\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{12,}\b/gi,'[redacted]')
    .replace(/\b(api[_ -]?key|apikey|password|client[_ -]?secret|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*[^\s,;]+/gi,'$1=[redacted]');
}
function containsSecretLikeText(value){
  const text=String(value??'');
  return /\b(?:authorization\s*:\s*)?bearer\s+[A-Za-z0-9._~+/=-]{8,}/i.test(text)
    || /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{12,}\b/i.test(text)
    || /\b(?:api[_ -]?key|apikey|password|client[_ -]?secret|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*(?!\[redacted\])[^\s,;]+/i.test(text);
}

export function containsProtectedKeyName(key){
  const normalized=normalizedKey(key);
  if(PROTECTED_KEY_NAMES.has(normalized))return true;
  if(/(^|_)(?:api_?key|access_?token|refresh_?token|password|secret|cookie|authorization|private_?key|database_?url|connection_?string)($|_)/i.test(normalized))return true;
  return false;
}

export function redactProtectedData(value,depth=0){
  if(depth>12)return null;
  if(value===null||value===undefined)return value;
  if(Array.isArray(value))return value.slice(0,100).map(item=>redactProtectedData(item,depth+1));
  if(typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)){
      if(containsProtectedKeyName(key))continue;
      out[key]=redactProtectedData(item,depth+1);
    }
    return out;
  }
  if(typeof value==='string')return redactSecretLikeText(value);
  return value;
}

export function sanitizeClientScreenContext(input){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const step=Math.max(1,Math.min(7,Math.floor(Number(source.step)||1)));
  const label=cleanText(source.label,MAX_SCREEN_LABEL);
  const entityType=cleanText(source.entityType??source.entity_type,MAX_ENTITY_TYPE);
  const entityId=cleanText(source.entityId??source.entity_id,MAX_ENTITY_ID);
  const out={step,label};
  if(entityType)out.entityType=entityType;
  if(entityId)out.entityId=entityId;
  return out;
}

export function sanitizeExternalResearchQuery(value){
  let text=cleanText(value,4000);
  text=redactSecretLikeText(text,4000)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[redacted]')
    .replace(/\b(?=[A-Za-z0-9_-]{32,}\b)(?=[A-Za-z0-9_-]*[A-Za-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]+\b/g,'[redacted]')
    .replace(/(?:\[redacted\]\s*){2,}/gi,'[redacted] ')
    .replace(/\s+/g,' ')
    .trim();
  return text.slice(0,MAX_EXTERNAL_QUERY);
}

function findUnsafe(value,path='root',depth=0){
  if(depth>16)return `${path}: nesting too deep`;
  if(typeof value==='string'&&containsSecretLikeText(value))return `${path}: protected credential-like value`;
  if(!value||typeof value!=='object')return '';
  if(Array.isArray(value)){
    for(let index=0;index<value.length;index++){const found=findUnsafe(value[index],`${path}[${index}]`,depth+1);if(found)return found;}
    return '';
  }
  for(const [key,item] of Object.entries(value)){
    if(containsProtectedKeyName(key))return `${path}.${key}: protected key`;
    const found=findUnsafe(item,`${path}.${key}`,depth+1);if(found)return found;
  }
  return '';
}

export function assertModelSafe(value){
  const unsafe=findUnsafe(value);
  if(unsafe)throw new Error(`Copilot model context contains protected or unsafe data (${unsafe})`);
  return value;
}
