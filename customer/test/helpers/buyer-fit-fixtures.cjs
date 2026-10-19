// A missing assessment represents an AI failure, not a verified weak buyer.
// These provider fixtures return sourced low-fit assessments when testing no-match runs.
function weakBuyerFitResponse(prompt=''){
  const companies=JSON.parse(prompt.split('. Companies: ')[1]||'[]');
  return JSON.stringify({companies:companies.map(company=>({
    domain:company.domain,fit:60,offerId:'offer-0',
    reason:'The supplied operations establish only an adjacent purchasing application.',
    buyerRole:'adjacent industrial operator',
    evidence:company.evidence?.length?[{sourceId:company.evidence[0].sourceId,quote:company.evidence[0].text.slice(0,300)}]:[]
  }))});
}
module.exports={weakBuyerFitResponse};
