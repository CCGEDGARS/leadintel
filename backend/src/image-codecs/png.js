import decodePng,{init as initPng} from '@jsquash/png/decode.js';
import PNG_DECODER from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';

let initialization;

export async function decodeImageBuffer(buffer){
  initialization??=initPng(PNG_DECODER);
  await initialization;
  return decodePng(buffer);
}
