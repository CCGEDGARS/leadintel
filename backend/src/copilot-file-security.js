const CONTROL=/[\u0000-\u001f\u007f]/;
const extensionOf=name=>String(name||'').trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]||'';
const starts=(bytes,prefix)=>bytes.length>=prefix.length&&prefix.every((value,index)=>bytes[index]===value);
const isZip=bytes=>starts(bytes,[0x50,0x4b,0x03,0x04]);
function csvEncoding(bytes){
  if(starts(bytes,[0xff,0xfe]))return 'utf-16le';
  if(starts(bytes,[0xfe,0xff]))return 'utf-16be';
  try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);return 'utf-8';}
  catch{return 'windows-1252';}
}
function isCsv(bytes){
  try{
    const text=new TextDecoder(csvEncoding(bytes),{fatal:true}).decode(bytes);
    if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text))return false;
    if(starts(bytes,[0x50,0x4b])||starts(bytes,[0xd0,0xcf,0x11,0xe0])||starts(bytes,[0x25,0x50,0x44,0x46]))return false;
    // Accept comma, tab, semicolon or pipe delimiters, including quoted multiline fields.
    let quoted=false,closed=false,start=true;
    for(let i=0;i<text.length;i++){
      const char=text[i];
      if(quoted){if(char==='"'){if(text[i+1]==='"')i++;else {quoted=false;closed=true;}}continue;}
      if(/[,;|\t\r\n]/.test(char)){start=true;closed=false;continue;}
      if(char==='"'){if(!start)return false;quoted=true;start=false;continue;}
      if(closed)return false;start=false;
    }
    return !quoted;
  }catch{return false;}
}
export const COPILOT_FILE_LIMITS=Object.freeze({maxBytes:15*1024*1024,maxExtractionChars:250000,maxCells:50000,maxCsvRows:20000});
const FORMATS=Object.freeze({
  pdf:{mimes:['application/pdf'],signature:bytes=>starts(bytes,[0x25,0x50,0x44,0x46]),archive:false},
  docx:{mimes:['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],signature:isZip,archive:true},
  xlsx:{mimes:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],signature:isZip,archive:true},
  xls:{mimes:['application/vnd.ms-excel','application/vnd.ms-office'],signature:bytes=>starts(bytes,[0xd0,0xcf,0x11,0xe0]),archive:false},
  csv:{mimes:['text/csv','application/csv','text/plain'],signature:isCsv,archive:false},
  pptx:{mimes:['application/vnd.openxmlformats-officedocument.presentationml.presentation'],signature:isZip,archive:true}
});
const decodeName=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
function bytesFor(value){
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  return new Uint8Array();
}
function contentType(headers){return String(headers?.get?.('content-type')||headers?.['content-type']||'').split(';',1)[0].trim().toLowerCase();}
function response(status,error){return {ok:false,status,error};}
const ARCHIVE_LIMITS=Object.freeze({entries:3000,entryBytes:16*1024*1024,totalBytes:64*1024*1024,ratio:200});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
async function unpack(bytes,size,method){
  if(method===0){if(bytes.length!==size)throw new Error();return bytes;}
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>size||length>ARCHIVE_LIMITS.entryBytes)throw new Error();chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  if(length!==size)throw new Error();const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
function xmlAttribute(value){
  return value.replace(/&([^;]+);/g,(_,entity)=>{
    if(entity[0]==='#'){const hex=entity[1]?.toLowerCase()==='x',digits=entity.slice(hex?2:1);if(!(hex?/^[0-9a-f]+$/i:/^[0-9]+$/).test(digits))throw new Error();const point=Number.parseInt(digits,hex?16:10);if(!point||point>0x10ffff||point>=0xd800&&point<=0xdfff)throw new Error();return String.fromCodePoint(point);}
    const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};if(!Object.hasOwn(named,entity))throw new Error();return named[entity];
  });
}
function activeXml(text,names){
  // Only declarations and relationship attributes are executable metadata. A writer
  // may advertise unused default types; ordinary source prose is not a type.
  const tags=text.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<(?:[\w.-]+:)?(Override|Default|Relationship)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/g);
  for(const [,tag,source] of tags){
    const attrs={};let remainder=source.replace(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/gs,(_,key,quote,value)=>{key=key.split(':').at(-1);if(Object.hasOwn(attrs,key))throw new Error();attrs[key]=xmlAttribute(value);return '';});if(!/^\s*\/?\s*$/.test(remainder))throw new Error();
    if(tag==='Relationship'){
      if(/oleObject|vbaProject|activeX|attachedTemplate/i.test(attrs.Type||'')||/\.(exe|dll|com|bat|cmd|ps1|vbs|js|scr|hta)(?:[?#]|$)/i.test(attrs.Target||''))return true;
    }else if(/macroEnabled|vbaProject|activeX|macrosheet/i.test(attrs.ContentType||'')){
      if(tag==='Override'||[...names].some(name=>name.endsWith(`.${String(attrs.Extension||'').toLowerCase()}`)))return true;
    }
  }
  return false;
}
async function archiveProblem(bytes,format){
  try{
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=offset=>view.getUint16(offset,true),u32=offset=>view.getUint32(offset,true);
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(i)===0x06054b50&&i+22+u16(i+20)===bytes.length){end=i;break;}
    if(end<0||u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10))throw new Error();
    const count=u16(end+10),directorySize=u32(end+12),directory=u32(end+16);
    if(!count||count>ARCHIVE_LIMITS.entries||directory+directorySize!==end)throw new Error();
    const entries=[],names=new Set();let offset=directory,total=0;
    for(let i=0;i<count;i++){
      if(offset+46>end||u32(offset)!==0x02014b50)throw new Error();
      const flags=u16(offset+8),method=u16(offset+10),crc=u32(offset+16),packed=u32(offset+20),size=u32(offset+24),nameLength=u16(offset+28),extra=u16(offset+30),comment=u16(offset+32),local=u32(offset+42);
      if(!nameLength||nameLength>1024||offset+46+nameLength+extra+comment>end||u16(offset+34)||flags&~0x080e||flags&1||![0,8].includes(method))throw new Error();
      const raw=decodeName(bytes.subarray(offset+46,offset+46+nameLength)),name=raw.replace(/\\/g,'/').toLowerCase();
      if(CONTROL.test(name)||name.startsWith('/')||name.includes(':')||name.split('/').some(part=>part==='..'||part==='.')||names.has(name))return 'archive contains an unsafe path';
      names.add(name);
      if(/\.(?:exe|dll|com|scr|msi|js|vbs|ps1|bat|cmd|hta|jar)$/i.test(name)||/(?:^|\/)(?:vbaproject|activex|macrosheets)(?:\.|\/|$)/i.test(name)||name.includes('/embeddings/'))return 'archive contains active content';
      total+=size;if(size>ARCHIVE_LIMITS.entryBytes||total>ARCHIVE_LIMITS.totalBytes||size>Math.max(packed,1)*ARCHIVE_LIMITS.ratio) return 'archive exceeds expansion limits';
      if(local+30>directory||u32(local)!==0x04034b50||u16(local+6)!==flags||u16(local+8)!==method||u16(local+26)!==nameLength)throw new Error();
      const data=local+30+nameLength+u16(local+28);
      if(data+packed>directory||decodeName(bytes.subarray(local+30,local+30+nameLength))!==raw)throw new Error();
      let last=data+packed;
      if(flags&8){
        if(u32(last)===0x08074b50)last+=4;
        if(last+12>directory||u32(last)!==crc||u32(last+4)!==packed||u32(last+8)!==size)throw new Error();last+=12;
        if((u32(local+14)&&u32(local+14)!==crc)||(u32(local+18)&&u32(local+18)!==packed)||(u32(local+22)&&u32(local+22)!==size))throw new Error();
      }else if(u32(local+14)!==crc||u32(local+18)!==packed||u32(local+22)!==size)throw new Error();
      entries.push({name,local,last,data,packed,size,method,crc});offset+=46+nameLength+extra+comment;
    }
    if(offset!==end)throw new Error();
    let next=0;for(const entry of entries.toSorted((a,b)=>a.local-b.local)){if(entry.local!==next)throw new Error();next=entry.last;}if(next!==directory)throw new Error();
    const required={docx:'word/document.xml',xlsx:'xl/workbook.xml',pptx:'ppt/presentation.xml'};
    if(!names.has('[content_types].xml')||!names.has('_rels/.rels')||!names.has(required[format]))return 'archive is missing required OOXML parts';
    for(const entry of entries){
      const payload=await unpack(bytes.subarray(entry.data,entry.data+entry.packed),entry.size,entry.method);
      if(crc32(payload)!==entry.crc)throw new Error();
      // Check the actual entry type, never byte matches inside compressed data or business prose.
      if(starts(payload,[0x4d,0x5a])||starts(payload,[0x7f,0x45,0x4c,0x46])||starts(payload,[0xd0,0xcf,0x11,0xe0]))return 'archive contains executable or embedded content';
      if(entry.name.endsWith('.xml')||entry.name.endsWith('.rels')){
        const text=new TextDecoder(starts(payload,[255,254])?'utf-16le':starts(payload,[254,255])?'utf-16be':'utf-8',{fatal:true}).decode(payload);
        if(!text.trimStart().startsWith('<')||/<!DOCTYPE|<!ENTITY/i.test(text)||activeXml(text,names))return 'archive contains unsafe XML content';
      }
    }
    return null;
  }catch{return 'archive is malformed or exceeds supported limits';}
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
  if(format.archive){const unsafe=await archiveProblem(value,extension);if(unsafe)return response(422,unsafe);}
  const encoding=extension==='csv'?csvEncoding(value):undefined;
  return {ok:true,status:200,format:extension,extension,mimeType,originalName,byteSize:value.byteLength,sha256:await hexDigest(value),encoding};
}
