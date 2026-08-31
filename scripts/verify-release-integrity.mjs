import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyRelease,VERDICTS} from './release-integrity-core.mjs';

const DEFAULTS=Object.freeze({
  environment:'production',
  configPath:'release-integrity.config.json',
  proofPath:'release-proof.json'
});

export function parseArgs(argv=[]){
  const args={...DEFAULTS,expectedSha:'',ciConclusion:'',ciRunId:''};
  const names={
    '--expected-sha':'expectedSha',
    '--ci-conclusion':'ciConclusion',
    '--ci-run-id':'ciRunId',
    '--environment':'environment',
    '--config':'configPath',
    '--proof':'proofPath'
  };
  for(let index=0;index<argv.length;index++){
    const flag=argv[index];
    const key=names[flag];
    if(!key)throw new Error(`Unknown argument: ${flag}`);
    const value=argv[++index];
    if(value===undefined||String(value).trim()==='')throw new Error(`Missing value for ${flag}`);
    args[key]=String(value).trim();
  }
  if(!args.expectedSha)throw new Error('Missing required --expected-sha');
  if(!args.ciConclusion)throw new Error('Missing required --ci-conclusion');
  if(!['production','preview'].includes(args.environment))throw new Error('--environment must be production or preview');
  return args;
}

export function exitCodeForVerdict(verdict){return verdict===VERDICTS.PROVEN?0:1;}

export async function writeProof(target,proof){
  const resolved=path.resolve(target);
  await fs.mkdir(path.dirname(resolved),{recursive:true});
  await fs.writeFile(resolved,`${JSON.stringify(proof,null,2)}\n`,'utf8');
  return resolved;
}

async function readConfig(configPath){
  const raw=await fs.readFile(path.resolve(configPath),'utf8');
  return JSON.parse(raw);
}

export async function main(argv=process.argv.slice(2),options={}){
  const args=parseArgs(argv);
  const config=options.config||await readConfig(args.configPath);
  const proof=await verifyRelease({
    config,
    expectedSha:args.expectedSha,
    ciConclusion:args.ciConclusion,
    ciRunId:args.ciRunId,
    environment:args.environment,
    fetchImpl:options.fetchImpl||globalThis.fetch,
    now:options.now,
    nonce:options.nonce
  });
  const proofPath=await writeProof(args.proofPath,proof);
  console.log(`[release-integrity] ${proof.verdict} application=${proof.application||'unknown'} sha=${args.expectedSha} proof=${proofPath}`);
  if(proof.failures?.length)for(const failure of proof.failures)console.error(`[release-integrity] ${failure}`);
  return exitCodeForVerdict(proof.verdict);
}

function incompleteProof(error){
  return {
    schemaVersion:1,
    application:'',
    environment:'production',
    verifiedAt:new Date().toISOString(),
    expected:{sha:'',ref:''},
    ci:{runId:'',conclusion:'',passed:false},
    manifest:{url:'',status:null,commit:'',ref:'',service:'',passed:false},
    backend:{url:'',status:null,passed:false},
    smokeChecks:[],
    deployment:{required:false,passed:null},
    verdict:VERDICTS.INCOMPLETE_VERIFICATION,
    failures:[error?.message||String(error)]
  };
}

const direct=Boolean(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href);
if(direct){
  main().then(code=>{process.exitCode=code;}).catch(async error=>{
    const proof=incompleteProof(error);
    try{await writeProof(DEFAULTS.proofPath,proof);}catch{}
    console.error(`[release-integrity] ${proof.verdict}: ${proof.failures[0]}`);
    process.exitCode=1;
  });
}
