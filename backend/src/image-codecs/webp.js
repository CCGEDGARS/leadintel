import decodeWebp,{init as initWebp} from '@jsquash/webp/decode.js';
import WEBP_DECODER from '@jsquash/webp/codec/dec/webp_dec.wasm';

let initialization;

export async function decodeImageBuffer(buffer){
  initialization??=initWebp(WEBP_DECODER,{print:()=>{},printErr:()=>{}});
  await initialization;
  return decodeWebp(buffer);
}
