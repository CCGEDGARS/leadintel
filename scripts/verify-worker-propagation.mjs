import {pathToFileURL} from 'node:url';

export async function verifyWorkerPropagation({url,expectedSha,fetchImpl=fetch,waitImpl=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=12,delayMs=2000,requireCustomerOnly=true,expectedService='leadintel-api'}){
 if(!/^[a-f0-9]{40}$/.test(expectedSha||''))throw Error('An exact release SHA is required');
 let last='unavailable';
 for(let attempt=1;attempt<=attempts;attempt++){
  try{
   const target=new URL(url);target.searchParams.set('release_check',expectedSha+'-'+attempt);
   const response=await fetchImpl(target,{cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(response.ok){const body=await response.json();
    if(body.status==='ok'&&(requireCustomerOnly?body.billing==='customer_only':body.service===expectedService)&&body.release_sha===expectedSha)return {passed:true,attempts:attempt,sha:expectedSha};
    last='release SHA or required service/billing identity has not propagated';
   }else last='health HTTP '+response.status;
  }catch{last='health unavailable';}
  if(attempt<attempts)await waitImpl(delayMs);
 }
 throw Error('Worker verification failed after '+attempts+' attempts: '+last);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 verifyWorkerPropagation({url:process.argv[2],expectedSha:process.argv[3],requireCustomerOnly:!process.argv.includes('--backend')}).then(result=>console.log('Worker verification passed for '+result.sha+' after '+result.attempts+' attempt(s).')).catch(error=>{console.error(error.message);process.exitCode=1;});
}
