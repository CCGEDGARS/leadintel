(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LeadIntelAttentionModel=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const STALL_MS=180000;
  const FAILED=new Set(['error','interrupted','partial']);
  function clean(value,max=240){return String(value??'').replace(/(?:api[_ -]?key|token|authorization|secret)\s*[=:]\s*\S+/gi,'[protected]').replace(/\s+/g,' ').trim().slice(0,max);}
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
  function buildAttentionItems({connectionIssues=[],model=[],tasks=[],unsaved=false,runtimeErrors=[],aiProviderIssue=null,providerIssues=[],workspaceStarted=true,now=Date.now()}={}){
    const items=[...connectionIssues];
    const creditProviders=new Set(providerIssues.map(issue=>issue.provider));
    providerIssues.forEach(issue=>items.push({id:`provider-${issue.provider}-credits`,severity:'error',title:`${clean(issue.name,60)} credit or billing issue`,detail:issue.source==='managed'?`LeadIntel manages ${issue.name} billing and must restore service. Your account does not need a top-up.`:issue.source==='unknown'?`${issue.name} returned HTTP 402 during the latest company search. Open AI & Tools to check which account supplies it.`:`${issue.name} reported exhausted credits or a billing limit during a real request. Check its balance and spending limit, then retry.`,target:{type:'settings'}}));
    if(!creditProviders.has('openai')&&aiProviderIssue?.provider==='openai'&&aiProviderIssue?.code==='credit_balance_exhausted'){
      const sourceCount=Math.max(0,Math.floor(Number(aiProviderIssue.sourceCount)||0));
      const savedNote=sourceCount?`Your ${sourceCount} saved company research sources are safe.`:'Your saved company research is safe.';
      items.push({id:'ai-openai-credit-balance',severity:'error',title:'OpenAI API credits exhausted',detail:`OpenAI reports that the API credit balance for the connected organization is exhausted. Check that organization and add credits in OpenAI billing, then retry synthesis. ${savedNote}`,target:{type:'ai-billing'}});
    }
    runtimeErrors.slice(-3).forEach(error=>items.push({id:`runtime-${clean(error?.id||items.length+1,80)}`,severity:'recommendation',title:'Workspace needs attention',detail:clean(error?.message||'A workspace component stopped unexpectedly.'),target:{type:'runtime'}}));
    tasks.forEach(task=>{
      const id=clean(task?.id,120);if(!id)return;
      if(FAILED.has(task.status))items.push({id:`task-${id}`,severity:'recommendation',title:clean(task.title||'Background task needs attention',120),detail:clean(task.error||task.stage||'The task did not finish.'),target:{type:'tasks'}});
      else if(['running','queued'].includes(task.status)&&now-Number(task.updatedAt||now)>STALL_MS)items.push({id:`task-${id}`,severity:'recommendation',title:clean(task.title||'Background task may be stalled',120),detail:'No progress has been reported for more than three minutes.',target:{type:'tasks'}});
    });
    const current=model.find(stage=>stage?.status==='current');
    if(workspaceStarted){const next=current?.steps?.find(step=>!step.complete&&!step.optional);if(next)items.push({id:`stage-${current.id}-${clean(next.id,80)}`,severity:'recommendation',title:clean(next.label||'Required step unfinished',120),detail:clean(next.action||`Finish this required step in ${current.name}.`),target:{type:'stage',id:current.id}});}
    if(unsaved)items.push({id:'unsaved-workspace',severity:'recommendation',title:'Workspace changes are not saved',detail:'Save the workspace so these changes are available next time.',target:{type:'save'}});
    return items.sort((a,b)=>(a.severity==='error'?0:1)-(b.severity==='error'?0:1)).filter((item,index,array)=>array.findIndex(candidate=>candidate.id===item.id)===index).slice(0,10);
  }
  return {aiProviderIssueFromResearch,providerCreditIssues,providerConnectionIssues,healthSummary,buildAttentionItems};
});
