const CONTROL=/[\u0000-\u001f\u007f]/;
const extensionOf=name=>String(name||'').trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]||'';
const starts=(bytes,prefix)=>bytes.length>=prefix.length&&prefix.every((value,index)=>bytes[index]===value);
const isZip=bytes=>starts(bytes,[0x50,0x4b,0x03,0x04]);
const isCsv=bytes=>!bytes.length||starts(bytes,[0xef,0xbb,0xbf])||starts(bytes,[0xff,0xfe])||starts(bytes,[0xfe,0xff])||!starts(bytes,[0x50,0x4b])&&!starts(bytes,[0xd0,0xcf,0x11,0xe0])&&!starts(bytes,[0x25,0x50,0x44,0x46]);
export const COPILOT_FILE_LIMITS=Object.freeze({maxBytes:15*1024*1024,maxExtractionChars:250000,maxCells:50000,maxCsvRows:20000});
const FORMATS=Object.freeze({
  pdf:{mimes:['application/pdf'],signature:bytes=>starts(bytes,[0x25,0x50,0x44,0x46]),archive:false},
  docx:{mimes:['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],signature:isZip,archive:true},
  xlsx:{mimes:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],signature:isZip,archive:true},
  xls:{mimes:['application/vnd.ms-excel','application/vnd.ms-office'],signature:bytes=>starts(bytes,[0xd0,0xcf,0x11,0xe0]),archive:false},
  csv:{mimes:['text/csv','application/csv','text/plain'],signature:isCsv,archive:false},
  pptx:{mimes:['application/vnd.openxmlformats-officedocument.presentationml.presentation'],signature:isZip,archive:true}
});
const decodeName=bytes=>new TextDecoder('utf-8',{fatal:false}).decode(bytes);
function bytesFor(value){
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  return new Uint8Array();
}
function contentType(headers){return String(headers?.get?.('content-type')||headers?.['content-type']||'').split(';',1)[0].trim().toLowerCase();}
function response(status,error){return {ok:false,status,error};}
function archiveProblem(bytes){
  let offset=0,entries=0;
  while(offset+30<=bytes.length&&starts(bytes.slice(offset),[0x50,0x4b,0x03,0x04])){
    const nameLength=bytes[offset+26]|bytes[offset+27]<<8,extraLength=bytes[offset+28]|bytes[offset+29]<<8;
    if(!nameLength||offset+30+nameLength>bytes.length)return 'archive is malformed';
    const name=decodeName(bytes.slice(offset+30,offset+30+nameLength)).replace(/\\/g,'/').toLowerCase();
    if(name.startsWith('/')||name.split('/').includes('..'))return 'archive contains an unsafe path';
    if(/(^|\/)(?:[^/]+\.)?(?:exe|dll|com|scr|msi|js|vbs|ps1|bat|cmd)$/.test(name)||/(?:^|\/)(?:vbaProject|activeX|macrosheets)(?:\.|\/|$)/i.test(name)||name.includes('/embeddings/'))return 'archive contains active content';
    const compressedSize=bytes[offset+18]|bytes[offset+19]<<8|bytes[offset+20]<<16|bytes[offset+21]<<24;
    offset+=30+nameLength+extraLength+(compressedSize>>>0);entries+=1;
  }
  if(!entries)return 'archive is malformed';
  for(let index=0;index+1<bytes.length;index+=1)if(bytes[index]===0x4d&&bytes[index+1]===0x5a)return 'archive contains executable content';
  return null;
}
async function hexDigest(bytes){
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),value=>value.toString(16).padStart(2,'0')).join('');
}

export async function validateUploadedFile({headers,bytes,name}={}){
  const originalName=String(name||'').trim();const extension=extensionOf(originalName);const format=FORMATS[extension];const value=bytesFor(bytes);
  if(!format)return response(415,'Unsupported file format');
  if(!originalName||originalName.length>1024||CONTROL.test(originalName))return response(422,'Invalid file name');
  if(value.byteLength>COPILOT_FILE_LIMITS.maxBytes)return response(413,'File is too large');
  const mimeType=contentType(headers);if(!format.mimes.includes(mimeType))return response(422,'File MIME type does not match its extension');
  if(!format.signature(value))return response(422,'File signature does not match its extension');
  if(format.archive){const unsafe=archiveProblem(value);if(unsafe)return response(422,unsafe);}
  const encoding=extension==='csv'?(starts(value,[0xff,0xfe])?'utf-16le':starts(value,[0xfe,0xff])?'utf-16be':'utf-8'):undefined;
  return {ok:true,status:200,format:extension,extension,mimeType,originalName,byteSize:value.byteLength,sha256:await hexDigest(value),encoding};
}
