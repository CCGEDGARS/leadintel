// One workspace budget covers legacy opportunity lookups and CRM buyer lookups.
export async function apolloCreditUsage(db,workspaceId){
  const totals={daily:0,monthly:0};
  for(const table of ['enrichment_requests','crm_enrichment_requests']){
    for(const [period,start] of [['daily',"date('now')"],['monthly',"date('now','start of month')"]]){
      const retained=table==='crm_enrichment_requests'?" OR (status='cancelled' AND json_extract(response_summary_json,'$.budget_retained')=1)":'';
      try{const row=await db.prepare(`SELECT COALESCE(SUM(credits_reserved),0) value FROM ${table} WHERE workspace_id=? AND created_at>=${start} AND (status NOT IN ('cancelled','failed')${retained})`).bind(workspaceId).first();totals[period]+=Number(row?.value)||0;}
      catch(error){if(!/no such table/i.test(String(error?.message||'')))throw error;}
    }
  }
  return totals;
}
