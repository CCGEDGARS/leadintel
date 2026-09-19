const OPENAI_RETRY_DELAY_MS=600;

const wait=delayMs=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(delayMs)||0)));

function isTransientOpenAiFailure(error){
  const message=String(error?.message||error||'');
  return /timed out|timeout|abort(?:ed|error)?|failed to fetch|network error|temporarily unavailable|request failed \((?:408|429|5\d\d)\)|returned (?:408|429|5\d\d)/i.test(message);
}

function cleanOpenAiResearchQuery(value){
  const raw=String(value||'').replace(/\s+/g,' ').trim();
  if(!raw)return '';
  const latvianNoise=/^(ziņas|paziņojums|paziņojumi|paplašināšanās|iepirkums|vakances)$/i;
  const tokens=raw.split(' ').map(word=>word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')).filter(Boolean).filter(word=>!latvianNoise.test(word));
  const keys=tokens.map(word=>word.toLocaleLowerCase('en'));const words=[];
  for(let index=0;index<tokens.length;){
    let duplicateLength=0;
    for(let start=0;start<index;start++){
      let length=0;while(index+length<tokens.length&&keys[start+length]===keys[index+length]&&start+length<index)length++;
      if(length>=2)duplicateLength=Math.max(duplicateLength,length);
    }
    if(duplicateLength){index+=duplicateLength;continue;}
    words.push(tokens[index]);index++;
  }
  return words.join(' ').slice(0,180).trim();
}

async function withOpenAiRetry(operation,{sleep=wait}={}){
  try{return await operation(1);}
  catch(error){
    if(!isTransientOpenAiFailure(error))throw error;
    await sleep(OPENAI_RETRY_DELAY_MS);
    try{return await operation(2);}
    catch(retryError){
      if(!isTransientOpenAiFailure(retryError))throw retryError;
      const terminal=new Error('OpenAI signal discovery remained unavailable after 2 attempts');
      terminal.cause=retryError;
      throw terminal;
    }
  }
}

function describePartialCoverage({modeLabel='Research',count=0,openAiStatus='',firecrawlStatus=''}={}){
  const sourceCount=Math.max(0,Number(count)||0);
  if(openAiStatus!=='error'||firecrawlStatus==='error'||sourceCount===0)return null;
  const noun=sourceCount===1?'source was':'sources were';
  return {
    status:`${modeLabel} completed with ${sourceCount} evidence source${sourceCount===1?'':'s'}. Firecrawl succeeded; OpenAI discovery was unavailable within the research time limit.`,
    title:'Research completed with limited coverage',
    intro:`${sourceCount} public evidence ${noun} saved. Retry only OpenAI discovery without losing these results.`
  };
}

function failureKey(item){
  const provider=item.querySelector("strong")?.textContent?.trim()||"";
  const message=item.querySelector("span")?.textContent?.trim()||"";
  return `${provider}::${message}`;
}

function dedupeFailureRows(root=document){
  const list=root.querySelector?.("#research-run-feedback ul");
  if(!list)return 0;
  const seen=new Set();let removed=0;
  for(const item of [...list.children]){
    const key=failureKey(item);
    if(!key||!seen.has(key)){if(key)seen.add(key);continue;}
    item.remove();removed++;
  }
  return removed;
}

function installReportNormalizer(root=document){
  dedupeFailureRows(root);
  if(typeof MutationObserver==="undefined")return null;
  const target=root.getElementById?.("research-run-feedback")||root.body||root.documentElement;
  if(!target)return null;
  const observer=new MutationObserver(()=>dedupeFailureRows(root));
  observer.observe(target,{childList:true,subtree:true});
  return observer;
}

function install(){
  installReportNormalizer(document);
}

if(typeof window!=="undefined"&&typeof document!=="undefined")install();

export {OPENAI_RETRY_DELAY_MS,isTransientOpenAiFailure,cleanOpenAiResearchQuery,withOpenAiRetry,describePartialCoverage,dedupeFailureRows,installReportNormalizer,install};
