export const COPILOT_KNOWLEDGE_VERSION='2026-10-10-my-flows-v1';

const STEPS=Object.freeze({
  1:{step:1,title:'Step 1 · Company & Market',freshness:'stable',summary:'Define the company LeadIntel is analyzing and the geographic or commercial markets where opportunities should be found.',guidance:['Use the public company website as primary evidence.','Select at least one target market before moving into commercial intelligence.','Additional links and company materials improve precision but are optional.']},
  2:{step:2,title:'Step 2 · Strategic Intake',freshness:'stable',summary:'Add commercial context the public website cannot reliably infer, including priorities, ideal customers, buyer roles, triggers, exclusions and opportunity economics.',guidance:['Strategic Intake is enrichment, not a replacement for public evidence.','Specific answers improve ICP, signal and qualification precision.','Questions may be skipped when the information is genuinely unknown.']},
  3:{step:3,title:'Step 3 · Intelligence Profile',freshness:'stable',summary:'Review the synthesized company intelligence profile before using it as the basis for targeting, signals and downstream commercial decisions.',guidance:['Separate verified evidence from assumptions.','Correct weak or inaccurate profile fields before building strategy.','Profile approval improves downstream consistency.']},
  4:{step:4,title:'Step 4 · Market Strategy',freshness:'stable',summary:'Design ideal customer profiles, buying signals, weights and opportunity hypotheses that determine what LeadIntel should look for in the market.',guidance:['Keep ICP definitions commercially specific.','Prefer observable buying signals over generic company descriptions.','Signal weights should reflect commercial relevance and timing.']},
  5:{step:5,title:'Step 5 · Discovery',freshness:'stable',summary:'Find and qualify companies against the chosen ICPs, signals, market evidence and scoring logic before spending enrichment or outreach resources.',guidance:['Evidence should explain why a company belongs in the result set.','Qualification should precede paid contact enrichment.','Use Master CRM as durable company memory rather than treating the visible pipeline as the only record.']},
  6:{step:6,title:'Step 6 · Content & Scripts',freshness:'stable',summary:'Turn qualified opportunity intelligence into relevant outreach positioning, messages, follow-up content and sales conversation material.',guidance:['Personalization should be grounded in verified opportunity evidence.','Do not invent triggers or company facts.','Keep outreach aligned with the selected buyer role and commercial hypothesis.']},
  7:{step:7,title:'Step 7 · Delivery & Learning',freshness:'stable',summary:'Deliver approved outreach through the configured safeguards, observe replies and outcomes, and feed commercial learning back into LeadIntel.',guidance:['Automatic outreach remains governed by explicit policy and approval safeguards.','Replies stop future follow-ups in the automation engine.','Performance learning should improve ICPs, signals and messaging over time.']}
});

const TECH=Object.freeze({
  flows:{topic:'My Flows',freshness:'stable',summary:'My Flows replaces Workflow automation beside the seven-step workspace. Owners can save up to ten independent flows and enable at most two automated flows. Manual work is available in paused flows.',guidance:['Open a flow to load its markets, strategy, references, research and drafts. Website, business inputs, sender and connections are shared.','Duplicates start paused with a mandatory market, targeting, source, trigger, language and schedule checklist. Open and approve the market strategy before confirming it; automation still needs stage and final approval.','Saving and switching are authenticated, durable and conflict guarded. Resolve sync failures before switching; never advise discarding local work.','Cards show actual flow-linked automated sends, human replies and non-cancelled booked meetings for the last thirty days. Opening and delivery-based conversion rates and per-flow costs are not yet tracked.','Active flows share mailbox sending limits and windows. Two saved or enabled flows do not prove real provider capacity or successful outreach. Support cannot activate, change or duplicate flows for a user.']},
  openai:{topic:'OpenAI settings',freshness:'stable',summary:'LeadIntel can use a customer-owned OpenAI API key stored encrypted for the authenticated workspace. The workspace owner configures and verifies the provider in LeadIntel settings.',guidance:['Never paste API keys into Copilot chat.','Use the LeadIntel provider settings interface for credentials.','Provider UI locations, pricing and limits can change and should be freshly verified when asked.']},
  apollo:{topic:'Apollo',freshness:'stable',summary:'Apollo supports decision-maker discovery and paid contact enrichment. LeadIntel keeps enrichment deliberate so credits are spent only after qualification and user-selected actions.',guidance:['Configure credentials only in the supported integration settings.','Company and role matching should be established before paid enrichment.','Current Apollo account screens, credit rules and API-key locations should be freshly verified when needed.']},
  firecrawl:{topic:'Firecrawl',freshness:'stable',summary:'Firecrawl is a web-research and extraction provider used by LeadIntel for public-source intelligence, with customer-owned credentials or the supported managed fallback where configured.',guidance:['Research requests are bounded and workspace scoped.','Use public sources and preserve source provenance.','Current provider limits and dashboard locations should be freshly verified when asked.']},
  gmail:{topic:'Gmail',freshness:'stable',summary:'Gmail connects through Google authorization so LeadIntel can send approved outreach and read relevant replies under the workspace delivery safeguards.',guidance:['The workspace owner controls connection and disconnection.','LeadIntel does not expose OAuth refresh tokens to the browser or Copilot.','Automatic delivery remains subject to send limits, windows, pause and emergency-stop controls.']},
  calendly_zoom:{topic:'Calendly / Zoom',freshness:'verify',summary:'LeadIntel supports Calendly connection and booking-event synchronization. Zoom meeting availability depends on the user’s Calendly event setup; do not claim a direct Zoom connection. Verify the workspace connection before promising functionality.',guidance:['Do not claim the integration is active unless the workspace shows it as connected.','When implemented, meeting actions must follow explicit permissions and existing outreach safeguards.']}
});

export function productKnowledgeFor({step,topic}={}){
  const number=Math.max(1,Math.min(7,Math.floor(Number(step)||0)));
  if(step&&STEPS[number])return {...STEPS[number],guidance:[...STEPS[number].guidance]};
  const q=String(topic||'').toLowerCase();
  for(const entry of Object.values(STEPS))if(q&&entry.title.toLowerCase().includes(q))return {...entry,guidance:[...entry.guidance]};
  return {...STEPS[1],guidance:[...STEPS[1].guidance]};
}

export function technicalGuidanceFor(topic){
  const q=String(topic||'').toLowerCase();
  let entry=null;
  if(/calendly|zoom|meeting booking/.test(q))entry=TECH.calendly_zoom;
  else if(/apollo/.test(q))entry=TECH.apollo;
  else if(/firecrawl/.test(q))entry=TECH.firecrawl;
  else if(/gmail|google mail/.test(q))entry=TECH.gmail;
  else if(/openai|gpt/.test(q))entry=TECH.openai;
  if(!entry)return null;
  const changing=/api\s*key.*(?:where|location|create|get)|pricing|price|limit|quota|dashboard|current|latest/.test(q);
  return {...entry,freshness:changing?'verify':entry.freshness,guidance:[...entry.guidance]};
}

export function supportKnowledge(){return {
 version:COPILOT_KNOWLEDGE_VERSION, steps:Object.values(STEPS), integrations:Object.values(TECH),
 rules:[
 'Profile → Companies → Buyers → Triggers → Messages → CRM is a connected workflow. Reference customers describe buyers, not the seller.',
 'Buyer research presents a candidate pool and four detailed recommendations, targeting two executive and two purchasing/project decision-makers where evidence supports them. Unknown names or contact details stay unknown.',
 'Confirm LinkedIn lets the user check a profile before proceeding to a LinkedIn message. Guessed emails remain unverified; do not describe them as safe verified addresses.',
 'Messages use the seller profile, selected company, buyer and sourced trigger. A trigger supports relevance, not proof of buying intent.',
 'Save retains a draft; Edit permits manual changes; Rewrite requests a different AI version; Restore original returns to the tailored original. Subject choices use the approved short subjects in the selected language.',
 'Sender identity, credentials, phone and email belong to the active workspace. Never substitute another customer’s details.',
 'CRM preserves history when a company is removed from the active pipeline. Archive is reversible; suppression blocks outbound eligibility. Script approval is not permission to send.',
 'Save workspace before asking for personalized diagnostics; unsaved changes may not match the server snapshot.',
 'No attachments, code execution, configuration changes, exports or database access through support. Unknown errors need a sanitized support reference.',
 'Use only supplied integration evidence for active capabilities. Current pricing and plan limits require fresh official verification.'
 ],links:[
 {provider:'openai',title:'OpenAI API billing',url:'https://platform.openai.com/settings/organization/billing/overview'},
 {provider:'firecrawl',title:'Firecrawl account and credits',url:'https://www.firecrawl.dev/app'},
 {provider:'apollo',title:'Apollo account and billing',url:'https://app.apollo.io/'},
 {provider:'openai',title:'OpenAI service status',url:'https://status.openai.com/'}
 ]};}
