import {sha256} from "./security.js";

const text=value=>String(value??"").trim();
const normalized=value=>text(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(sia|as|a\/s|llc|ltd|inc)\b/g,"").replace(/[^a-z0-9]+/g," ").trim();
const safeUrl=value=>/^https?:\/\//i.test(text(value))?text(value):"";
const validVerifiedEmail=row=>/^verified$/i.test(text(row.email_status))&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(row.business_email).toLowerCase())?text(row.business_email).toLowerCase():"";
const key=async(prefix,...parts)=>`${prefix}_${(await sha256(parts.map(normalized).join("|"))).slice(0,24)}`;

export async function ingestCanonicalSnapshot(env,workspaceId,payload) {
  const rows=Array.isArray(payload?.opportunities)?payload.opportunities:[];
  const statements=[]; const companyIds=new Set(); const opportunityIds=new Set(); const signalIds=new Set();
  for(const row of rows) {
    const companyName=text(row.company_name||row.company); if(!companyName)continue;
    const companyId=await key("co",workspaceId,companyName); const normalizedName=normalized(companyName);
    const opportunityId=await key("opp",workspaceId,companyName);
    const sourceUrl=safeUrl(row.source_url); const signalType=text(row.signal_type)||"Market signal";
    const signalId=await key("sig",workspaceId,companyName,sourceUrl||text(row.source_title),signalType);
    const evidence=text(row.factual_evidence); const evidenceId=evidence?await key("ev",workspaceId,companyName,sourceUrl,evidence):"";
    const email=validVerifiedEmail(row); const contactName=text(row.decision_maker);
    statements.push(env.DB.prepare(`INSERT INTO companies(id,workspace_id,canonical_name,normalized_name,domain,website_url,industry,location)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,normalized_name) DO UPDATE SET
      canonical_name=excluded.canonical_name,domain=COALESCE(NULLIF(excluded.domain,''),companies.domain),website_url=COALESCE(NULLIF(excluded.website_url,''),companies.website_url),updated_at=CURRENT_TIMESTAMP`)
      .bind(companyId,workspaceId,companyName,normalizedName,text(row.domain),safeUrl(row.website),text(row.industry),text(row.location)));
    companyIds.add(companyId);
    statements.push(env.DB.prepare(`INSERT INTO signals(id,workspace_id,company_id,fingerprint,signal_type,summary,captured_at,source_title,source_url,confidence)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,fingerprint) DO UPDATE SET summary=excluded.summary,captured_at=MAX(COALESCE(signals.captured_at,''),COALESCE(excluded.captured_at,'')),updated_at=CURRENT_TIMESTAMP`)
      .bind(signalId,workspaceId,companyId,signalId,signalType,text(row.signal_summary),text(row.captured_at),text(row.source_title),sourceUrl,text(row.confidence)));
    signalIds.add(signalId);
    if(evidence)statements.push(env.DB.prepare(`INSERT INTO evidence_items(id,workspace_id,company_id,signal_id,fingerprint,claim_text,source_title,source_url,observed_at)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,fingerprint) DO NOTHING`).bind(evidenceId,workspaceId,companyId,signalId,evidenceId,evidence,text(row.source_title),sourceUrl,text(row.captured_at)));
    const score10=Number(row.score_10)||0; const score100=Number(row.score_100)||score10*10;
    statements.push(env.DB.prepare(`INSERT INTO opportunities(id,workspace_id,company_id,status,score_100,score_10,confidence,recommended_offer,commercial_reason,decision_maker_role,urgency,payload_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,company_id) DO UPDATE SET
      status=CASE WHEN excluded.score_10>=opportunities.score_10 THEN excluded.status ELSE opportunities.status END,
      score_100=MAX(opportunities.score_100,excluded.score_100),score_10=MAX(opportunities.score_10,excluded.score_10),
      confidence=CASE WHEN excluded.score_10>=opportunities.score_10 THEN excluded.confidence ELSE opportunities.confidence END,
      recommended_offer=CASE WHEN excluded.score_10>=opportunities.score_10 THEN excluded.recommended_offer ELSE opportunities.recommended_offer END,
      commercial_reason=CASE WHEN excluded.score_10>=opportunities.score_10 THEN excluded.commercial_reason ELSE opportunities.commercial_reason END,
      decision_maker_role=COALESCE(NULLIF(excluded.decision_maker_role,''),opportunities.decision_maker_role),urgency=CASE WHEN excluded.score_10>=opportunities.score_10 THEN excluded.urgency ELSE opportunities.urgency END,
      payload_json=CASE WHEN excluded.score_10>=opportunities.score_10 THEN excluded.payload_json ELSE opportunities.payload_json END,updated_at=CURRENT_TIMESTAMP`)
      .bind(opportunityId,workspaceId,companyId,text(row.status)||"New",score100,score10,text(row.confidence),text(row.recommended_offer),text(row.commercial_reason),text(row.decision_maker_role),text(row.urgency),JSON.stringify(row)));
    opportunityIds.add(opportunityId);
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO opportunity_signals(opportunity_id,signal_id) VALUES(?,?)").bind(opportunityId,signalId));
    if(email&&contactName) {
      const contactId=await key("ct",workspaceId,email);
      statements.push(env.DB.prepare(`INSERT INTO contacts(id,workspace_id,company_id,full_name,normalized_name,role,business_email,email_status,verification_provider,verified_at,linkedin_url)
        VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?) ON CONFLICT(workspace_id,business_email) DO UPDATE SET full_name=excluded.full_name,role=excluded.role,email_status='Verified',verification_provider=excluded.verification_provider,verified_at=CURRENT_TIMESTAMP,linkedin_url=excluded.linkedin_url,updated_at=CURRENT_TIMESTAMP`)
        .bind(contactId,workspaceId,companyId,contactName,normalized(contactName),text(row.decision_maker_role),email,"Verified",text(row.verification_provider),safeUrl(row.linkedin_url)));
    }
  }
  if(statements.length)await env.DB.batch(statements);
  return {input_rows:rows.length,companies:companyIds.size,opportunities:opportunityIds.size,signals:signalIds.size,duplicates_removed:Math.max(0,rows.length-companyIds.size)};
}

export async function canonicalSnapshot(env,workspaceId) {
  const {results:records}=await env.DB.prepare(`SELECT o.*,c.canonical_name,c.website_url,c.industry,c.location
    FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE o.workspace_id=? ORDER BY o.score_10 DESC,o.updated_at DESC`).bind(workspaceId).all();
  if(!records.length)return null;
  const opportunities=[]; const signals=[];
  for(const record of records) {
    const base=JSON.parse(record.payload_json||"{}");
    const contact=await env.DB.prepare(`SELECT full_name,role,business_email,email_status,verification_provider,linkedin_url FROM contacts WHERE company_id=? AND email_status='Verified' ORDER BY verified_at DESC LIMIT 1`).bind(record.company_id).first();
    const {results:companySignals}=await env.DB.prepare(`SELECT s.*,e.claim_text,e.observed_at FROM signals s LEFT JOIN evidence_items e ON e.signal_id=s.id WHERE s.company_id=? ORDER BY s.captured_at DESC,e.created_at DESC`).bind(record.company_id).all();
    const uniqueEvidence=[...new Set(companySignals.map(item=>item.claim_text).filter(Boolean))];
    const uniqueSignalSummaries=[...new Set(companySignals.map(item=>item.summary).filter(Boolean))];
    const evidenceItems=[...new Map(companySignals.filter(item=>item.claim_text).map(item=>[item.claim_text,{claim:item.claim_text,source_title:item.source_title||"Source evidence",source_url:item.source_url||"",observed_at:item.observed_at||item.captured_at||""}])).values()];
    opportunities.push({...base,id:record.id,company_name:record.canonical_name,score_100:record.score_100,score_10:record.score_10,status:record.status,pipeline_stage:record.pipeline_stage,next_action:record.next_action,notes:record.notes,
      signal_summary:uniqueSignalSummaries[0]||base.signal_summary||"",factual_evidence:uniqueEvidence.join("\n"),signal_count:new Set(companySignals.map(item=>item.id)).size,evidence_count:uniqueEvidence.length,
      evidence_items:evidenceItems,
      decision_maker:contact?.full_name||"",decision_maker_role:contact?.role||record.decision_maker_role||"",business_email:contact?.business_email||"",email_status:contact?.email_status||"Not found",verification_provider:contact?.verification_provider||"",linkedin_url:contact?.linkedin_url||""});
    for(const item of companySignals)signals.push({id:item.id,company:record.canonical_name,text:item.summary,type:item.signal_type,date:item.captured_at,confidence:item.confidence,status:"Qualified",source_title:item.source_title,source_url:item.source_url});
  }
  const workspace=await env.DB.prepare("SELECT id,name,market FROM workspaces WHERE id=?").bind(workspaceId).first();
  return {schema_version:2,generated_at:new Date().toISOString(),workspace,opportunities,signals,sources:[],runs:[],canonical:true};
}
