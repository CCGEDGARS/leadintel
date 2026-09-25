// Record only confirmed billing/credit failures. A bare 429 can be a transient rate limit.
export function creditFailure(status, detail=''){
  const value=String(detail||'').toLowerCase();
  if(Number(status)===402||/\b(?:insufficient_quota|credit_balance_exhausted|billing_hard_limit_reached|payment_required|out_of_credits|credits_exhausted)\b/.test(value))return true;
  return /(?:insufficient|exhausted|no|out of|zero)\s+(?:available\s+)?(?:credits?|quota|balance)|(?:credits?|quota|balance)\s+(?:is\s+)?(?:exhausted|depleted)/.test(value);
}

export async function recordProviderCredit(env,{workspaceId,userId,provider,kind,source='customer'}){
  // A health write must never break the user's original provider request.
  try{await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),workspaceId,userId,kind==='failed'?'provider.credit_exhausted':'provider.credit_recovered','provider_credit',provider,JSON.stringify({source})).run();}catch{}
}

export async function providerCreditIssue(env,workspaceId,provider){
  try{
    const row=await env.DB.prepare(`SELECT event_type,metadata_json FROM audit_events WHERE workspace_id=? AND entity_type='provider_credit' AND entity_id=? ORDER BY rowid DESC LIMIT 1`).bind(workspaceId,provider).first();
    if(row?.event_type!=='provider.credit_exhausted')return null;
    const metadata=JSON.parse(row.metadata_json||'{}');
    return {code:'credits_exhausted',source:metadata.source==='managed'?'managed':'customer'};
  }catch{return null;}
}
