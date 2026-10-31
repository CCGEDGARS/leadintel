// D1 serializes this single INSERT ... SELECT. The checks and reservation must
// stay in the same write statement: an earlier SELECT is only a UI fast path.
export async function reserveCrmEnrichment(db,row,policy){
  const {results:tables}=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('enrichment_requests','crm_enrichment_requests')").all();
  const names=tables.map(r=>r.name);
  if(!names.includes('crm_enrichment_requests'))throw new Error('CRM enrichment ledger is unavailable');
  const args=[...row.values];
  const usage=start=>names.map(table=>{args.push(row.workspaceId);const retained=table==='crm_enrichment_requests'?" OR (status='cancelled' AND json_extract(response_summary_json,'$.budget_retained')=1)":'';return `(SELECT COALESCE(SUM(credits_reserved),0) FROM ${table} WHERE workspace_id=? AND created_at>=${start} AND (status NOT IN ('failed','cancelled')${retained}))`;}).join('+');
  const daily=usage("date('now')");args.push(row.reserved,Number(policy.daily_credit_limit));
  const monthly=usage("date('now','start of month')");args.push(row.reserved,Number(policy.monthly_credit_limit));
  args.push(row.phone?1:0,row.workspaceId,row.companyId,row.personId,Math.max(1,Number(policy.retry_after_days)||30),row.workspaceId,row.companyId,row.personId,row.contactId||'');
  args.push(row.phone?1:0,row.workspaceId,row.companyId,row.personId);
  return db.prepare(`INSERT INTO crm_enrichment_requests(id,workspace_id,company_id,contact_id,provider,person_provider_id,role_requested,status,personal_email_requested,phone_requested,credits_reserved,credits_used,response_summary_json,requested_by,created_at,updated_at)
    SELECT ${row.values.map(()=>'?').join(',')} WHERE (${daily})+?<=? AND (${monthly})+?<=?
    AND (?=0 OR (NOT EXISTS (SELECT 1 FROM crm_enrichment_requests WHERE workspace_id=? AND company_id=? AND provider='apollo' AND person_provider_id=? AND phone_requested=1 AND (status IN ('processing','pending_phone') OR (status IN ('verified','not_found') AND created_at>=datetime('now','-'||?||' days'))))
      AND NOT EXISTS (SELECT 1 FROM crm_contacts WHERE workspace_id=? AND company_id=? AND ((source='apollo' AND external_person_id=?) OR id=?) AND archived_at IS NULL AND TRIM(COALESCE(phone_number,''))<>'' AND LOWER(phone_status) IN ('verified','provider_listed'))))
    AND (?=1 OR NOT EXISTS(SELECT 1 FROM crm_enrichment_requests WHERE workspace_id=? AND company_id=? AND provider='apollo' AND person_provider_id=? AND phone_requested=0 AND (status='processing' OR (status='cancelled' AND json_extract(response_summary_json,'$.budget_retained')=1))))
    RETURNING id`).bind(...args).first();
}
