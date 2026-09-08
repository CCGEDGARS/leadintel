export const COPILOT_SKILLS=Object.freeze([
  {id:'product_help',name:'LeadIntel Product Guide',instruction:'Explain the visible LeadIntel product, field, button, workflow or terminology accurately and in user-facing language. Distinguish current product behavior from planned functionality.'},
  {id:'technical_setup',name:'Technical Setup & Integrations',instruction:'Explain safe setup and integration concepts, user-granted permissions and visible connection states. Never request or reveal credentials in chat. Verify freshness-dependent provider instructions before presenting them as current.'},
  {id:'workspace_diagnostic',name:'Workspace Diagnostic',instruction:'Assess completeness, consistency, quality, evidence and readiness. Prefer deterministic gaps where available and clearly distinguish strategic judgment from verified facts.'},
  {id:'icp',name:'ICP Architect',instruction:'Refine ideal customer profiles, exclusions, lookalike logic and commercial specificity using the authenticated workspace context.'},
  {id:'signal_trigger',name:'Signal & Trigger Strategist',instruction:'Recommend observable buying signals and triggers, useful keywords, source categories and priority weights tied to real commercial timing.'},
  {id:'market_intelligence',name:'Market Intelligence Analyst',instruction:'Interpret market research, evidence quality, source selection and research depth. Use fresh external research only when internal context is insufficient or freshness matters.'},
  {id:'lead_qualification',name:'Lead Qualification Analyst',instruction:'Explain lead and company qualification using fit, intent, timing, value, evidence, confidence and scoring signals without inventing evidence.'},
  {id:'decision_maker',name:'Decision-Maker Strategist',instruction:'Prioritize buyer and influencer roles based on the opportunity, ICP and sales context before contact enrichment.'},
  {id:'outreach',name:'Outreach Strategist',instruction:'Improve positioning, personalization, follow-up logic and objection-aware messaging using verified opportunity context.'},
  {id:'crm_pipeline',name:'CRM & Pipeline Coach',instruction:'Diagnose pipeline health, prioritization, stalled opportunities and next actions while respecting CRM lifecycle and suppression safeguards.'},
  {id:'performance',name:'Performance Analyst',instruction:'Interpret available reply, meeting and conversion outcomes and connect learning back to ICP, signal and messaging decisions.'},
  {id:'troubleshooting',name:'Troubleshooting',instruction:'Diagnose product and integration problems structurally. Separate observed facts from hypotheses and avoid guessing when current evidence is insufficient.'},
  {id:'action_safety',name:'Action Safety',instruction:'Classify output as advice, recommendation, safe action proposal or prohibited action. Never execute a workspace mutation without an allowlisted proposal and explicit confirmation.'}
]);

const KNOWN=new Map(COPILOT_SKILLS.map(skill=>[skill.id,skill]));
function add(set,...ids){ids.forEach(id=>KNOWN.has(id)&&set.add(id));}

export function routeCopilotSkills(question,context={}){
  const q=String(question||'').toLowerCase();const selected=new Set();
  if(/button|field|page|screen|what does|how does leadintel|module|workflow/.test(q))add(selected,'product_help');
  if(/api\s*key|oauth|connect|connection|integration|apollo|firecrawl|gmail|openai|gemini|anthropic|calendly|zoom|setup|configure/.test(q))add(selected,'technical_setup','troubleshooting');
  if(/missing|weak|gap|ready|readiness|complete|quality|contradict|diagnos|what should i do next/.test(q))add(selected,'workspace_diagnostic');
  if(/\bicp\b|ideal customer|target customer|poor quality|wrong leads|exclusion|lookalike/.test(q))add(selected,'icp','workspace_diagnostic');
  if(/signal|trigger|monitor|buying event|poor quality|wrong leads/.test(q))add(selected,'signal_trigger','workspace_diagnostic');
  if(/market research|market intelligence|source|evidence|research depth/.test(q))add(selected,'market_intelligence');
  if(/score|scored|qualification|qualified|poor quality|wrong leads|fit|intent/.test(q))add(selected,'lead_qualification');
  if(/decision.?maker|buyer role|procurement director|contact role/.test(q))add(selected,'decision_maker');
  if(/outreach|email|message|follow.?up|objection|personalization/.test(q))add(selected,'outreach');
  if(/crm|pipeline|stalled|stage|opportunity/.test(q))add(selected,'crm_pipeline');
  if(/performance|conversion|reply rate|meeting rate|results/.test(q))add(selected,'performance');
  if(/error|failed|not working|problem|why can.?t|diagnose/.test(q))add(selected,'troubleshooting');
  if(/add|update|apply|change|edit|set|remove|execute/.test(q))add(selected,'action_safety');
  if(!selected.size)add(selected,Number(context?.screen?.step)>=4?'workspace_diagnostic':'product_help');
  return [...selected];
}

export function skillInstructions(skillIds){
  const ids=Array.isArray(skillIds)?skillIds:[];const seen=new Set();const lines=[];
  for(const id of ids){const skill=KNOWN.get(String(id));if(!skill||seen.has(skill.id))continue;seen.add(skill.id);lines.push(`### ${skill.name}\n${skill.instruction}`);}
  return lines.join('\n\n').slice(0,12000);
}
