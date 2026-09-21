(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LeadIntelAttentionModel=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const STALL_MS=180000;
  const FAILED=new Set(['error','interrupted','partial']);
  function clean(value,max=240){return String(value??'').replace(/(?:api[_ -]?key|token|authorization|secret)\s*[=:]\s*\S+/gi,'[protected]').replace(/\s+/g,' ').trim().slice(0,max);}
  function buildAttentionItems({model=[],tasks=[],unsaved=false,runtimeErrors=[],workspaceStarted=true,now=Date.now()}={}){
    const items=[];
    runtimeErrors.slice(-3).forEach(error=>items.push({id:`runtime-${clean(error?.id||items.length+1,80)}`,severity:'important',title:'Workspace error',detail:clean(error?.message||'A workspace component stopped unexpectedly.'),target:{type:'runtime'}}));
    tasks.forEach(task=>{
      const id=clean(task?.id,120);if(!id)return;
      if(FAILED.has(task.status))items.push({id:`task-${id}`,severity:'important',title:clean(task.title||'Background task needs attention',120),detail:clean(task.error||task.stage||'The task did not finish.'),target:{type:'tasks'}});
      else if(['running','queued'].includes(task.status)&&now-Number(task.updatedAt||now)>STALL_MS)items.push({id:`task-${id}`,severity:'important',title:clean(task.title||'Background task may be stalled',120),detail:'No progress has been reported for more than three minutes.',target:{type:'tasks'}});
    });
    const current=model.find(stage=>stage?.status==='current');
    if(workspaceStarted){const next=current?.steps?.find(step=>!step.complete&&!step.optional);if(next)items.push({id:`stage-${current.id}-${clean(next.id,80)}`,severity:'important',title:clean(next.label||'Required step unfinished',120),detail:clean(next.action||`Finish this required step in ${current.name}.`),target:{type:'stage',id:current.id}});}
    if(unsaved)items.push({id:'unsaved-workspace',severity:'improve',title:'Workspace changes are not saved',detail:'Save the workspace so these changes are available next time.',target:{type:'save'}});
    return items.filter((item,index,array)=>array.findIndex(candidate=>candidate.id===item.id)===index).slice(0,10);
  }
  return {buildAttentionItems};
});
