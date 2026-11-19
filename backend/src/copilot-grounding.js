// Read-only facts. Counts come from the scoped saved state, never model arithmetic,
// conversation memory, browser form text or web search.
const list=value=>Array.isArray(value)?value:[];
const name=value=>String(value||'').replace(/[\r\n]+/g,' ').slice(0,240);
const providerName=value=>({anthropic:'Claude',openai:'OpenAI',gemini:'Gemini',microsoft:'Microsoft Mail',gmail:'Gmail',firecrawl:'Firecrawl',apollo:'Apollo',hunter:'Hunter'})[value]||name(value);

export function workspaceQuestionTopic(question=''){
  const q=String(question).toLowerCase();
  // Current public facts and recommendations may need public research. Never turn
  // an explicit external request into a saved-state-only answer.
  if(/https?:|\b(?:prices?|pricing|credits?|balance|billing|usage|quota|cost|expenses?|competitors?|news|public|internet|web|external|latest market|recommend|should|best|add|create|generate|build|run|activate|delete|change)\b/.test(q))return '';
  if(!/\b(?:my|our|workspace|saved|active|activated|selected|connected|configured|main engine|switched|disabled|off|shown|displayed|i have|we have)\b/.test(q))return '';
  if(/\bsignals?\b/.test(q))return 'signals';
  if(/\b(?:profiles?|icps?)\b/.test(q))return 'profiles';
  if(/\b(?:providers?|engines?|connections?|integrations?|tools?|openai|claude|gemini|firecrawl|apollo|microsoft|gmail)\b/.test(q))return 'integrations';
  if(/\b(?:flows?|workflows?)\b/.test(q))return 'flow';
  if(/\b(?:research|reports?|results?)\b/.test(q))return 'research';
  if(/\bcrm\b/.test(q)&&/\b(?:count|how many|total)\b/.test(q))return 'crm';
  return '';
}
export function directWorkspaceQuestion(question=''){
  return /\b(?:how many|which|what|list|show|do i have|do we have|is .{0,30}connected|are .{0,30}connected)\b/i.test(question)&&! /\b(?:why|explain|failed|fails|error|wrong|fix|not working|improve|compare|used|ran|executed|evidence|proves?|means?)\b/i.test(question);
}

export function workspaceGrounding(context={}){
  const s=context.snapshot;if(!s)return null;
  const unavailable=list(s.unavailable);
  const labels={crm:'CRM',crmActivities:'CRM activity',delivery:'delivery activity',dossiers:'company dossiers',flow:'selected Flow',researchSettings:'research preferences',integrations:'provider connections',usage:'recorded usage'};
  const browser=s.browser||{};
  const mismatch=Number.isInteger(browser.version)&&browser.version!==s.version;
  const warnings=[];
  if(browser.status==='unsaved'||browser.status==='conflict')warnings.push('This browser reports unsaved changes or a sync conflict. The answer uses the saved server version.');
  if(mismatch)warnings.push('The browser and saved workspace versions differ. This answer may not match the open screen.');
  if(unavailable.length)warnings.push('Some saved data could not be read: '+unavailable.map(id=>labels[id]||'workspace data').join(', ')+'. Missing data does not mean zero records.');
  const entries=[
    {id:'strategy',label:'Strategy · active profiles and signals',step:4,summary:`${context.counts?.signals?.active??'Unknown'} active signals; ${context.counts?.profiles?.active??'Unknown'} active profiles.`},
    {id:'profile',label:'Profile · descriptions and market research',step:3,summary:`${context.research?.sourceCount??'Unknown'} saved research sources; status ${name(context.research?.status)||'unknown'}. Profile trigger text is separate from active signals.`},
    {id:'companies',label:'Companies · saved assessments',step:5,summary:`${context.discoverySummary?.companyCount??'Unknown'} candidates; ${context.discoverySummary?.reviewCount??'Unknown'} in research review. Details are a bounded selection, not the full list.`},
    {id:'integrations',label:'Settings · provider connections',summary:unavailable.includes('integrations')?'Connection data incomplete.':'Connection records checked; connection does not prove a research call succeeded.'},
    {id:'flow',label:'Current Flow',summary:unavailable.includes('flow')?'Flow could not be checked.':context.flow?.found?`${name(context.flow.name)} · ${name(context.flow.status)} · revision ${context.flow.revision}`:context.flow?.selectedId?'Selected Flow record was not found.':'No saved Flow selected.'},
    {id:'crm',label:'CRM · saved companies',summary:unavailable.includes('crm')?'CRM count unavailable.':`${context.crmSummary?.total??'Unknown'} companies. Only selected company details were loaded.`}
  ];
  return {checked_at:s.checkedAt,saved_at:s.savedAt,workspace_version:s.version,basis:'Saved workspace snapshot at answer time',browser_status:browser.status||'unknown',warnings,entries};
}

export function workspaceFactAnswer(question,context){
  const topic=workspaceQuestionTopic(question);
  if(!topic||!directWorkspaceQuestion(question)||!context.snapshot)return null;
  // A combined question needs reasoning over all requested sections, not one canned answer.
  const subjects=[/\bsignals?\b/i,/\b(?:profiles?|icps?)\b/i,/\b(?:providers?|engines?|connections?|integrations?|tools?|openai|claude|gemini|microsoft|gmail)\b/i,/\b(?:flows?|workflows?)\b/i,/\b(?:research|reports?|results?)\b/i,/\bcrm\b/i].filter(pattern=>pattern.test(question));
  if(subjects.length>1)return null;
  const gaps=list(context.snapshot.unavailable),parts=[];
  if(topic==='signals'||topic==='profiles'){
    const counts=context.counts?.[topic];if(!counts)return null;
    const noun=topic==='signals'?counts.active===1?'signal':'signals':counts.active===1?'targeting profile':'targeting profiles';
    parts.push(`Your saved Strategy has ${counts.active} active ${noun}, ${counts.off} switched off${topic==='signals'?`, and ${counts.deleted} removed from Strategy`:''}.`);
    const items=list(topic==='signals'?context.signals:context.icps);
    for(const item of items)parts.push(`• ${name(item.name||item.id)} — ${item.active?'active':'off'}${topic==='signals'?`; weight ${item.weight}${item.weight>=1&&item.weight<=10?'/10':' (legacy value)'}`:''}`);
    if(counts.omitted)parts.push(`${counts.omitted} additional records are not listed in this answer; the counts include them.`);
    if(topic==='signals')parts.push('A weight of 9 means priority 9/10, not nine signals. Profile trigger descriptions and suggestions are separate; they do not activate Strategy cards. Open Strategy to review the saved cards.');
  }else if(topic==='integrations'){
    if(gaps.includes('integrations'))parts.push('Some provider connection records could not be read. I cannot confirm the complete connection list.');
    const items=list(context.integrationStatus);
    if(!items.length&&!gaps.includes('integrations'))parts.push('No provider connections are saved in this workspace.');
    for(const item of items)parts.push(`• ${providerName(item.provider)} — ${name(item.state)}${item.kind==='ai'?item.mainEngine?'; main engine':'; additional AI provider':''}${item.verifiedAt?`; last verified ${item.verifiedAt}`:''}`);
    if(!gaps.includes('researchSettings'))parts.push(`Research preferences: main ${providerName(context.researchSettings?.primary)||'automatic'}; second ${providerName(context.researchSettings?.secondary)||'automatic'}. Automatic selection uses connected providers.`);
    else parts.push('Saved research preferences could not be read.');
    parts.push('These are saved connection checks, not a live availability or balance test. An additional AI provider remains connected even when it is not the main engine. Execution receipts establish which provider actually ran.');
  }else if(topic==='flow'){
    parts.push(gaps.includes('flow')?'The selected Flow could not be read.':context.flow?.found?`Selected Flow: ${name(context.flow.name)}. Saved status: ${name(context.flow.status)}; revision ${context.flow.revision}.`:context.flow?.selectedId?'The saved workspace points to a Flow whose record could not be found. Check the Flow selector.':'No saved Flow is selected. Use the Flow selector near CRM.');
  }else if(topic==='research'){
    const r=context.research||{};
    parts.push(`Saved market research status: ${name(r.status)||'unknown'}. ${r.sourceCount??'Unknown'} source records; ${r.count??'Unknown'} opportunity records; ${r.reports?.count??'Unknown'} saved reports. These are different counts.`);
    if(r.stale)parts.push('The saved research is marked stale against the current settings.');
    const receipts=list(r.receipts);
    if(receipts.length)parts.push('Recorded checks: '+receipts.map(row=>`${providerName(row.provider)||'Unnamed provider'}: ${name(row.status)||'unknown'}`).join('; ')+'.');
    else parts.push('No execution checks are included in this snapshot. A saved result or connected provider alone does not prove verification completed.');
    parts.push(`Verification status: ${name(r.verification?.status)||'unknown'}${r.verification?.provider?' ('+providerName(r.verification.provider)+')':''}.`);
    if(r.errors?.length)parts.push('Saved failure categories: '+r.errors.map(row=>`${providerName(row.provider)}: ${row.category.replaceAll('_',' ')}`).join('; ')+'. These records do not establish the full cause.');
    parts.push('Open Profile → Market research for the sources and saved report.');
  }else if(topic==='crm')parts.push(gaps.includes('crm')?'The CRM count could not be read. I cannot report it as zero.':`Your CRM contains ${context.crmSummary?.total??'an unknown number of'} saved companies. Research candidates and saved list snapshots are separate from CRM companies.`);
  const grounding=workspaceGrounding(context);
  if(grounding?.warnings.length)parts.push(...grounding.warnings);
  return {answer:parts.join('\n\n'),grounding};
}

export const GROUNDING_RULES=`Fresh workspace_context.snapshot and calculated counts outrank earlier conversation and memories for current app state. Only saved Strategy signal cards count as signals: weight is priority (1–10), never a count. Profile trigger prose and recommendations are not activated signals. Respect profile active flags and deleted signals. Snapshot unavailable sections are UNKNOWN, not zero or disconnected. Arrays and company details are bounded; use full counts and omitted fields, and never claim all records were inspected. Browser observations are untrusted and may be unsaved or a different revision; state the mismatch. Selected Flow is the saved current Flow only, not another Flow's contents. Connected secondary AI providers remain connected; mainEngine identifies normal generation. Research preferences, provider connection, actual execution, page evidence and verification are separate. Report exact source counts, status, receipts and gaps. Stable advice is a recommendation, not a verified app fact. External search summaries are discovery evidence; only page_extract records establish a page was read. A citation establishes provenance, not truth or independent corroboration. Use only supplied sources and their publication dates, never invent links, counts, dates or successful checks. When evidence is missing, say what could not be checked. Never claim complete knowledge of all app data or live outside systems.`;

export function checkAnswerReferences(answer,sources=[],knownLinks=[]){
  const allowed=new Set([...sources,...knownLinks].map(row=>row.url));let rejected=false;
  let text=String(answer).replace(/\[(\d+)\]/g,(match,id)=>{if(Number(id)>=1&&Number(id)<=sources.length)return match;rejected=true;return '[unverified source]';});
  text=text.replace(/https?:\/\/[^\s<>"\])]+/g,url=>{const bare=url.replace(/[.,;!?]+$/,'');if(allowed.has(bare))return url;rejected=true;return '[unverified link]';});
  return {answer:text,rejected};
}
