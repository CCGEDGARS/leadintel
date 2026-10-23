import {readableWritingCoverage} from './writing-reference-coverage.js';
import {getDocumentProxy} from 'unpdf';
export async function extractServer(bytes,mime){
 if(!bytes.byteLength)throw Error('Document is empty');if(bytes.byteLength>20*1024*1024)throw Error('Maximum document size is 20 MiB');
 const sections=[];let total=0,readable=0,characters=0;
 const add=(text,location)=>{characters+=text.length;if(characters>2000000)throw Error('Maximum extracted text is 2 million characters');if(text.trim()){sections.push({location,text});readable++;}};
 if(mime==='application/pdf'){
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('Invalid PDF signature');
  const pdf=await getDocumentProxy(bytes.slice(),{isEvalSupported:false,useSystemFonts:true,disableFontFace:true});
  try{total=pdf.numPages;if(total>600)throw Error('Maximum PDF length is 600 pages');for(let n=1;n<=total;n++){const page=await pdf.getPage(n);try{const content=await page.getTextContent();add(content.items.map(item=>typeof item.str==='string'?item.str+(item.hasEOL?'\n':' '):'').join('').trim(),'page:'+n);}finally{page.cleanup();}}}finally{await pdf.loadingTask.destroy();}
 }else{
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Document must contain valid UTF-8 text');}
  const lines=text.split(/\r?\n/);total=lines.filter(line=>line.trim()).length;for(let i=0;i<lines.length;i++)if(lines[i].trim())add(lines[i],'line:'+(i+1));
 }
 return {sections,coverage:{total,readable,unreadable:total-readable},characters};
}
export function mergeNativeExtraction(extracted,native){
 const byPage=new Map(extracted.sections.map(section=>[section.location,section]));
 for(const section of native.sections)if(!byPage.has(section.location)||byPage.get(section.location).text.length<120)byPage.set(section.location,section);
 const sections=[...byPage.values()].sort((a,b)=>Number(a.location.split(':')[1])-Number(b.location.split(':')[1]));
 const characters=sections.reduce((n,s)=>n+s.text.length,0);
 if(characters>2000000)throw Error('Maximum extracted text is 2 million characters');
 return {sections,characters,coverage:{total:extracted.coverage.total,readable:sections.length,unreadable:extracted.coverage.total-sections.length,extractionProvider:'gemini',requiresReview:true}};
}
export async function validateWritingReference({bytes,mime,filename,nativeExtractor,signal}){
 const normalized=String(mime||'').split(';')[0].trim().toLowerCase();
 const extensions={'application/pdf':/\.pdf$/i,'text/plain':/\.txt$/i,'text/markdown':/\.(md|markdown)$/i};
 if(!extensions[normalized]||!extensions[normalized].test(String(filename||''))||/[\x00-\x1f/\\]/.test(filename)||filename.length>180)throw Error('Invalid document filename or MIME type');
 signal?.throwIfAborted();
 let extracted=await extractServer(bytes,normalized);
 signal?.throwIfAborted();
 if(normalized==='application/pdf'&&nativeExtractor&&bytes.length<=8*1024*1024&&extracted.coverage.total<=60&&(!readableWritingCoverage(extracted.coverage)||extracted.characters<extracted.coverage.total*120)){
  try{const native=await nativeExtractor({bytes,pages:extracted.coverage.total,signal});
   extracted=mergeNativeExtraction(extracted,native);
  }catch(e){signal?.throwIfAborted();if(e?.name==='AbortError')throw e;extracted.coverage.nativeExtractionUnavailable=true;}
 }
 signal?.throwIfAborted();
 if(!extracted.characters)throw Error('Document has no readable text');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {sha256,mime:normalized,bytes,extracted};
}
