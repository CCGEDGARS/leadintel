import process from 'node:process';

function parsedJson(input,label){
  let value;
  try{
    value=JSON.parse(String(input));
  }catch{
    throw new Error(`${label} returned malformed JSON`);
  }
  return value;
}

function validBucketName(value){
  return typeof value==='string'&&value.length>0;
}

export function verifyBucketInfo(input,expectedName){
  const value=parsedJson(input,'R2 bucket info');
  if(!value||typeof value!=='object'||Array.isArray(value)||!validBucketName(value.name)){
    throw new Error('R2 bucket info returned an unexpected response');
  }
  if(value.name!==expectedName){
    throw new Error(`R2 bucket info identified ${value.name}, expected ${expectedName}`);
  }
  return 'found';
}

export function bucketListState(input,expectedName){
  const value=parsedJson(input,'R2 bucket list');
  const buckets=Array.isArray(value)?value:value&&typeof value==='object'&&!Array.isArray(value)?value.buckets:null;
  if(!Array.isArray(buckets)||buckets.some(bucket=>!bucket||typeof bucket!=='object'||Array.isArray(bucket)||!validBucketName(bucket.name))){
    throw new Error('R2 bucket list returned an unexpected response');
  }
  return buckets.some(bucket=>bucket.name===expectedName)?'found':'absent';
}

async function main(){
  const [mode,expectedName]=process.argv.slice(2);
  if(!['info','list'].includes(mode)||!validBucketName(expectedName)){
    throw new Error('Usage: verify-r2-bucket-json.mjs <info|list> <expected-bucket-name>');
  }
  let input='';
  process.stdin.setEncoding('utf8');
  for await(const chunk of process.stdin) input+=chunk;
  const result=mode==='info'?verifyBucketInfo(input,expectedName):bucketListState(input,expectedName);
  process.stdout.write(result);
}

if(process.argv[1]&&import.meta.url===new URL(process.argv[1],`file://${process.cwd()}/`).href){
  main().catch(error=>{
    process.stderr.write(`${error.message}\n`);
    process.exitCode=1;
  });
}
