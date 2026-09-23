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

export function currentCopilotScreenContext(){
  const step=activeStep();let label=STEP_LABELS[step]||STEP_LABELS[1];if(step===5){const buyersGuide=document.getElementById('discovery-buyers-guide');if(buyersGuide&&!buyersGuide.hidden)label='Buyers';}const context={step,label};const entity=document.querySelector('[data-copilot-entity-type][data-copilot-entity-id]');
  if(entity?.dataset?.copilotEntityType)context.entity_type=String(entity.dataset.copilotEntityType).slice(0,80);if(entity?.dataset?.copilotEntityId)context.entity_id=String(entity.dataset.copilotEntityId).slice(0,180);return context;
}
export function contextualPromptSuggestions(step){const key=Math.max(1,Math.min(7,Number(step)||1));return [...(PROMPTS[key]||PROMPTS[1])];}

if(typeof window!=='undefined')window.LeadIntelCopilotContext={currentCopilotScreenContext,contextualPromptSuggestions};
