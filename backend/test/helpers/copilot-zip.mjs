import {deflateRawSync} from 'node:zlib';
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function zip(entries,{stream=false,compression=0}={}){
  const locals=[],centrals=[];let offset=0;
  for(const [name,value] of entries){
    const filename=Buffer.from(name),body=Buffer.from(value),packed=compression===8?deflateRawSync(body):body,crc=crc32(body);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(stream?8:0,6);local.writeUInt16LE(compression,8);local.writeUInt16LE(filename.length,26);
    if(!stream){local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(body.length,22);}
    const descriptor=Buffer.alloc(stream?16:0);if(stream){descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,4);descriptor.writeUInt32LE(packed.length,8);descriptor.writeUInt32LE(body.length,12);}
    locals.push(local,filename,packed,descriptor);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(stream?8:0,8);central.writeUInt16LE(compression,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);centrals.push(central,filename);
    offset+=local.length+filename.length+packed.length+descriptor.length;
  }
  const directory=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
export const docxEntries=(text='Safe')=>[['[Content_Types].xml','<Types/>'],['_rels/.rels','<Relationships/>'],['word/document.xml',`<document><text>${text}</text></document>`]];
export function centralOffsets(bytes){const out=[];for(let i=0;i+46<=bytes.length;i++)if(bytes.readUInt32LE(i)===0x02014b50)out.push(i);return out;}
