(function(root){
 'use strict';
 async function extractWritingReference(input,mime,{loadPdf}={}){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);mime=String(mime||'').split(';')[0].trim().toLowerCase();
  if(!['application/pdf','text/plain','text/markdown'].includes(mime))throw Error('Unsupported document format');
  if(bytes.byteLength>20*1024*1024)throw Error('Maximum document size is 20 MiB');
  if(!bytes.byteLength)throw Error('Document is empty');
  let sections=[],total=0,readable=0,characters=0;
  const add=(text,location)=>{characters+=text.length;if(characters>2000000)throw Error('Maximum extracted text is 2 million characters');if(text.trim()){sections.push({location,text});readable++;}};
  if(mime==='application/pdf'){
   if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('Invalid PDF signature');
   const node=typeof module==='object'&&Boolean(module.exports);
   const lib=loadPdf?await loadPdf():await import(node?'pdfjs-dist/legacy/build/pdf.mjs':'./vendor/pdfjs/pdf.mjs');
   if(!node)lib.GlobalWorkerOptions.workerSrc='./vendor/pdfjs/pdf.worker.mjs';
   const task=lib.getDocument({data:bytes.slice(),isEvalSupported:false,useSystemFonts:true,disableFontFace:true});
   let doc;
   try{doc=await task.promise;total=doc.numPages;if(total>600)throw Error('Maximum PDF length is 600 pages');for(let n=1;n<=total;n++){const page=await doc.getPage(n);try{const content=await page.getTextContent();const text=content.items.map(item=>typeof item.str==='string'?item.str+(item.hasEOL?'\n':' '):'').join('').trim();add(text,'page:'+n);}finally{page.cleanup();}}}
   finally{await task.destroy();}
  }else{
   let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Document must contain valid UTF-8 text');}
   const lines=text.split(/\r?\n/);total=lines.filter(line=>line.trim()).length;for(let i=0;i<lines.length;i++)if(lines[i].trim())add(lines[i],'line:'+(i+1));
  }
  return {sections,coverage:{total,readable,unreadable:total-readable},characters};
 }
 const api={extractWritingReference};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelWritingReferenceExtractor=api;
})(typeof window==='object'?window:globalThis);
