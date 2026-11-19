const STEP_LABELS=Object.freeze({1:'Setup',2:'Profile',3:'Profile',4:'Strategy',5:'Companies',6:'Messages',7:'Delivery'});
const PROMPTS=Object.freeze({
  1:['What is missing from my company and market setup?','What should I add before continuing?','How does LeadIntel use this website?'],
  2:['Which answers would improve targeting most?','What buyer roles should I define?','What exclusions should I add?'],
  3:['What does my intelligence profile show?','Which assumptions need evidence?','What should I improve before strategy?'],
  4:['How can I improve my ICP?','Which signals should I monitor?','What makes a strong opportunity signal?'],
  5:['Why are these companies relevant?','How can I improve lead quality?','What should I verify before enrichment?'],
  6:['How should I personalize this outreach?','Which message angle fits this lead?','What should I avoid saying?'],
  7:['What should I learn from replies?','What should I improve in delivery?','Which next action is highest priority?']
});

function activeStep(){const active=document.querySelector('.step-view.active[data-step]');const fromView=Number(active?.dataset?.step);if(fromView>=1&&fromView<=7)return fromView;const process=document.querySelector('.process-stage.active[data-process-step]');const fromProcess=Number(process?.dataset?.processStep);return fromProcess>=1&&fromProcess<=7?fromProcess:1;}

// Labels explain available controls; never read input values, message bodies or credentials.
function controlLabel(value){return String(value||'').replace(/\bsk-[\w-]+|\bBearer\s+\S+|\b(?:api[_ -]?key|password|token|secret)\s*[:=]\s*\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[redacted]').replace(/\s+/g,' ').trim().slice(0,100);}
export function currentCopilotControls(){
 const controls=[];let total=0;
 const recent=[...(window.LeadIntelCopilotActivity?.snapshot?.()||[])].reverse().find(row=>row.kind==='control'&&row.controlId)?.controlId;
 const priority=button=>recent&&button.id===recent?0:button.closest('.step-view.active,[role="dialog"],dialog[open]')?1:2;
 const buttons=[...document.querySelectorAll('button,[role="button"]')].sort((a,b)=>priority(a)-priority(b));
 for(const button of buttons){
  if(button.closest('#leadintel-copilot-drawer,[hidden],[aria-hidden="true"]')||!button.getClientRects().length)continue;
  const style=window.getComputedStyle(button);if(style.visibility==='hidden'||style.display==='none')continue;
  total++;if(controls.length>=40)continue;
  const label=controlLabel(button.getAttribute('aria-label')||button.getAttribute('title')||(button.tagName==='INPUT'?'Submit':button.textContent));
  if(label)controls.push({label,id:/^[a-z][a-z0-9_-]{0,79}$/i.test(button.id)?button.id:'',disabled:button.disabled===true||button.getAttribute('aria-disabled')==='true'});
 }
 return {items:controls,omitted:Math.max(0,total-controls.length),coverage:'Visible control labels only; hidden views and successful execution are not established.'};
}

export function currentCopilotScreenContext(){
  const step=activeStep();let label=STEP_LABELS[step]||STEP_LABELS[1];if(step===5){const buyersGuide=document.getElementById('discovery-buyers-guide');if(buyersGuide&&!buyersGuide.hidden)label='Buyers';}const context={step,label};const trail=window.LeadIntelCopilotActivity?.snapshot?.();if(Array.isArray(trail)&&trail.length)context.activity=trail.slice(-20);const entity=document.querySelector('[data-copilot-entity-type][data-copilot-entity-id]');
  if(entity?.dataset?.copilotEntityType)context.entity_type=String(entity.dataset.copilotEntityType).slice(0,80);if(entity?.dataset?.copilotEntityId)context.entity_id=String(entity.dataset.copilotEntityId).slice(0,180);
  if(step===5){
    context.companyScores=[...document.querySelectorAll('.company-result-row[data-company-row-key]')]
      .filter(row=>row.getClientRects().length)
      .map(row=>row.querySelector('[data-company-score]')?.dataset)
      .filter(data=>data?.companyScore)
      .map(data=>({domain:data.companyKey,score:Number(data.companyScore),state:data.scoreState}))
      .sort((a,b)=>b.score-a.score).slice(0,10);
  }
  context.controls=currentCopilotControls();
  const workspace=String(window.LeadIntelServerBridge?.workspace?.id||'');
  const operations=window.LeadIntelReliabilityTrace?.snapshot?.();
  if(workspace&&Array.isArray(operations))context.operations=operations.filter(row=>row.workspaceId===workspace).slice(-12).map(({operationId,stage,action,phase,outcome,at})=>({operationId,stage,action,phase,outcome,at}));
  return context;
}
export function contextualPromptSuggestions(step){const key=Math.max(1,Math.min(7,Number(step)||1));return [...(PROMPTS[key]||PROMPTS[1])];}

if(typeof window!=='undefined')window.LeadIntelCopilotContext={currentCopilotScreenContext,contextualPromptSuggestions};
