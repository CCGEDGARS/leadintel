import decodeJpeg,{init as initJpeg} from '@jsquash/jpeg/decode.js';
import decodePng,{init as initPng} from '@jsquash/png/decode.js';
import decodeWebp,{init as initWebp} from '@jsquash/webp/decode.js';
import JPEG_DECODER from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import PNG_DECODER from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import WEBP_DECODER from '@jsquash/webp/codec/dec/webp_dec.wasm';

let initialized=false;

function initialize(){
  if(initialized){
    return;
  }
  initJpeg(JPEG_DECODER,{print:()=>{},printErr:()=>{}});
  initPng(PNG_DECODER);
  initWebp(WEBP_DECODER,{print:()=>{},printErr:()=>{}});
  initialized=true;
}

function exactBuffer(bytes){
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}

export async function decodeImage(bytes,mimeType){
  initialize();
  const buffer=exactBuffer(bytes);
  if(mimeType==='image/png'){
    return decodePng(buffer);
  }
  if(mimeType==='image/jpeg'){
    return decodeJpeg(buffer);
  }
  if(mimeType==='image/webp'){
    return decodeWebp(buffer);
  }
  throw new TypeError('Unsupported image MIME type');
}
