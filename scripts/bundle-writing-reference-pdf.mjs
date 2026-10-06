import {mkdir,copyFile} from 'node:fs/promises';
const target=new URL('../.vercel-static/customer/vendor/pdfjs/',import.meta.url);
await mkdir(target,{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await copyFile(new URL('../node_modules/pdfjs-dist/legacy/build/'+name,import.meta.url),new URL(name,target));
await copyFile(new URL('../node_modules/pdfjs-dist/LICENSE',import.meta.url),new URL('LICENSE',target));
