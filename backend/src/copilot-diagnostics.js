const uuid=()=>crypto.randomUUID();
function text(value){return String(value??'').replace(/\s+/g,' ').trim();}
function array(value){return Array.isArray(value)?value:[];}
function issue(category,severity,key,title,summary,details={}){return {category,severity,fingerprint:`${category}:${key}`,title,summary,details};}
function field(profile,...names){for(const name of names){const value=profile?.[name];if(text(value))return text(value);}return '';}
function integration(context,provider){return array(context?.integrationStatus).find(item=>text(item?.provider).toLowerCase()===provider);}
function genericSignal(signal){
  const keywords=array(signal?.keywords).map(text).filter(Boolean);
  if(keywords.length)return false;
  const corpus=`${text(signal?.name)} ${text(signal?.description)}`.toLowerCase();
  const words=corpus.split(/\s+/).filter(Boolean);
  return words.length<=5||/^(growth|hiring|news|change|expansion|new project|investment)(\s+\1)?$/i.test(text(signal?.name));
}

export function runDeterministicDiagnostics(context={}){
  const diagnostics=[];const company=context.company||{},markets=array(context.markets),profile=context.profile||{},icps=array(context.icps),signals=array(context.signals),step=Math.max(1,Number(context?.screen?.step)||1);
  if(!text(company.website))diagnostics.push(issue('completeness','important','website_missing','Company website is missing','Add a valid company website so LeadIntel has a primary public evidence source.'));
  if(!markets.length)diagnostics.push(issue('readiness','important','target_market_missing','Target market is missing','Select at least one target market before running commercial intelligence.'));
  const profileExists=Boolean(Object.keys(profile).length||text(company.name)||text(company.description));
  if(profileExists&&!icps.length)diagnostics.push(issue('quality','improve','icp_missing','Ideal customer profile needs definition','Define at least one specific ICP before relying on Discovery results.'));
  const activeSignals=signals.filter(item=>item?.active!==false);
  if(profileExists&&!activeSignals.length)diagnostics.push(issue('readiness','improve','active_signal_missing','No active buying signals','Activate or define buying signals so LeadIntel can recognize commercially relevant timing.'));
  if(activeSignals.some(genericSignal))diagnostics.push(issue('quality','improve','signal_too_generic','Buying signals are too generic','Add observable trigger language and monitoring keywords to weak signals.'));
  if(profileExists&&!field(profile,'buyer_roles','buyerRoles','decision_makers','decisionMakers'))diagnostics.push(issue('completeness','improve','buyer_roles_missing','Buyer roles are missing','Add the roles that normally make or strongly influence the purchase decision.'));
  if(profileExists&&!field(profile,'exclusions','exclusion_criteria','exclusionCriteria'))diagnostics.push(issue('completeness','improve','exclusions_missing','Exclusion criteria are missing','Define companies, deal sizes, markets or conditions LeadIntel should exclude.'));
  if(profileExists&&!field(profile,'opportunity_value','opportunityValue','deal_value','dealValue'))diagnostics.push(issue('completeness','improve','opportunity_value_missing','Opportunity value is missing','Add an approximate deal, project or customer value so prioritization has commercial context.'));
  const researchCount=Number(context?.research?.count)||array(context?.research?.items).length;
  if(step>=5&&!researchCount)diagnostics.push(issue('evidence','improve','discovery_without_research','Discovery has insufficient market evidence','Run or review market research before treating Discovery companies as evidence-backed opportunities.'));
  if(step>=5){const apollo=integration(context,'apollo');if(apollo&&text(apollo.state).toLowerCase()!=='connected')diagnostics.push(issue('readiness','improve','apollo_disconnected','Apollo is not connected','Decision-maker/contact enrichment may be limited until Apollo is connected.'));}
  if(step>=7){const gmail=integration(context,'gmail');if(!gmail||text(gmail.state).toLowerCase()!=='connected')diagnostics.push(issue('readiness','improve','gmail_disconnected','Gmail is not connected','Connect Gmail before using email delivery and reply-learning features.'));}
  return diagnostics;
}

export async function persistDiagnosticSnapshot(env,{workspaceId,diagnostics}={}){
  const id=text(workspaceId);if(!id)throw new Error('workspaceId is required');const current=array(diagnostics);
  let existing=[];try{({results:existing=[]}=await env.DB.prepare(`SELECT fingerprint,status FROM copilot_diagnostics WHERE workspace_id=? AND status='open'`).bind(id).all());}catch{}
  const active=new Set();let saved=0;
  for(const item of current){
    const fingerprint=text(item?.fingerprint);if(!fingerprint)continue;active.add(fingerprint);
    await env.DB.prepare(`INSERT INTO copilot_diagnostics(id,workspace_id,category,severity,status,fingerprint,title,summary,details_json,created_at,updated_at,resolved_at) VALUES(?,?,?,?,'open',?,?,?, ?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL) ON CONFLICT(workspace_id,fingerprint) DO UPDATE SET category=excluded.category,severity=excluded.severity,status='open',title=excluded.title,summary=excluded.summary,details_json=excluded.details_json,updated_at=CURRENT_TIMESTAMP,resolved_at=NULL`).bind(uuid(),id,item.category,item.severity,fingerprint,text(item.title),text(item.summary),JSON.stringify(item.details||{})).run();saved++;
  }
  for(const row of existing){if(row?.status==='open'&&!active.has(text(row.fingerprint)))await env.DB.prepare(`UPDATE copilot_diagnostics SET status='resolved',resolved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND fingerprint=? AND status='open'`).bind(id,row.fingerprint).run();}
  return {saved,resolved:existing.filter(row=>row?.status==='open'&&!active.has(text(row.fingerprint))).length};
}
