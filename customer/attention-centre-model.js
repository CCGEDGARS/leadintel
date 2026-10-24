(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LeadIntelAttentionModel=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const STALL_MS=180000;
  const FAILED=new Set(['error','interrupted','partial']);
  function clean(value,max=240){return String(value??'').replace(/(?:api[_ -]?key|token|authorization|secret)\s*[=:]\s*\S+/gi,'[protected]').replace(/\s+/g,' ').trim().slice(0,max);}
  function taskDomain(value){
    const domain=String(value||'').toLowerCase();
    if(domain.length>253||!domain.includes('.')||!domain.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))||!/[a-z]/.test(domain.split('.').at(-1)))return '';
    return domain.replace(/^www\./,'');
  }
  function buyerTaskScope(task,workspaceId){
    const meta=task.metadata||{},explicit=meta.domain||meta.companyDomain,domain=taskDomain(explicit);
    const legacy=String(task.id||'').match(/^decision-maker-search:([^:]+):([1-9]\d{12})$/),legacyDomain=legacy?taskDomain(legacy[1]):'';
    if(explicit&&!domain||domain&&legacyDomain&&domain!==legacyDomain)return task.id;
    // Metadata-free records came from this account-scoped task store. Only a
    // verified current workspace and the generated domain/timestamp ID can
    // connect them to a later attempt; arbitrary company labels stay unknown.
    if(!domain&&(!workspaceId||meta.workspaceId&&meta.workspaceId!==workspaceId||!legacyDomain))return task.id;
    const scopedWorkspace=meta.workspaceId||workspaceId;if(!scopedWorkspace)return task.id;
    return JSON.stringify([task.type,scopedWorkspace,meta.flowId||'',domain||legacyDomain,meta.contactId||'']);
  }
  function canonicalWebsite(value){try{const url=new URL(String(value??'').trim());if(!['http:','https:'].includes(url.protocol))return '';url.hostname=url.hostname.toLowerCase();url.hash='';url.pathname=url.pathname.replace(/\/+$/,'')||'/';return url.href;}catch{return '';}}
  function aiProviderIssueFromResearch({state={},researchMeta={}}={}){
    const currentWebsite=canonicalWebsite(state?.website),researchWebsite=canonicalWebsite(researchMeta?.website);
    if(!currentWebsite||currentWebsite!==researchWebsite||!researchMeta?.generatedAt||researchMeta.mode==='ai')return null;
    if(!/\bcode:\s*credit_balance_exhausted\b/i.test(String(researchMeta.reason||'')))return null;
    return {provider:'openai',code:'credit_balance_exhausted',sourceCount:Math.max(0,Math.floor(Number(researchMeta.sourceCount)||0))};
  }
  function providerCreditIssues({ai={},services={}}={}){
    const names={openai:'OpenAI',gemini:'Google Gemini',anthropic:'Anthropic',firecrawl:'Firecrawl',apollo:'Apollo.io',hunter:'Hunter'};
    return [...(ai.providers||[]),...(services.providers||[])].filter(row=>(row?.configured||row?.source==='managed')&&(row.credit_issue?.code==='credits_exhausted'||Number(row.metadata?.proxy_status)===402)).map(row=>({provider:row.provider,name:names[row.provider]||row.name||row.provider,source:row.credit_issue?.source||row.source||'customer'})).filter(row=>names[row.provider]);
  }
  function providerConnectionIssues({ai={},services={},requiredProviders=[]}={}){return [...(ai.providers||[]),...(services.providers||[])].filter(row=>!row.credit_issue&&(((row.configured||row.source==='managed')&&(row.state==='bad'||row.state==='error'))||(requiredProviders.includes(row.provider)&&!row.configured&&row.source!=='managed'))).map(row=>({id:'provider-'+row.provider+'-connection',severity:'recommendation',title:(row.name||row.provider)+' needs attention',detail:clean(row.metadata?.error||row.label||'Check the provider connection before using this tool.'),target:{type:'settings'}}));}
  function healthSummary(items=[]){const billing=items.filter(item=>item.severity==='error').length,attention=items.filter(item=>item.severity==='recommendation').length;return {status:billing?'error':attention?'recommendation':'healthy',count:billing+attention,text:billing?`${billing} billing issue${billing===1?'':'s'}${attention?` · ${attention} need attention`:''}`:attention?`${attention} item${attention===1?'':'s'} need attention`:'Workspace healthy'};}
  // Warn before the 500 KB sync ceiling fails a save: research evidence grows with every run.
  function syncBudgetNotice(budget){
    if(!budget||typeof budget!=='object')return null;
    const limit=Math.max(1,Number(budget.limit)||500*1024),bytes=Number(budget.bytes);
    const kb=value=>Math.ceil(value/1024);
    if(budget.exceeded===true)return {id:'workspace-sync-budget',severity:'recommendation',title:'Workspace is over the sync limit',detail:`Saved research exceeds the ${kb(limit)} KB sync limit even after compaction, so cloud saves fail. Clear older company search results in Companies, then save again.`,target:{type:'stage',id:4}};
    if(!Number.isFinite(bytes)||bytes<limit*0.8)return null;
    return {id:'workspace-sync-budget',severity:'recommendation',title:'Workspace is close to the sync limit',detail:`Saved research is ${kb(bytes)} KB of the ${kb(limit)} KB sync limit after compaction. Clear older company search results in Companies before a larger research run so saving keeps working.`,target:{type:'stage',id:4}};
  }
  function buildAttentionItems({connectionIssues=[],model=[],tasks=[],workspaceId='',unsaved=false,runtimeErrors=[],aiProviderIssue=null,providerIssues=[],workspaceStarted=true,syncBudget=null,now=Date.now()}={}){
    const items=[...connectionIssues];
    const creditProviders=new Set(providerIssues.map(issue=>issue.provider));
    providerIssues.forEach(issue=>items.push({id:`provider-${issue.provider}-credits`,severity:'error',title:`${clean(issue.name,60)} credit or billing issue`,detail:issue.source==='managed'?`LeadIntel manages ${issue.name} billing and must restore service. Your account does not need a top-up.`:issue.source==='unknown'?`${issue.name} returned HTTP 402 during the latest company search. Open AI & Tools to check which account supplies it.`:`${issue.name} reported exhausted credits or a billing limit during a real request. Check its balance and spending limit, then retry.`,target:{type:'settings'}}));
    if(!creditProviders.has('openai')&&aiProviderIssue?.provider==='openai'&&aiProviderIssue?.code==='credit_balance_exhausted'){
      const sourceCount=Math.max(0,Math.floor(Number(aiProviderIssue.sourceCount)||0));
      const savedNote=sourceCount?`Your ${sourceCount} saved company research sources are safe.`:'Your saved company research is safe.';
      items.push({id:'ai-openai-credit-balance',severity:'error',title:'OpenAI API credits exhausted',detail:`OpenAI reports that the API credit balance for the connected organization is exhausted. Check that organization and add credits in OpenAI billing, then retry synthesis. ${savedNote}`,target:{type:'ai-billing'}});
    }
    // Customers never see raw exception text; identical errors collapse into one item. The technical message stays on the item for support.
    const seenRuntime=new Set();
    runtimeErrors.filter(error=>{const text=clean(error?.message||'');if(!text||seenRuntime.has(text))return false;seenRuntime.add(text);return true;}).slice(-3).forEach(error=>items.push({id:`runtime-${clean(error?.id||items.length+1,80)}`,severity:'recommendation',title:'Workspace needs attention',detail:'A page component stopped unexpectedly. Reload the workspace to recover; your saved data is not affected.',technical:clean(error?.message||''),target:{type:'runtime'}}));
    // Task history survives for inspection. Only the latest attempt in each
    // research scope describes its present health, regardless of history order.
    const latestTasks=new Map();
    for(const task of tasks){
      const meta=task.metadata||{},scope=task.type==='decision-maker-search'?buyerTaskScope(task,workspaceId):task.type==='company-discovery'?[task.type,meta.workspaceId||'',meta.flowId||''].join('|'):meta.domain||meta.companyDomain||meta.contactId?[task.type,meta.workspaceId||'',meta.flowId||'',meta.domain||meta.companyDomain||'',meta.contactId||'',task.title||''].join('|'):task.id;
      const previous=latestTasks.get(scope);
      if(!previous||Number(task.startedAt||task.updatedAt||0)>Number(previous.startedAt||previous.updatedAt||0))latestTasks.set(scope,task);
    }
    [...latestTasks.values()].forEach(task=>{
      const id=clean(task?.id,120);if(!id)return;
      if(FAILED.has(task.status))items.push({id:`task-${id}`,severity:'recommendation',title:clean(task.title||'Background task needs attention',120),detail:clean(task.error||task.stage||'The task did not finish.'),target:{type:'tasks'}});
      else if(['running','queued'].includes(task.status)&&now-Number(task.updatedAt||now)>STALL_MS)items.push({id:`task-${id}`,severity:'recommendation',title:clean(task.title||'Background task may be stalled',120),detail:'No progress has been reported for more than three minutes.',target:{type:'tasks'}});
    });
    const current=model.find(stage=>stage?.active===true)||model.find(stage=>stage?.active==null&&stage?.status==='current');
    if(workspaceStarted){const next=current?.steps?.find(step=>!step.complete&&!step.optional);if(next)items.push({id:`stage-${current.id}-${clean(next.id,80)}`,severity:'recommendation',title:clean(next.label||'Required step unfinished',120),detail:clean(next.action||`Finish this required step in ${current.name}.`),target:{type:'stage',id:current.id}});}
    const budgetNotice=syncBudgetNotice(syncBudget);if(budgetNotice)items.push(budgetNotice);
    if(unsaved)items.push({id:'unsaved-workspace',severity:'recommendation',title:'Workspace changes are not saved',detail:'Save the workspace so these changes are available next time.',target:{type:'save'}});
    return items.sort((a,b)=>(a.severity==='error'?0:1)-(b.severity==='error'?0:1)).filter((item,index,array)=>array.findIndex(candidate=>candidate.id===item.id)===index).slice(0,10);
  }
  function providerConnected({ai={},services={}}={},provider){return [...(ai?.providers||[]),...(services?.providers||[])].some(row=>row?.provider===provider&&Boolean(row.configured||row.source==='managed'));}
  // Pre-flight text for the market-research plan: which research tools are missing before a paid run starts.
  function researchProviderNotice(status={}){
    if(!status||(!status.ai&&!status.services))return '';
    const has=provider=>providerConnected(status,provider);const parts=[];
    if(!has('firecrawl'))parts.push('Firecrawl is not connected: no evidence can be extracted. Connect it in Settings before starting.');
    if(!has('openai')&&!has('gemini'))parts.push('OpenAI and Google Gemini are not connected: page discovery will run on Firecrawl search only.');
    else if(!has('openai'))parts.push('OpenAI is not connected: page discovery will use Google Gemini grounding only.');
    else if(!has('gemini'))parts.push('Google Gemini is not connected: independent evidence verification is off.');
    return parts.join(' ');
  }
  return {aiProviderIssueFromResearch,providerCreditIssues,providerConnectionIssues,healthSummary,buildAttentionItems,providerConnected,researchProviderNotice,syncBudgetNotice};
});
