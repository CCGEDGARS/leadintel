import decodeJpeg,{init as initJpeg} from '@jsquash/jpeg/decode.js';
import JPEG_DECODER from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';

let initialization;

export async function decodeImageBuffer(buffer){
  initialization??=initJpeg(JPEG_DECODER,{print:()=>{},printErr:()=>{}});
  await initialization;
  return decodeJpeg(buffer);
}
