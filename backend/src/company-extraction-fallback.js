function retryReason(error){
  const message=String(error?.message||error||'');
  if(/timed? out|timeout/i.test(message))return 'timeout';
  const match=message.match(/(?:OpenAI )?(?:request failed|returned) \(?([0-9]{3})\)?/i);
  if(!match)return '';
  const status=Number(match[1]);
  if(status===408)return 'timeout';
  if(status===429)return 'quota_or_rate_limit';
  if(status>=500&&status<=599)return 'provider_outage';
  return '';
}

export async function generateCompanyExtraction({
  task='',fallbackProvider='',primaryIntegration=null,getFallbackIntegration,request={},runProvider
}={}){
  if(typeof runProvider!=='function')throw new TypeError('A provider request function is required');
  try{
    return {ok:true,result:await runProvider(primaryIntegration,request),fallback:{status:'not_used',used:false}};
  }catch(primaryError){
    const reason=retryReason(primaryError);
    const isEligible=task==='company-extraction'
      &&fallbackProvider==='gemini'
      &&primaryIntegration?.provider==='openai'
      &&Boolean(reason);
    if(!isEligible)return {ok:false,error:primaryError,fallback:{status:'not_used',used:false}};

    let fallbackIntegration;
    try{fallbackIntegration=await getFallbackIntegration?.();}
    catch{return {ok:false,error:primaryError,fallback:{status:'lookup_failed',used:false,provider:'gemini',reason}};}
    if(fallbackIntegration?.provider!=='gemini'){
      return {ok:false,error:primaryError,fallback:{status:'not_configured',used:false,provider:'gemini',reason}};
    }

    try{
      const result=await runProvider(fallbackIntegration,request);
      return {ok:true,result,fallback:{status:'used',used:true,from:'openai',provider:'gemini',reason}};
    }catch(error){
      return {ok:false,error,fallback:{status:'failed',used:false,from:'openai',provider:'gemini',reason}};
    }
  }
}
