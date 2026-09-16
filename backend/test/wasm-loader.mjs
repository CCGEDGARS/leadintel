import {appendFile,readFile} from 'node:fs/promises';
import {basename} from 'node:path';

export async function load(url,context,nextLoad){
  if(!url.endsWith('.wasm')){
    return nextLoad(url,context);
  }

  const bytes=await readFile(new URL(url));
  if(process.env.LEADINTEL_WASM_LOAD_LOG){
    await appendFile(process.env.LEADINTEL_WASM_LOAD_LOG,`${basename(new URL(url).pathname)}\n`);
  }
  const encoded=bytes.toString('base64');
  return {
    format:'module',
    shortCircuit:true,
    source:`const raw=atob('${encoded}');const bytes=Uint8Array.from(raw,value=>value.charCodeAt(0));export default new WebAssembly.Module(bytes);`
  };
}
