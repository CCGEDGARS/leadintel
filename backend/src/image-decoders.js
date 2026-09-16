const CODEC_LOADERS={
  'image/png':()=>import('./image-codecs/png.js'),
  'image/jpeg':()=>import('./image-codecs/jpeg.js'),
  'image/webp':()=>import('./image-codecs/webp.js')
};

function exactBuffer(bytes){
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}

export async function decodeImage(bytes,mimeType){
  const loadCodec=CODEC_LOADERS[mimeType];
  if(!loadCodec){
    throw new TypeError('Unsupported image MIME type');
  }
  const codec=await loadCodec();
  return codec.decodeImageBuffer(exactBuffer(bytes));
}
