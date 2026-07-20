const text=value=>String(value??"").trim();
const fold=value=>text(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
const words=value=>new Set(fold(value).replace(/\b(and|or|the|a|an|in|at|for|of|to|ar|un|par|uz)\b/g," ").replace(/[^a-z0-9āčēģīķļņšūž]+/g," ").split(/\s+/).filter(word=>word.length>2));
const COMMERCIAL=/\b(hir(e|ing)|vacanc|sales|commercial|business development|procurement|tender|funding|investment|expansion|crm|revops|leadership|manager|director|vaditaj|pardosan|iepirkum|vakanc|investic|finansejum)\w*/i;
const JUNK=/\b(dictionary|definition|meaning|grammar|wikipedia|wordreference|translate|translation|lyrics|crossword)\b/i;
const DISCUSSION_HOSTS=/^(www\.)?(reddit\.com|quora\.com)$/i;

export function compileQueries({query_id="",latvian="",english="",market="Latvia",country="LV"}={}) {
  const suffix=[text(market),text(country)].filter(Boolean).join(" ");
  return [["lv",latvian],["en",english]].filter(([,query])=>text(query)).map(([language,query])=>({query_id:text(query_id),language,query:`(${text(query)}) ${suffix}`.trim()}));
}

export function assessCandidate(row,{market="Latvia",country="LV",maxAgeDays=365}={}) {
  const reasons=[]; const warnings=[];
  const company=text(row.company_name||row.company); const url=text(row.source_url||row.url); const title=text(row.source_title||row.title);
  const evidence=text(row.factual_evidence||row.signal_summary||row.description); const signal=text(row.signal_type);
  let host="";try{const parsed=new URL(url);if(parsed.protocol!=="https:")reasons.push("source_not_https");host=parsed.hostname;}catch{reasons.push("source_url_invalid");}
  if(!company)reasons.push("company_missing");
  if(!evidence)reasons.push("evidence_missing");
  if(JUNK.test(`${title} ${host}`))reasons.push("junk_or_reference_page");
  if(DISCUSSION_HOSTS.test(host))reasons.push("discussion_source_not_primary_evidence");
  if(!COMMERCIAL.test(`${signal} ${title} ${evidence}`))reasons.push("commercial_signal_missing");
  const companyTerms=words(company); const evidenceTerms=words(`${title} ${evidence}`); const companyMatches=[...companyTerms].filter(term=>evidenceTerms.has(term));
  if(companyTerms.size&&companyMatches.length===0)reasons.push("company_not_mentioned_in_evidence");
  const geo=fold(`${row.location||""} ${title} ${evidence} ${host}`); const expected=[fold(market),fold(country)].filter(Boolean);
  if(expected.length&&!expected.some(term=>geo.includes(term)))warnings.push("geography_not_explicit");
  const captured=text(row.captured_at||row.observed_at||row.signal_date); const date=new Date(captured);
  let age_days=null;if(Number.isNaN(date.getTime()))warnings.push("source_date_missing");else{age_days=Math.max(0,Math.floor((Date.now()-date.getTime())/86400000));if(age_days>Number(maxAgeDays||365))reasons.push("source_too_old");}
  const passed=reasons.length===0;
  const score=Math.max(0,100-reasons.length*35-warnings.length*10);
  return {passed,score,reasons,warnings,checks:{company,host,company_matches:companyMatches,age_days,commercial_signal:COMMERCIAL.test(`${signal} ${title} ${evidence}`)}};
}

