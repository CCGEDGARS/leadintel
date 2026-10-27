// Only fixed diagnostics leave the worker. Never persist raw provider, document or storage errors.
export const SKILL_MAX_ATTEMPTS=3;
export function skillFailure(error,phase){
 const message=String(error?.message||'');
 const result=(code,detail,retryable=false)=>({code,message:detail,retryable});
 if(/WORKSPACE_STORAGE_FULL/.test(message))return result('WORKSPACE_STORAGE_FULL','Workspace storage is full. Free space or upgrade storage, then retry.');
 if(message==='SKILL_SECTION_RETRY_LIMIT')return result('AI_RETRY_LIMIT','This section reached its three-attempt limit. Completed sections are saved. Retry creation to try again.');
 if(message==='SNAPSHOT_MISSING')return result('BOOK_SNAPSHOT_MISSING','The saved book content is unavailable. Keep your original book and recreate this skill.');
 if(message==='MODULE_MISSING')return result('SKILL_SECTION_MISSING','A saved skill section is unavailable. Keep your original book and contact support.');
 if(error?.status===503&&/active AI provider/.test(message))return result('AI_NOT_CONNECTED','Connect an active AI provider in Settings, then retry.');
 if(['load_book','read_progress','save_section','assemble_skill','publish_skill'].includes(phase))return result('SKILL_STORAGE_ERROR',({read_progress:'Saved section progress could not be loaded.',load_book:'The saved book content could not be loaded.',save_section:'A generated section could not be saved.',assemble_skill:'The saved skill sections could not be assembled.',publish_skill:'The completed skill could not be published.'})[phase]+' Completed sections are preserved. Retry or contact support with the diagnostic code.');
 if(/insufficient_quota|credits_exhausted|billing_hard_limit|credit balance|insufficient credits|billing|quota exceeded/i.test(message))return result('AI_BILLING','Your AI provider reported a billing or quota limit. Check its billing account, then retry.');
 if(error?.name==='TimeoutError'||error?.name==='AbortError'||/timed? out|timeout/i.test(message))return result('AI_TIMEOUT','The AI provider did not finish the section before the request timed out.',true);
 const status=Number(message.match(/request failed \((\d+)\)/)?.[1]||0);
 if(status===429)return result('AI_RATE_LIMIT','The AI provider temporarily limited request speed. This does not confirm exhausted credits.',true);
 if(status===401||status===403)return result('AI_ACCESS_DENIED','The AI provider rejected access. Check your saved connection and model permissions in Settings.');
 if([400,404,422].includes(status))return result('AI_REQUEST_REJECTED','The AI provider rejected the model or request settings. Check model access or contact support with the diagnostic code.');
 if(status>=500)return result('AI_PROVIDER_UNAVAILABLE','The AI provider is temporarily unavailable.',true);
 if(/returned no text$|response exceeded output token limit/.test(message))return result('AI_EMPTY_RESPONSE','The AI provider returned no usable section content.',true);
 if(/Invalid skill module/.test(message))return result('INVALID_SKILL_OUTPUT','The AI returned incomplete or invalid section content.',true);
 if(phase==='connect_ai')return result('AI_CONFIGURATION_ERROR','The saved AI configuration could not be loaded. Contact support with the diagnostic code.');
 return result('SKILL_GENERATION_ERROR','Skill generation stopped for an unclassified reason. Completed sections are preserved. Retry or contact support with the diagnostic code.');
}
